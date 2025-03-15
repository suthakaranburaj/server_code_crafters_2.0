import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { verifyToken } from "./middleware/verifyToken.js";

import userRouter from "./controller/User/userRoutes.js";
import stockRouter from "./controller/Stock/nifty50Routes.js";
import moneyRouter from './controller/money/moneyRoute.js';
import buySellStock from './controller/Stock/stockRoute.js';
// import chatRoute from "./controllers/Chat/chatRoute";
// import loginRoute from "./controllers/Login/loginRoute";

const app = express();

dotenv.config({
    path: "./.env"
});

app.use(
    cors({
        origin: [
            `http://localhost:${process.env.CLIENT_ORIGIN_PORT}`,
            "http://localhost:5174",
            `http://localhost:5173`
        ],
        credentials: true
    })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

app.use("/api/v1/user", userRouter);


app.use("/api/v1/stock", stockRouter);
app.use(verifyToken);
app.use("/api/v1/money", moneyRouter);
app.use("/api/v1/stocks", buySellStock);
// app.use("/api/v1/chat", chatRoute);
// app.use("/api/v1/login", loginRoute);

export default app;
