import { Router } from "express";
import * as Money from "./moneyController.js"

const router = Router();


router.route("/add").post(Money.add_money);
router.route("/detect").post(Money.detect_money);
router.route("/").get(Money.get_all_transaction_records);


export default router;