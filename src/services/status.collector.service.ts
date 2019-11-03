import createConnection, { sql } from "@databases/pg";
import { forEach } from "lodash";
import { timer } from "rxjs";
import { startWith, withLatestFrom } from "rxjs/operators";
import { HueApiService } from "./hue.api.service";

const db = createConnection(process.env.POSTGRES_URI);

export class StatusCollectorService {
    private intervalTime: number;
    private hueApiService: HueApiService;

    constructor(intervalTime: number) {
        this.intervalTime = intervalTime || 3600000; // default to 1 hour
        this.hueApiService = new HueApiService();
    }

    public startCollectingData() {
        console.log(`Cronjob start with interval ${this.intervalTime} to collect lights data`);
        timer(0, this.intervalTime).pipe(
            startWith(0),
            withLatestFrom(this.hueApiService.getAllLightsInfo())
        ).subscribe(([_, data]: [any, any]) => {
            if (data && data.response && data.response.statusCode === 200) {
                const rawStatus = JSON.parse(data.body);
                forEach(rawStatus, (status: any, key: any) => {
                    const localDate = new Date();

                    const res: any = {
                        localTimestamp: localDate.toString(),
                        name: status.name,
                        state: status.state,
                        uniqueid: status.uniqueid,
                        timeStamp: localDate.toISOString()
                    };
                    writeToDb(res);
                });
            }
        });
    }
}

function writeToDb(data: string) {
    db.query(sql`INSERT INTO huex.light_status_log(status) VALUES (${data});`).then(
        (results: any) => console.log(results),
        (err: any) => console.error(err),
      );
}

module.exports.StatusCollectorService = StatusCollectorService;
