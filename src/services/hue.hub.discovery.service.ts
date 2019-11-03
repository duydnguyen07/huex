import { BehaviorSubject } from "rxjs";

import { RxHR } from "@akanass/rx-http-request";
import { of, Subject, zip } from "rxjs";
import { catchError, concatMap, first, map } from "rxjs/operators";

/**
 * Get hue hub ip or check if the passed-in IP is still valid
 * @param {BehaviorSubject} cachedIp optional ip cached in case caller wants to check if this ip is still valid
 */
export function getHubIP(ipSubject?: BehaviorSubject<any>) {
    const newIP = new Subject();
    const cachedIp = (ipSubject) ? ipSubject.getValue() : "";

    // test IP
    if (cachedIp) {
        getIpCheckReq(cachedIp).subscribe((res: any) => {
            if (res === false) { // ip is not working anymore
                fetchForIp().subscribe((newIp: any) => { // get a new one
                    newIP.next(newIp);
                });
            } else {
                newIP.next(cachedIp);
            }
        });
    } else {
        fetchForIp().subscribe((res: any) => {
            newIP.next(res);
        }); // no ip in cache, get look for it
    }

    return newIP.asObservable();
}

function fetchForIp() {
    const newIP = new Subject();

    getAllPossibleReq().forEach(
        (reqObs) => reqObs.subscribe(
            (res: any) => {
                if (res !== false) {
                    newIP.next(res);
                }
            }
        )
    );

    return newIP.asObservable();
}

function getAllPossibleReq() {
    const requests = [];

     // get the IP
    for (let i = 2; i < 256; i++) {
        const hubHostIP = `192.168.0.${i}`;
        requests.push(getIpCheckReq(hubHostIP));
    }

    return requests;
}

function getIpCheckReq(ip: string) {
    const url = `http://${ip}/debug/clip.html`;

    return RxHR.get(url, {timeout: 1000}).pipe(
        first(),
        catchError(() => of(false)),
        concatMap((data: any) => {
            // console.log(data)
            if (data && data.response && data.response.statusCode === 200) {
                return of(ip);
            }
            return of(false);
        })
    );
}
