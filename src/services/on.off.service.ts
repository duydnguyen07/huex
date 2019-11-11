/**
 * This service is responsible for monitoring user's presences and automatically turn lights on and off
 * depending on whether if the user is determined as presence by the system.
 */
import { RxHttpRequestResponse } from "@akanass/rx-http-request";
import { ConnectionPool, sql } from "@databases/pg";
import { getTable, IArpTable, IArpTableRow } from "@network-utils/arp-lookup";
import { find } from "lodash";
import { BehaviorSubject, from, interval, Observable, of } from "rxjs";
import { catchError, combineLatest, debounceTime, first, mapTo, switchMap, withLatestFrom } from "rxjs/operators";
import { IDevice, IUser } from "../models/user.info.model";
import { HueApiService } from "./hue.api.service";

// tslint:disable-next-line
const ping = require("ping");

// tslint:disable-next-line
require('log-timestamp');

interface IReachableIpChangeEvent {
    data: Set<string>;
    deletedIp: string;
    addedIp: string;
}

interface IUserHueProfile {
    user: IUser;
    hueStatus: any;
}

interface ILightStateUpdate {
    lightIndex: number;
    state: "on"|"off";
}

export class OnOffService {
    private hueApiService: HueApiService;
    private localIps: string[];
    private MONITORING_INTERVAL = 2000;

    constructor(private db: ConnectionPool) {
        this.hueApiService = new HueApiService();
        this.localIps = this.getLocalIps();

        // TODO: figureout how to allow user to manage profile and devices
        // TODO: figureout how to get user's MAC from the web
    }

    /**
     * This will start a chron job to look for devices that are home and determine whether to turn lights on or off.
     */
    public start() {
        // Start to ping to monitor device presence in network
        this.reachableIps(this.MONITORING_INTERVAL).pipe(
            debounceTime(200),
            withLatestFrom(
                this.getArpTableInterval(this.MONITORING_INTERVAL),
                this.getUserHueProfiles(this.MONITORING_INTERVAL)
            ),
            catchError((err: any) => {
                console.log(err);
                return of(err);
            }),
            switchMap((
                [reachableIpChangeE, arpTable, profiles]:
                [IReachableIpChangeEvent, IArpTable, IUserHueProfile[]]
            ) => {
                const stateUpdate: ILightStateUpdate[] = [];

                // Get a set of mac addresses that are associated with the reachable IPs
                const reachableIpMacSet: Set<string> = new Set();
                reachableIpChangeE.data.forEach((reachableIp) => {
                    const matchedRow: IArpTableRow = find(arpTable, (row: IArpTableRow) => row.ip === reachableIp);
                    if (matchedRow) { reachableIpMacSet.add(matchedRow.mac); }
                });

                // Check to see if devices registered with this profile are present
                profiles.forEach((profile: IUserHueProfile) => {
                    const onlineDevice: IDevice = find(
                        // A MAC address in this profile is found to be active in the LAN
                        profile.user.devices.value, (device: IDevice) => reachableIpMacSet.has(device.MAC_ID)
                    );

                    console.log(reachableIpChangeE, arpTable, profiles)

                    if (onlineDevice &&
                        profile.hueStatus.state.on === false  // Light status is off
                    ) {
                        console.log(
                            `Light of user ${profile.user.name} is turning ON because device ${JSON.stringify(onlineDevice)} is online`
                        );

                        stateUpdate.push({
                            lightIndex: profile.user.lightIndex,
                            state: "on"
                        });
                    } else if (
                        !onlineDevice &&
                        profile.hueStatus.state.on === true // Light status is on
                    ) {
                        console.log(`Light of user ${profile.user.name} is turning OFF because no devices are online`);

                        stateUpdate.push({
                            lightIndex: profile.user.lightIndex,
                            state: "off"
                        });
                    }
                });

                return of(stateUpdate);
            })).subscribe((lightUpdates: ILightStateUpdate[]) => {
                if (lightUpdates && lightUpdates.length) {
                    lightUpdates.forEach((update: ILightStateUpdate) => {
                        this.hueApiService.updateLight(update.lightIndex, {
                            on: (update.state === "on") ? true : false
                        }).pipe(
                            first(),
                            catchError((err: any) => {
                                console.error(err);
                                return of(err);
                            })
                        ).subscribe(() => {
                            console.log(
                                `Successfully updated light index ${update.lightIndex} to status ${update.state}`
                            );
                        });
                    });
                }
            });
    }

    // Get a stream of all online ips
    private reachableIps(refreshInterval: number): Observable<IReachableIpChangeEvent> {
        const currentReachableIps: Set<string> = new Set([]);
        const subject = new BehaviorSubject({
            data: currentReachableIps,
            deletedIp: "",
            addedIp: ""
        });

        console.log(`Monitoring ips in local network at ${refreshInterval} interval.`);
        setInterval(() => {
            this.localIps.forEach((ip) => {
                const newResponse = {
                    data: currentReachableIps,
                    deletedIp: "",
                    addedIp: ""
                };

                // Ping Ip address if there are changes
                ping.sys.probe(ip, (isAlive: boolean) => {
                    let isUpdated = false;
                    if (!isAlive) { // remove id from reachableIp list
                        if (currentReachableIps.has(ip)) {
                            newResponse.deletedIp = ip;
                            currentReachableIps.delete(ip);
                            isUpdated = true;
                        }
                    } else {
                        if (!currentReachableIps.has(ip)) {
                            currentReachableIps.add(ip);
                            newResponse.addedIp = ip;
                            isUpdated = true;
                        }
                    }

                    if (isUpdated) {
                        subject.next(newResponse); // override alive ips
                    }
                });
            });
        }, refreshInterval);

        return subject.asObservable();
    }

    private getUserHueProfiles(int: number): Observable<IUserHueProfile[]> {
        // IMPROVEMENT: cache for 1 min before calling db again

        return interval(int).pipe(
            switchMap(() => from(this.db.query(sql`SELECT * FROM huex.profiles;`)).pipe(
                    withLatestFrom(this.hueApiService.getAllLightsInfo()),
                    switchMap(([users, lightStatuses]: [IUser[], RxHttpRequestResponse]) => {
                        const res = [];

                        for (const user of users) {
                            res.push({
                                user,
                                hueStatus: JSON.parse(lightStatuses.body)[user.lightIndex]
                            });
                        }

                        return of(res);
                    })
                )
            )
        );
    }

    private getLocalIps(): string[] {
        const res: string[] = [];

        for (let i = 2; i < 256; i++) {
            res.push(`192.168.0.${i}`);
        }

        return res;
    }

    private getArpTableInterval(int: number): Observable<IArpTable> {
        return interval(int).pipe(switchMap(() => from(getTable())));
    }
}
