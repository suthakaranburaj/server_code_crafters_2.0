import { sendResponse } from "../../utils/apiResponse.js";
import statusType from "../../helper/enum/statusTypes.js";
import knex from "../../db/constrants.js";
import { asyncHandler } from "../../utils/asyncHandler.js";


export const userDashBoard = asyncHandler(async (req, res) => {
    const user = req.userInfo;
    const userId = user.user_id;

    if (user.role !== "USER") {
        return sendResponse(res, statusType.FORBIDDEN, "Access denied");
    }

    try {
        const [
            totalAmount,
            totalSpend,
            totalProfit,
            totalStocks,
            totalBonds,
            totalInsurance,
            stockReturns,
            bondReturns,
            stockLoss,
            bondLoss
        ] = await Promise.all([
            // Current Balance
            knex("user_amount")
                .where({ user_id: userId, is_current: true })
                .select("amount")
                .first(),

            // Total Amount Spent (all non-profit transactions)
            knex("user_amount")
                .where({ user_id: userId, profit: false })
                .sum("amount_spend as total")
                .first(),

            // Total Profit (all profit transactions)
            knex("user_amount")
                .where({ user_id: userId, profit: true })
                .sum("amount_spend as total")
                .first(),

            // Current Stock Investments
            knex("buy_stocks")
                .where({ user_id: userId, is_current: true, status: true })
                .sum("currentAmount as total")
                .first(),

            // Current Bond Investments
            knex("buy_bonds")
                .where({ user_id: userId, is_current: true, status: true })
                .sum(knex.raw("purchase_price * quantity as total"))
                .first(),

            // Total Insurance Premiums Paid
            knex("InsuranceRecord")
                .where({ user_id: userId })
                .sum("amount_deducted as total")
                .first(),

            // Stock Returns (positive profits)
            knex("stocks_records")
                .where("user_id", userId)
                .where("profit", ">", 0)
                .sum("profit as total")
                .first(),

            // Bond Returns (positive profits)
            knex("bonds_records")
                .where("user_id", userId)
                .where("profit", ">", 0)
                .sum("profit as total")
                .first(),

            // Stock Losses (negative profits)
            knex("stocks_records")
                .where("user_id", userId)
                .where("profit", "<", 0)
                .sum("profit as total")
                .first(),

            knex("bonds_records")
                .where("user_id", userId)
                .where("profit", "<", 0)
                .sum("profit as total")
                .first(),
        ]);

        const totalReturns = 
            (stockReturns.total || 0) + 
            (bondReturns.total || 0);

        const totalLoss = 
            Math.abs(stockLoss.total || 0) + 
            Math.abs(bondLoss.total || 0);

        const netWorth = 
            (totalAmount?.amount || 0) +
            (totalStocks.total || 0) +
            (totalBonds.total || 0);

        const responseData = {
            current_balance: totalAmount?.amount || 0,
            total_spend: totalSpend.total || 0,
            total_profit: totalProfit.total || 0,
            total_loss: totalLoss,
            investments: {
                stocks: totalStocks.total || 0,
                bonds: totalBonds.total || 0,
                insurance: totalInsurance.total || 0,
            },
            returns: {
                total: totalReturns,
                stocks: stockReturns.total || 0,
                bonds: bondReturns.total || 0,
            },
            net_worth: netWorth,
            active_insurance_policies: await knex("InsuranceApplication")
                .where({ user_id: userId, status: "APPROVED" })
                .count("application_id as count")
                .first(),
            active_investments: {
                stocks: await knex("buy_stocks")
                    .where({ user_id: userId, is_current: true })
                    .count("stock_id as count")
                    .first(),
                bonds: await knex("buy_bonds")
                    .where({ user_id: userId, is_current: true })
                    .count("bond_purchase_id as count")
                    .first(),
            }
        };

        return sendResponse(
            res,
            statusType.SUCCESS,
            responseData,
            "Dashboard data retrieved successfully"
        );
    } catch (error) {
        return sendResponse(
            res, 
            statusType.INTERNAL_SERVER_ERROR, 
            error.message
        );
    }
});