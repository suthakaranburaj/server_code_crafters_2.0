import { Router } from "express";
import * as Money from "./moneyController.js"

const router = Router();


router.route("/add").post(Money.add_money);
router.route("/detect").post(Money.detect_money);


export default router;