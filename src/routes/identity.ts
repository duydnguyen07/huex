import * as express from "express";
const router = express.Router();

/* GET users listing. */
router.get("/", (req: any, res: any, next: any) => {
  res.send("My name is xeuh");
});

export default router;
