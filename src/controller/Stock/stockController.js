import { sendResponse } from "../../utils/apiResponse.js"; //
import statusType from "../../helper/enum/statusTypes.js";
import knex from "../../db/constrants.js";
import {
    getIntOrNull,
    getObjOrNull,
    checkExists,
    getOneOrZero
} from "../../helper/CommonHelper.js";
import bcrypt from "bcryptjs";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const buy_sell_stocks = asyncHandler(async (req, res) => {
    const user = req.userInfo;
    const { type, company_name, quantity, currentAmount } = req.body;

    const [past_stocks_same] = await knex("buy_stocks").select("*").where({
        "buy_stocks.user_id": user.user_id,
        "buy_stocks.company_name": company_name,
        "buy_stocks.status": 1,
        "buy_stocks.is_current": 1
    });

    if (past_stocks_same) {
        const q = past_stocks_same.quantity;
        const c = past_stocks_same.currentAmount;

    }
});
