import express from "express";
import * as Route from "./stockController.js";

const router = express.Router();

// Define the route for fetching NSE data
router.post("/buy-sell-stocks", Route.buy_sell_stocks);
router.get("/", Route.get_all_stocks_records);
router.get("/holding", Route.get_holding_stocks);

export default router;
