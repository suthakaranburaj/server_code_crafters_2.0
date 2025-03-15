import express from 'express';
import * as Route from './nifty50Controller.js';

const router = express.Router();

// Define the route for fetching NSE data
router.get('/nse-data', Route.getNseData);

export default router;