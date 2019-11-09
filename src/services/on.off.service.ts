/**
 * This service is responsible for monitoring user's presences and automatically turn lights on and off
 * depending on whether if the user is determined as presence by the system.
 */
import { RxHttpRequestResponse } from "@akanass/rx-http-request";
import { ConnectionPool, sql } from "@databases/pg";
import { getTable, IArpTable, IArpTableRow } from "@network-utils/arp-lookup";
import { find, findIndex } from "lodash";
import { BehaviorSubject, from, interval, Observable, of } from "rxjs";
import { combineLatest, debounceTime, switchMap, withLatestFrom } from "rxjs/operators";
import { IDevice, IUser } from "../models/user.info.model";
import { HueApiService } from "./hue.api.service";

// tslint:disable-next-line
const ping = require("net-ping");

interface IReachableIpChangeEvent {
    data: Set<string>;
    deletedIp: string;
    addedIp: string;
}

interface IUserHueProfile {
    user: IUser;
    hueStatus: any;
}

export class OnOffService {
    private hueApiService: HueApiService;
    private localIps: string[];
    private pingSession: any;

    constructor(private db: ConnectionPool) {
        this.hueApiService = new HueApiService();
        this.pingSession = ping.createSession();
        this.localIps = this.getLocalIps();

        // TODO: figureout how to allow user to manage profile and devices
        // TODO: figureout how to get user's MAC from the web
    }

    /**
     * This will start a chron job to look for devices that are home and determine whether to turn lights on or off.
     */
    public start() {
        // Start to ping to monitor device presence in network
        this.reachableIps(this.pingSession, 2000).pipe(
            debounceTime(200),
            combineLatest(
                from(getTable()),
                this.getUserHueProfiles()
            ),
            switchMap((
                [reachableIpChangeE, arpTable, profiles]:
                [IReachableIpChangeEvent, IArpTable, IUserHueProfile[]]
            ) => {
                // Get a set of mac addresses that are associated with the reachable IPs
                const reachableIpMacSet: Set<string> = new Set();
                reachableIpChangeE.data.forEach((reachableIp) => {
                    const matchedRow: IArpTableRow = find(arpTable, (row: IArpTableRow) => row.ip === reachableIp);
                    if (matchedRow) { reachableIpMacSet.add(matchedRow.mac); }
                });

                // Check to see if devices registered with this profile are present
                profiles.forEach((profile: IUserHueProfile) => {
                    let onlineDevice: IDevice = find(
                        // A mac address in this profile is found to be active in the LAN
                        profile.user.devices.value, (device: IDevice) => reachableIpMacSet.has(device.MAC_ID)
                    );

                    if (onlineDevice &&
                        // Light status is off
                        profile.hueStatus.state.on === false
                    ) {
                        console.log(`${profile.user.name} needs to be turned on`);
                    } else if(
                        !onlineDevice && 
                        profile.hueStatus.state.on === true
                    ) {
                        console.log(`${profile.user.name} needs to be turned off`);
                    }
                });

                //TODO: ADD log to each step to see that the cronjob is started
                //TODO: Turn light on or off depending on status
                //TODO: When an action is generated, create a log with timestamp.
                console.log(reachableIpMacSet, JSON.stringify(profiles) );

                return of([]);
            })).subscribe();
    }

    // Get a stream of all online ips
    private reachableIps(session: any, refreshInterval: number): Observable<IReachableIpChangeEvent> {
        const currentReachableIps: Set<string> = new Set([]);
        const subject = new BehaviorSubject({
            data: currentReachableIps,
            deletedIp: "",
            addedIp: ""
        });

        setInterval(() => {
            this.localIps.forEach((ip) => {
                const newResponse = {
                    data: currentReachableIps,
                    deletedIp: "",
                    addedIp: ""
                };

                // Ping Ip address if there are changes
                session.pingHost(ip, (error: any, target: any) => {
                    let isUpdated = false;
                    if (error) { // remove id from reachableIp list
                        if (currentReachableIps.has(target)) {
                            newResponse.deletedIp = target;
                            currentReachableIps.delete(target);
                            isUpdated = true;
                        }
                    } else {
                        if (!currentReachableIps.has(target)) {
                            currentReachableIps.add(target);
                            newResponse.addedIp = target;
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

    private getUserHueProfiles(): Observable<IUserHueProfile[]> {
        // IMPROVEMENT:  cache for 1 min before calling db again

        return from(this.db.query(sql`SELECT * FROM huex.profiles;`)).pipe(
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
        );
    }

    private getLocalIps(): string[] {
        const res: string[] = [];

        for (let i = 2; i < 256; i++) {
            res.push(`192.168.0.${i}`);
        }

        return res;
    }
}
