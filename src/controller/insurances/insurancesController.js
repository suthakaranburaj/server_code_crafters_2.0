import { sendResponse } from "../../utils/apiResponse.js";
import statusType from "../../helper/enum/statusTypes.js";
import knex from "../../db/constrants.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import cron from "node-cron";

// Create Insurance Policy
export const createInsurance = asyncHandler(async (req, res) => {
    const user = req.userInfo;
    const { name, description, coverage_amount, premium_amount, start_date, end_date } = req.body;

    if (!name || !coverage_amount || !premium_amount || !start_date || !end_date) {
        return sendResponse(res, statusType.BAD_REQUEST, "Missing required fields");
    }

    if(!user.insurances){
      return sendResponse(res,statusType.BAD_REQUEST,null,"Company is not registered for insurances")
    }

    try {
        const [insurance] = await knex("Insurance")
            .insert({
                user_id: user.user_id,
                name,
                description,
                coverage_amount,
                premium_amount,
                start_date: new Date(start_date),
                end_date: new Date(end_date),
                is_approved: false,
                status: true,
                createdAt: knex.fn.now(),
                updatedAt: knex.fn.now()
            })
            .returning("*");

        return sendResponse(
            res,
            statusType.SUCCESS,
            insurance,
            "Insurance policy created successfully"
        );
    } catch (error) {
        return sendResponse(res, statusType.BAD_REQUEST, error.message);
    }
});

// Get User's Insurance Policies
export const getInsurances = asyncHandler(async (req, res) => {
    const user = req.userInfo;

    const insurances = await knex("Insurance").where({ user_id: user.user_id }).select("*");

    return sendResponse(res, statusType.SUCCESS, insurances, "Insurances fetched successfully");
});

// Scheduled Insurance Deduction (Run every 20 minutes)
cron.schedule("*/20 * * * *", async () => {
    try {
        const currentDate = new Date();

        const activeInsurances = await knex("Insurance")
            .where({
                is_approved: true,
                status: true
            })
            .where("start_date", "<=", currentDate)
            .where("end_date", ">=", currentDate)
            .select("*");

        for (const insurance of activeInsurances) {
            await knex.transaction(async (trx) => {
                // Get current user balance
                const [currentUserAmount] = await trx("user_amount")
                    .where({
                        user_id: insurance.user_id,
                        is_current: true,
                        status: true
                    })
                    .select("*");

                if (!currentUserAmount || currentUserAmount.amount < insurance.premium_amount) {
                    console.log(
                        `Insufficient balance for insurance deduction: ${insurance.insurance_id}`
                    );
                    return;
                }

                // Update user balance
                const newBalance = currentUserAmount.amount - insurance.premium_amount;

                await trx("user_amount")
                    .where({ user_amount_id: currentUserAmount.user_amount_id })
                    .update({ is_current: false, status: false });

                await trx("user_amount").insert({
                    user_id: insurance.user_id,
                    amount: newBalance,
                    status: true,
                    is_current: true,
                    type: "insurance",
                    amount_spend: insurance.premium_amount,
                    profit: false,
                    createdAt: knex.fn.now(),
                    updatedAt: knex.fn.now()
                });

                // Create insurance record
                await trx("insurance_records").insert({
                    insurance_id: insurance.insurance_id,
                    user_id: insurance.user_id,
                    amount_deducted: insurance.premium_amount,
                    createdAt: knex.fn.now(),
                    updatedAt: knex.fn.now()
                });

                console.log(
                    `Deducted ${insurance.premium_amount} for insurance ${insurance.insurance_id}`
                );
            });
        }
    } catch (error) {
        console.error("Insurance deduction error:", error);
    }
});

