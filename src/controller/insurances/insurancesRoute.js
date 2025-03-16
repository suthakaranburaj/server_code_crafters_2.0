import express from "express";
import * as Route from "./insurancesController.js";

const router = express.Router();

// Define the route for fetching NSE data
router.post("/create", Route.createInsurance);
router.get("/", Route.getInsurances);

export default router;
