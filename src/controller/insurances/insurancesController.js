import { sendResponse } from "../../utils/apiResponse.js";
import statusType from "../../helper/enum/statusTypes.js";
import knex from "../../db/constrants.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import cron from "node-cron";
import axios from "axios";

export const createInsurance = asyncHandler(async (req, res) => {
    const user = req.userInfo;
    const { name, description, coverage_amount, premium_amount, start_date, end_date } = req.body;

    if (!name || !coverage_amount || !premium_amount || !start_date || !end_date) {
        return sendResponse(res, statusType.BAD_REQUEST, "Missing required fields");
    }

    if (!user.insurances) {
        return sendResponse(
            res,
            statusType.BAD_REQUEST,
            null,
            "Company is not registered for insurances"
        );
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

export const getAllInsurances = asyncHandler(async (req, res) => {
    const user = req.userInfo;

    // if (user.insurances) {
    //     return sendResponse(
    //         res,
    //         statusType.BAD_REQUEST,
    //         null,
    //         "Company is not allowed"
    //     );
    // }

    try {
        const insurances = await knex("Insurance").select("*");

        return sendResponse(
            res,
            statusType.SUCCESS,
            insurances,
            "Insurances retrieved successfully"
        );
    } catch (error) {
        return sendResponse(res, statusType.BAD_REQUEST, error.message);
    }
});

export const applyForInsurance = asyncHandler(async (req, res) => {
    const user = req.userInfo;
    const {
        insurance_id,
        age,
        gender,
        height,
        weight,
        smoking_status,
        cigarettes_per_day,
        alcohol_consumption,
        physical_activity,
        dietary_habits,
        occupation
    } = req.body;

    if (!insurance_id) {
        return sendResponse(res, statusType.BAD_REQUEST, "Insurance ID is required");
    }
    //localhost:8000/risk/predict
    // console.log(req.body)
    if (user.role !== "USER") {
        return sendResponse(
            res,
            statusType.FORBIDDEN,
            "Only regular users can apply for insurance"
        );
    }

    try {
        // Check insurance exists and is active
        const insurance = await knex("Insurance")
            .where({
                insurance_id,
                status: true
            })
            .first();

        if (!insurance) {
            return sendResponse(res, statusType.NOT_FOUND, "Active insurance policy not found");
        }

        // Check for existing application
        const existingApplication = await knex("InsuranceApplication")
            .where({
                user_id: user.user_id,
                insurance_id,
                status: "PENDING"
            })
            .first();

        if (existingApplication) {
            return sendResponse(
                res,
                statusType.BAD_REQUEST,
                "You already have a pending application for this policy"
            );
        }
        console.log("heee");
        const riskResponse = await axios.post("http://localhost:8000/risk/predict/", {
            age,
            gender,
            height,
            weight,
            smoking_status,
            cigarettes_per_day,
            alcohol_consumption,
            physical_activity,
            dietary_habits,
            occupation
        });

        const failRate = riskResponse.data.risk_percentage;
        console.log(failRate);

        const [application] = await knex("InsuranceApplication")
            .insert({
                user_id: user.user_id,
                insurance_id,
                status: "PENDING",
                createdAt: knex.fn.now(),
                updatedAt: knex.fn.now(),
                failRate: failRate
            })
            .returning("*");

        return sendResponse(
            res,
            statusType.SUCCESS,
            application,
            "Insurance application submitted successfully"
        );
    } catch (error) {
        return sendResponse(res, statusType.BAD_REQUEST, error.message);
    }
});

export const getUserApplications = asyncHandler(async (req, res) => {
    const user = req.userInfo;

    const applications = await knex("InsuranceApplication")
        .leftJoin("Insurance", "InsuranceApplication.insurance_id", "Insurance.insurance_id")
        .where({
            "InsuranceApplication.status": "PENDING",
            "Insurance.user_id": user.user_id // company's user_id
        })
        .select("*");

    return sendResponse(
        res,
        statusType.SUCCESS,
        applications,
        "Applications retrieved successfully"
    );
});

export const getCompanyApplications = asyncHandler(async (req, res) => {
    const user = req.userInfo;

    if (user.role !== "COMPANY" || !user.insurances) {
        return sendResponse(
            res,
            statusType.FORBIDDEN,
            "Not authorized to view insurance applications"
        );
    }

    const applications = await knex("InsuranceApplication")
        .whereIn(
            "insurance_id",
            knex("Insurance").where("user_id", user.user_id).select("insurance_id")
        )
        .select("*");

    return sendResponse(
        res,
        statusType.SUCCESS,
        applications,
        "Company applications retrieved successfully"
    );
});

export const handleApplicationDecision = asyncHandler(async (req, res) => {
    const user = req.userInfo;
    const { applicationId } = req.params;
    const { status, reason } = req.body;

    if (!["APPROVED", "DISAPPROVED"].includes(status)) {
        return sendResponse(res, statusType.BAD_REQUEST, "Invalid decision status");
    }

    try {
        // Verify company owns the insurance policy
        const application = await knex("InsuranceApplication")
            .where("application_id", applicationId)
            .first();

        if (!application) {
            return sendResponse(res, statusType.NOT_FOUND, "Application not found");
        }

        const insurance = await knex("Insurance")
            .where({
                insurance_id: application.insurance_id,
                user_id: user.user_id
            })
            .first();

        if (!insurance) {
            return sendResponse(
                res,
                statusType.FORBIDDEN,
                "Not authorized to modify this application"
            );
        }

        // Update application status
        const [updatedApplication] = await knex("InsuranceApplication")
            .where("application_id", applicationId)
            .update({
                status,
                reason,
                decision_date: knex.fn.now(),
                updatedAt: knex.fn.now()
            })
            .returning("*");

        return sendResponse(
            res,
            statusType.SUCCESS,
            updatedApplication,
            "Application decision updated successfully"
        );
    } catch (error) {
        return sendResponse(res, statusType.BAD_REQUEST, error.message);
    }
});

cron.schedule("*/20 * * * *", async () => {
    try {
        const currentDate = new Date();

        const activeApplications = await knex("InsuranceApplication")
            .where("status", "APPROVED")
            .whereIn(
                "insurance_id",
                knex("Insurance")
                    .where({
                        is_approved: true,
                        status: true
                    })
                    .where("start_date", "<=", currentDate)
                    .where("end_date", ">=", currentDate)
                    .select("insurance_id")
            )
            .select("*");

        for (const application of activeApplications) {
            await knex.transaction(async (trx) => {
                // Get user's current balance
                const [currentBalance] = await trx("user_amount")
                    .where({
                        user_id: application.user_id,
                        is_current: true,
                        status: true
                    })
                    .select("*");

                if (!currentBalance || currentBalance.amount < application.premium_amount) {
                    console.log(`Insufficient balance for user ${application.user_id}`);
                    return;
                }

                // Update user balance
                const newBalance = currentBalance.amount - application.premium_amount;

                await trx("user_amount")
                    .where("user_amount_id", currentBalance.user_amount_id)
                    .update({
                        is_current: false,
                        status: false
                    });

                await trx("user_amount").insert({
                    user_id: application.user_id,
                    amount: newBalance,
                    status: true,
                    is_current: true,
                    type: "insurance",
                    amount_spend: application.premium_amount,
                    profit: false,
                    createdAt: knex.fn.now(),
                    updatedAt: knex.fn.now()
                });

                // Create insurance deduction record
                await trx("insurance_records").insert({
                    insurance_id: application.insurance_id,
                    user_id: application.user_id,
                    amount_deducted: application.premium_amount,
                    createdAt: knex.fn.now(),
                    updatedAt: knex.fn.now()
                });

                console.log(
                    `Deducted ${application.premium_amount} from user ${application.user_id}`
                );
            });
        }
    } catch (error) {
        console.error("Insurance deduction error:", error);
    }
});
export const getInsurances = asyncHandler(async (req, res) => {
    const user = req.userInfo;

    if (user.role === "COMPANY") {
        const insurances = await knex("Insurance").where({ user_id: user.user_id }).select("*");

        return sendResponse(res, statusType.SUCCESS, insurances, "Insurances fetched successfully");
    } else {
        const insurances = await knex("InsuranceApplication")
            .where({ "InsuranceApplication.user_id": user.user_id })
            .select(
                "InsuranceApplication.*",
                "Insurance.name as company_name",
                "Insurance.coverage_amount as coverage_amount",
                "Insurance.premium_amount as premium_amount",
                "Insurance.start_date as start_date",
                "Insurance.end_date as end_date"
            )
            .leftJoin("Insurance", "InsuranceApplication.insurance_id", "Insurance.insurance_id");

        return sendResponse(res, statusType.SUCCESS, insurances, "Insurances fetched successfully");
    }
});

export const updateApplication = asyncHandler(async (req, res) => {
    // const user = req.userInfo;
    const { application_id, status } = req.body;

    console.log(req.body);

    // Validate application_id
    if (!application_id || isNaN(application_id)) {
        return sendResponse(res, statusType.BAD_REQUEST, null, "Invalid application ID");
    }

    await knex("InsuranceApplication")
        .update({ status: status })
        .where({ application_id: Number(application_id) }); // Ensure it's a number

    return sendResponse(res, statusType.SUCCESS, null, "Application updated successfully");
});
