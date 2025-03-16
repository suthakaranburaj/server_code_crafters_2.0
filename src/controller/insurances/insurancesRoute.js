import express from "express";
import * as Route from "./insurancesController.js";

const router = express.Router();

// Define the route for fetching NSE data
router.post("/create", Route.createInsurance);
router.post("/apply", Route.applyForInsurance);
router.get("/applications", Route.getUserApplications);
router.get("/company/applications", Route.getCompanyApplications);
router.post("/:applicationId", Route.handleApplicationDecision);
// router.post("/apply", Route.);

export default router;
