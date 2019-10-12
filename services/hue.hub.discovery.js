const RxHR = require('@akanass/rx-http-request').RxHR;
const { zip, of, Subject } = require('rxjs');
const { first, catchError, map, concatMap } = require('rxjs/operators');

/**
 * Get hue hub ip or check if the passed-in IP is still valid
 * @param {BehaviorSubject} cachedIp optional ip cached in case caller wants to check if this ip is still valid
 */
function getHubIP(ipSubject) {
    let newIP = new Subject();
    let cachedIp = (ipSubject) ? ipSubject.getValue() : '';

    // test IP
    if(cachedIp) {
        getIpCheckReq(cachedIp).subscribe((res) => {
            if(res === false) { // ip is not working anymore
                fetchForIp().subscribe((res) => { //get a new one
                    newIP.next(res)
                })
            } else {
                newIP.next(cachedIp)
            }
        })
    } else {
        fetchForIp().subscribe((res) => { 
            newIP.next(res)
        }) //no ip in cache, get look for it
    }

    return newIP.asObservable();
}

function fetchForIp() {
    let newIP = new Subject();

    getAllPossibleReq().forEach(
        (reqObs) => reqObs.subscribe(
            (res) => {
                if(res !== false) {
                    newIP.next(res)
                }
            }
        )
    )

    return newIP.asObservable();
}

function getAllPossibleReq() {
    let requests = []

     //get the IP
    for(let i = 2; i < 256; i++) {
        let hubHostIP = `192.168.0.${i}`;
        requests.push(getIpCheckReq(hubHostIP))
    }

    return requests;
}

function getIpCheckReq(ip) {
    let url = `http://${ip}/debug/clip.html`;
    
    return RxHR.get(url, {timeout: 1000}).pipe(
        first(),
        catchError(() => of(false)),
        concatMap((data) => {
            // console.log(data)
            if (data && data.response && data.response.statusCode === 200) {
                return of(ip)
            }
            return of(false)
        })
    )
}

module.exports = {
    getHubIP
}