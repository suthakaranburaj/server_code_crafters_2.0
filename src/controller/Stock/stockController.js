import { sendResponse } from "../../utils/apiResponse.js";
import statusType from "../../helper/enum/statusTypes.js";
import knex from "../../db/constrants.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const buy_sell_stocks = asyncHandler(async (req, res) => {
    const user = req.userInfo;
    const { type, company_name, quantity, currentAmount } = req.body;

    if (!type || !company_name || !quantity || !currentAmount) {
        return sendResponse(res, statusType.BAD_REQUEST, "Missing required fields");
    }

    if (type !== "buy" && type !== "sell") {
        return sendResponse(res, statusType.BAD_REQUEST, "Invalid transaction type");
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
        return sendResponse(res, statusType.BAD_REQUEST, "Quantity must be a positive integer");
    }

    if (!Number.isInteger(currentAmount) || currentAmount <= 0) {
        return sendResponse(
            res,
            statusType.BAD_REQUEST,
            "currentAmount must be a positive integer"
        );
    }

    try {
        const [currentUserAmount] = await knex("user_amount")
            .where({
                user_id: user.user_id,
                is_current: true,
                status: true
            })
            .select("*");

        if (!currentUserAmount) {
            return sendResponse(res, statusType.BAD_REQUEST, "User balance not found");
        }

        // Transaction handler
        await knex.transaction(async (trx) => {
            if (type === "buy") {
                const totalCost = quantity * currentAmount;

                if (currentUserAmount.amount < totalCost) {
                    throw new Error("Insufficient balance");
                }

                // Check existing stock
                const [existingStock] = await trx("buy_stocks")
                    .where({
                        user_id: user.user_id,
                        company_name: company_name,
                        is_current: true,
                        status: true
                    })
                    .select("*");

                if (existingStock) {
                    const newQuantity = existingStock.quantity + quantity;
                    const totalValue =
                        existingStock.quantity * existingStock.currentAmount + totalCost;
                    const newCurrentAmount = Math.round(totalValue / newQuantity);

                    await trx("buy_stocks").where({ stock_id: existingStock.stock_id }).update({
                        quantity: newQuantity,
                        currentAmount: newCurrentAmount,
                        updatedAt: knex.fn.now()
                    });
                } else {
                    await trx("buy_stocks").insert({
                        user_id: user.user_id,
                        company_name: company_name,
                        quantity: quantity,
                        currentAmount: currentAmount,
                        is_current: true,
                        status: true,
                        createdAt: knex.fn.now(),
                        updatedAt: knex.fn.now()
                    });
                }

                // Update user balance
                const newBalance = currentUserAmount.amount - totalCost;
                await trx("user_amount")
                    .where({ user_amount_id: currentUserAmount.user_amount_id })
                    .update({ is_current: false ,status:false});

                await trx("user_amount").insert({
                    user_id: user.user_id,
                    amount: newBalance,
                    status: true,
                    is_current: true,
                    createdAt: knex.fn.now(),
                    updatedAt: knex.fn.now()
                });
            } else {
                // Sell logic
                const [existingStock] = await trx("buy_stocks")
                    .where({
                        user_id: user.user_id,
                        company_name: company_name,
                        is_current: true,
                        status: true
                    })
                    .select("*");

                if (!existingStock || existingStock.quantity < quantity) {
                    throw new Error("Insufficient stocks to sell");
                }

                const proceeds = quantity * currentAmount;
                const newQuantity = existingStock.quantity - quantity;

                // Update stock entry
                if (newQuantity === 0) {
                    await trx("buy_stocks").where({ stock_id: existingStock.stock_id }).update({
                        quantity: 0,
                        is_current: false,
                        status:1,
                        updatedAt: knex.fn.now()
                    });
                } else {
                    await trx("buy_stocks").where({ stock_id: existingStock.stock_id }).update({
                        quantity: newQuantity,
                        updatedAt: knex.fn.now()
                    });
                }

                // Update user balance
                const newBalance = currentUserAmount.amount + proceeds;
                await trx("user_amount")
                    .where({ user_amount_id: currentUserAmount.user_amount_id })
                    .update({ is_current: false,status:false });

                await trx("user_amount").insert({
                    user_id: user.user_id,
                    amount: newBalance,
                    status: true,
                    is_current: true,
                    createdAt: knex.fn.now(),
                    updatedAt: knex.fn.now()
                });
            }
        });

        return sendResponse(res, statusType.OK, `Stocks ${type} operation successful`);
    } catch (error) {
        return sendResponse(res, statusType.BAD_REQUEST, error.message);
    }
});
