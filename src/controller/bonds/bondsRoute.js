import express from "express";
import * as Route from "./bondsController.js";

const router = express.Router();

// Define the route for fetching NSE data
router.post("/add", Route.addBond);
router.post("/buy", Route.buySellBonds);
router.get("/", Route.getHeldBonds);

export default router;
