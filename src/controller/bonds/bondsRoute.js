import express from "express";
import * as Route from "./bondsController.js";

const router = express.Router();

// Define the route for fetching NSE data
router.post("/add", Route.addBond);
router.post("/buy", Route.buySellBonds);
router.get("/", Route.getHeldBonds);
router.get("/all", Route.get_available_bonds);
router.get("/bond", Route.get_bonds_records);

export default router;
