import jwt from "jsonwebtoken";
import User from "../model/user.model.js";
import { apierror } from "../utils/apierror.js";
import asynchandler from "../utils/asynchandler.js";

export const verifyJWT = asynchandler(async (req, res, next) => {
    try {
        const token =
            req.cookies?.accessToken ||
            req.header("Authorization")?.replace("Bearer ", "");

        if (!token) {
            throw new apierror(401, "Unauthorized request: No access token provided");
        }

        const secret = process.env.ACCESS_SECRET || "apimonitor_jwt_access_secret_key_default";
        const decodedToken = jwt.verify(token, secret);

        const user = await User.findUserById(decodedToken?.id);
        if (!user) {
            throw new apierror(401, "Invalid Access Token: User not found");
        }

        req.user = user;
        next();
    } catch (error) {
        throw new apierror(401, error?.message || "Invalid or expired access token");
    }
});

export default verifyJWT;
