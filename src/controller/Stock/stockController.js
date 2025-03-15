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

export const buy_stocks = asyncHandler(async(req,res)=>{

})