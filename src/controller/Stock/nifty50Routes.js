import express from 'express';
import { getNseData } from './nifty50Controller.js';

const router = express.Router();

// Define the route for fetching NSE data
router.get('/nse-data', getNseData);

export default router;