var { HueApiService } = require('./hue.api.service');
var { timer } = require('rxjs');
var { withLatestFrom, startWith } = require('rxjs/operators');
var { forEach } = require('lodash');
var createConnection = require('@databases/pg');
var { sql } = require('@databases/pg');

const db = createConnection(process.env.POSTGRES_URI);

class StatusCollectorService {
    constructor(intervalTime) {
        this.intervalTime = intervalTime || 3600000; //default to 1 hour
        this.hueApiService = new HueApiService();
    }

    startCollectingData() {
        console.log(`Cronjob start with interval ${this.intervalTime} to collect lights data`);
        timer(0, this.intervalTime).pipe(
            startWith(0),
            withLatestFrom(this.hueApiService.getAllLightsInfo())
        ).subscribe(([_, data]) => {
            if(data && data.response && data.response.statusCode === 200){
                let rawStatus = JSON.parse(data.body);
                forEach(rawStatus, (status, key) => {
                    let localDate = new Date();

                    let res = {
                        state: status.state,
                        uniqueid: status.uniqueid,
                        name: status.name,
                        localTimestamp: localDate.toString(),
                        timeStamp: localDate.toISOString()
                    }
                    writeToDb(res)
                })
            }
        })
    }
}

function writeToDb(data) {
    db.query(sql`INSERT INTO huex.light_status_log(status) VALUES (${data});`).then(
        results => console.log(results),
        err => console.error(err),
      );
}

module.exports.StatusCollectorService = StatusCollectorService