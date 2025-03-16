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

export const detect_money = asyncHandler(async (req, res) => {
    const userInfo = req.userInfo;
    const { money } = req.body;

    const current_add_money = await knex("user_amount")
        .select("*")
        .where({
            user_id: userInfo.user_id,
            status: 1,
            is_current: 1
        })
        .first();

    if (!current_add_money) {
        return sendResponse(res, false, null, "No active balance found", 404);
    }

    const current_balance = current_add_money.amount - money;
    if (current_balance < 0) {
        return sendResponse(res, false, null, "Insufficient balance", 400);
    }

    await knex("user_amount")
        .update({
            status: 0,
            is_current: 0
        })
        .where({
            user_id: userInfo.user_id,
            status: 1,
            is_current: 1
        });

    const insert_balance = await knex("user_amount").insert({
        user_id: userInfo.user_id,
        is_current: 1,
        amount: current_balance,
        status: 1
    });

    if (!insert_balance) {
        return sendResponse(res, false, null, "Failed to add money", 400);
    }
    // await knex("user")
    //     .update("user.amount", current_balance)
    //     .where({ "user.status": 1, "user.user_id": userInfo.user_id });
    return sendResponse(
        res,
        true,
        { new_balance: current_balance },
        "Money updated successfully",
        200
    );
});

export const add_money = asyncHandler(async (req, res) => {
    const userInfo = req.userInfo;
    const { money } = req.body;

    // Validate input amount
    if (isNaN(money) || money <= 0) {
        return sendResponse(res, false, null, "Invalid amount provided", 400);
    }

    const currentEntry = await knex("user_amount")
        .select("*")
        .where({
            user_id: userInfo.user_id,
            status: 1,
            is_current: 1
        })
        .first();

    let newAmount = money;

    // If existing balance found
    if (currentEntry) {
        // Calculate new balance
        newAmount = currentEntry.amount + money;

        // Deactivate previous entry
        await knex("user_amount")
            .update({
                status: 0,
                is_current: 0
            })
            .where({
                user_amount_id: currentEntry.user_amount_id
            });
    }

    const insertResult = await knex("user_amount").insert({
        user_id: userInfo.user_id,
        amount: newAmount,
        status: 1,
        is_current: 1
    });

    if (!insertResult) {
        return sendResponse(res, false, null, "Failed to add money", 400);
    }

    return sendResponse(res, true, { new_balance: newAmount }, "Money added successfully", 200);
});

export const get_all_transaction_records = asyncHandler(async (req, res) => {
    const userInfo = req.userInfo;
    // const { type } = req.params
    console.log(userInfo);
    const transactions = await knex("user_amount")
        .select("*")
        .where({
            user_id: userInfo.user_id,
            status: 0,
            is_current: 0,
        })
        .orderBy("createdAt", "desc");

    if (transactions.length === 0) {
        return sendResponse(res, true, [], "No historical transactions found", 200);
    }

    return sendResponse(res, true, transactions, "Transaction history retrieved successfully", 200);
});
