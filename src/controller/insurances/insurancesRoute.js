import express from "express";
import * as Route from "./insurancesController.js";

const router = express.Router();

// Define the route for fetching NSE data
router.post("/create", Route.createInsurance);
router.post("/apply", Route.applyForInsurance);
router.get("/applications", Route.getUserApplications);
router.get("/company/applications", Route.getCompanyApplications);
router.post("/:applicationId", Route.handleApplicationDecision);
router.get("/", Route.getInsurances);
router.post("/save/update", Route.updateApplication);
router.get("/getAll", Route.getAllInsurances);
// router.post("/apply", Route.);

export default router;
