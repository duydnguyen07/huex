import cookieParser from "cookie-parser";
import express from "express";
import createError from "http-errors";
import logger from "morgan";
import path from "path";

import createConnection, { ConnectionPool, sql } from "@databases/pg";
import identityRouter from "./routes/identity";
import indexRouter from "./routes/index";
import { config } from "./services/config";
import { OnOffService } from "./services/on.off.service";
import { StatusCollectorService } from "./services/status.collector.service";

const dbConnection = createConnection(process.env.POSTGRES_URI);

const onOffService = new OnOffService(dbConnection);
onOffService.start();

const service = new StatusCollectorService(
  Number.parseInt(config.DATA_COLLECTION_INTERVAL, 10) || 900000,
  dbConnection
);
service.startCollectingData();

const app = express();

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "hbs");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/", indexRouter);
app.use("/identity", identityRouter);

// catch 404 and forward to error handler
app.use((req: any, res: any, next: any) => {
  next(createError(404));
});

// error handler
app.use((err: any, req: any, res: any, next: any) => {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;
