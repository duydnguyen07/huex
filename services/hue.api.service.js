const config = require('./config');
const RxHR = require('@akanass/rx-http-request').RxHR;
const { of } = require('rxjs');
const { switchMap, concatMap } = require('rxjs/operators');
var { getHubIP } = require('./hue.hub.discovery');

const { BehaviorSubject } = require('rxjs');

class HueApiService {
    constructor() {
        this.hubIpObs = new BehaviorSubject('')

        getHubIP().subscribe(ip => {
            this.hubIpObs.next(ip)
        });
    }

    getAllLightsInfo() {
        return getApiBase(this.hubIpObs).pipe(
            switchMap(baseUrl => RxHR.get(`${baseUrl}/lights`))
        )
    }

    getLightInfo(lightNumber) {
        return getApiBase(this.hubIpObs).pipe(
            switchMap(baseUrl => RxHR.get(`${baseUrl}/lights/${lightNumber}`))
        )
    }

    updateLight(lightNumber, payload) {
        return getApiBase(this.hubIpObs).pipe(
            switchMap(baseUrl => RxHR.put(`${baseUrl}/lights/${lightNumber}/state`,
                    { 
                        headers: { 
                            'Content-Type': 'text/plain' 
                        },
                        body: JSON.stringify(payload)
                    }
                )
            )
        )
    }
}

function getApiBase(hubIpObs) {
    return getHubIP(hubIpObs).pipe(
            concatMap(host => {
                return of(`http://${host}/api/${config.HUE_KEY}`)
            })
        )
}


module.exports.HueApiService = HueApiService