import { RxHR } from "@akanass/rx-http-request";
import { BehaviorSubject } from "rxjs";
import { of } from "rxjs";
import { concatMap, switchMap } from "rxjs/operators";
import { config } from "./config";
import { getHubIP } from "./hue.hub.discovery.service";

export class HueApiService {
    private hubIpObs: BehaviorSubject<string>;

    constructor() {
        this.hubIpObs = new BehaviorSubject("");

        getHubIP().subscribe((ip: string) => {
            this.hubIpObs.next(ip);
        });
    }

    public getAllLightsInfo() {
        return getApiBase(this.hubIpObs).pipe(
            switchMap((baseUrl: string) => RxHR.get(`${baseUrl}/lights`))
        );
    }

    public getLightInfo(lightNumber: string) {
        return getApiBase(this.hubIpObs).pipe(
            switchMap((baseUrl: string) => RxHR.get(`${baseUrl}/lights/${lightNumber}`))
        );
    }

    public updateLight(lightNumber: string, payload: any) {
        return getApiBase(this.hubIpObs).pipe(
            switchMap((baseUrl: any) => RxHR.put(`${baseUrl}/lights/${lightNumber}/state`,
                    {
                        body: JSON.stringify(payload),
                        headers: {
                            "Content-Type": "text/plain"
                        }
                    }
                )
            )
        );
    }
}

function getApiBase(hubIpObs: any) {
    return getHubIP(hubIpObs).pipe(
            concatMap((host: string) => {
                return of(`http://${host}/api/${config.HUE_KEY}`);
            })
        );
}
