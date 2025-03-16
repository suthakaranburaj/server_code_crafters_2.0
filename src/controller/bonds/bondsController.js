import { sendResponse } from "../../utils/apiResponse.js";
import statusType from "../../helper/enum/statusTypes.js";
import knex from "../../db/constrants.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const addBond = asyncHandler(async (req, res) => {
    const user = req.userInfo;
    const { name, description, face_value, coupon_rate, total_amount, maturity_date } = req.body;

    if (user.role !== "COMPANY") {
        return sendResponse(res, statusType.FORBIDDEN, "Only companies can create bonds");
    }

    if (!name || !face_value || !coupon_rate || !total_amount || !maturity_date) {
        return sendResponse(res, statusType.BAD_REQUEST, "Missing required fields");
    }

    try {
        const [bond] = await knex.transaction(async (trx) => {
            const newBond = await trx("Bond")
                .insert({
                    company_id: user.user_id,
                    name,
                    description,
                    face_value,
                    coupon_rate,
                    total_amount,
                    remaining: total_amount,
                    maturity_date,
                    status: true,
                    createdAt: knex.fn.now(),
                    updatedAt: knex.fn.now()
                })
                .returning("*");
            return newBond;
        });
        return sendResponse(res, statusType.CREATED, bond, "Bond created successfully");
    } catch (error) {
        return sendResponse(res, statusType.INTERNAL_SERVER_ERROR, error.message);
    }
});

export const buySellBonds = asyncHandler(async (req, res) => {
    const user = req.userInfo;
    const { type, bond_id, quantity, price } = req.body;

    if (type === "buy" && (!bond_id || !quantity)) {
        return sendResponse(res, statusType.BAD_REQUEST, "Missing bond_id or quantity");
    } else if (type === "sell" && (!bond_id || !quantity || !price)) {
        return sendResponse(res, statusType.BAD_REQUEST, "Missing required fields for sell");
    } else if (type !== "buy" && type !== "sell") {
        return sendResponse(res, statusType.BAD_REQUEST, "Invalid transaction type");
    }

    try {
        await knex.transaction(async (trx) => {
            if (type === "buy") {
                const bond = await trx("Bond").where({ bond_id, status: true }).first();

                if (!bond) throw new Error("Bond not found or inactive");
                if (bond.remaining < quantity) throw new Error("Insufficient bonds available");

                const totalCost = quantity * bond.face_value;

                const [currentBalance] = await trx("user_amount").where({
                    user_id: user.user_id,
                    is_current: true,
                    status: true
                });

                if (!currentBalance || currentBalance.amount < totalCost) {
                    throw new Error("Insufficient balance");
                }

                // Update user balance
                await trx("user_amount")
                    .where({ user_amount_id: currentBalance.user_amount_id })
                    .update({ is_current: false, status: false });

                const newBalance = currentBalance.amount - totalCost;
                await trx("user_amount").insert({
                    user_id: user.user_id,
                    amount: newBalance,
                    status: true,
                    is_current: true,
                    createdAt: knex.fn.now(),
                    updatedAt: knex.fn.now()
                });

                // Update bond remaining
                await trx("Bond").where({ bond_id }).decrement("remaining", quantity);

                // Update or create buy_bonds entry
                const [existing] = await trx("buy_bonds").where({
                    user_id: user.user_id,
                    bond_id,
                    is_current: true,
                    status: true
                });

                if (existing) {
                    const totalQty = existing.quantity + quantity;
                    const avgPrice = Math.round(
                        (existing.purchase_price * existing.quantity + totalCost) / totalQty
                    );
                    await trx("buy_bonds")
                        .where({ bond_purchase_id: existing.bond_purchase_id })
                        .update({ quantity: totalQty, purchase_price: avgPrice });
                } else {
                    await trx("buy_bonds").insert({
                        user_id: user.user_id,
                        bond_id,
                        quantity,
                        purchase_price: bond.face_value,
                        is_current: true,
                        status: true,
                        createdAt: knex.fn.now(),
                        updatedAt: knex.fn.now()
                    });
                }

                // Record transaction
                await trx("bonds_records").insert({
                    user_id: user.user_id,
                    bond_id,
                    type: "buy",
                    quantity,
                    price: bond.face_value,
                    amount_spend: totalCost,
                    profit: 0,
                    createdAt: knex.fn.now(),
                    updatedAt: knex.fn.now()
                });
            } else {
                const [holding] = await trx("buy_bonds").where({
                    user_id: user.user_id,
                    bond_id,
                    is_current: true,
                    status: true
                });

                if (!holding || holding.quantity < quantity) {
                    throw new Error("Insufficient bonds to sell");
                }

                const proceeds = quantity * price;
                const costBasis = holding.purchase_price * quantity;
                const profit = proceeds - costBasis;

                // Update user balance
                const [currentBalance] = await trx("user_amount").where({
                    user_id: user.user_id,
                    is_current: true,
                    status: true
                });

                await trx("user_amount")
                    .where({ user_amount_id: currentBalance.user_amount_id })
                    .update({ is_current: false, status: false });

                const newBalance = currentBalance.amount + proceeds;
                await trx("user_amount").insert({
                    user_id: user.user_id,
                    amount: newBalance,
                    status: true,
                    is_current: true,
                    createdAt: knex.fn.now(),
                    updatedAt: knex.fn.now()
                });

                // Update holdings
                const newQty = holding.quantity - quantity;
                if (newQty === 0) {
                    await trx("buy_bonds")
                        .where({ bond_purchase_id: holding.bond_purchase_id })
                        .update({ quantity: 0, is_current: false, status: false });
                } else {
                    await trx("buy_bonds")
                        .where({ bond_purchase_id: holding.bond_purchase_id })
                        .update({ quantity: newQty });
                }

                // Record transaction
                await trx("bonds_records").insert({
                    user_id: user.user_id,
                    bond_id,
                    type: "sell",
                    quantity,
                    price,
                    amount_spend: costBasis,
                    profit,
                    createdAt: knex.fn.now(),
                    updatedAt: knex.fn.now()
                });
            }
        });
        return sendResponse(res, statusType.SUCCESS, `Bond ${type} successful`);
    } catch (error) {
        return sendResponse(res, statusType.BAD_REQUEST, error.message);
    }
});

