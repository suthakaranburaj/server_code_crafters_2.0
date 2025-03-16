import express from "express";
import * as Route from "./DashboadController.js";

const router = express.Router();

// Define the route for fetching NSE data
router.get("/", Route.userDashBoard);

// router.post("/apply", Route.);

export default router;