export const getHeldBonds = asyncHandler(async (req, res) => {
    const user = req.userInfo;
    const holdings = await knex("buy_bonds").where({
        user_id: user.user_id,
        is_current: true,
        status: true
    });
    return sendResponse(res, statusType.SUCCESS, holdings, "Held bonds fetched");
});

export const get_available_bonds = asyncHandler(async (req, res) => {
    try {
        const availableBonds = await knex("Bond")
            .join("user", "Bond.company_id", "user.user_id")
            .select("Bond.*", "user.name as company_name")
            .where("Bond.status", true)
            .andWhere("Bond.remaining", ">", 0)
            .andWhere("Bond.maturity_date", ">", knex.fn.now());

        return sendResponse(
            res,
            statusType.SUCCESS,
            availableBonds,
            "Available bonds fetched successfully"
        );
    } catch (error) {
        return sendResponse(res, statusType.INTERNAL_SERVER_ERROR, error.message);
    }
});

export const get_bonds_records = asyncHandler(async (req, res) => {
    const user = req.userInfo;

    // Verify user is a COMPANY with bonds enabled
    if (user.role !== "COMPANY" || !user.bonds) {
        return sendResponse(
            res,
            statusType.FORBIDDEN,
            "Only bond-issuing companies can access these records"
        );
    }

    try {
        // Get all bond records associated with the company's bonds
        const bondRecords = await knex("bonds_records")
            .join("Bond", "bonds_records.bond_id", "Bond.bond_id")
            .where("Bond.company_id", user.user_id)
            .select(
                "bonds_records.*",
                "Bond.name as bond_name",
                "Bond.face_value",
                "Bond.coupon_rate"
            );

        return sendResponse(
            res,
            statusType.SUCCESS,
            bondRecords,
            "Bond transaction records retrieved successfully"
        );
    } catch (error) {
        return sendResponse(res, statusType.INTERNAL_SERVER_ERROR, error.message);
    }
});