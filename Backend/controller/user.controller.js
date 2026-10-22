import User from "../model/user.model.js";
import { apierror } from "../utils/apierror.js";
import { apires } from "../utils/apires.js";
import asynchandler from "../utils/asynchandler.js";

const generateAccessTokenandRefreshToken = async (userId) => {
    try {
        const user = await User.findUserById(userId);
        if (!user) throw new apierror(404, "User not found");
        const accessToken = User.generateAccessToken(user);
        const refreshToken = User.generateRefreshToken(user);
        await User.updateRefreshToken(user.id, refreshToken);
        return { accessToken, refreshToken };
    } catch (error) {
        throw new apierror(error.statuscode || 500, error.message);
    }
};

const registerUser = asynchandler(async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        throw new apierror(400, "Name, email, and password are required");
    }

    const existUser = await User.findUserByEmail(email);
    if (existUser) throw new apierror(409, "User with this email already exists");

    const data = await User.createUser(name, email, password);
    const { accessToken, refreshToken } = await generateAccessTokenandRefreshToken(data.id);

    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
    };

    return res.status(201)
        .cookie("accessToken", accessToken, cookieOptions)
        .cookie("refreshToken", refreshToken, cookieOptions)
        .json(new apires(201, "User registered successfully", {
            user: data,
            accessToken,
            refreshToken
        }));
});

const loginUser = asynchandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        throw new apierror(400, "Email and password are required");
    }

    const user = await User.findUserByEmail(email);
    if (!user) throw new apierror(401, "Invalid email or password");

    const isPasswordMatch = await User.comparePassword(password, user.password);
    if (!isPasswordMatch) throw new apierror(401, "Invalid email or password");

    const { accessToken, refreshToken } = await generateAccessTokenandRefreshToken(user.id);
    const loggedUser = await User.findUserById(user.id);

    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
    };

    return res.status(200)
        .cookie("accessToken", accessToken, cookieOptions)
        .cookie("refreshToken", refreshToken, cookieOptions)
        .json(new apires(200, "User logged in successfully", {
            user: loggedUser,
            accessToken,
            refreshToken
        }));
});

const getCurrentUser = asynchandler(async (req, res) => {
    const user = await User.findUserById(req.user.id);
    if (!user) throw new apierror(404, "User not found");
    return res.status(200).json(new apires(200, "Current user fetched successfully", user));
});

const logoutUser = asynchandler(async (req, res) => {
    if (req.user?.id) {
        await User.updateRefreshToken(req.user.id, null);
    }
    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
    };
    return res.status(200)
        .clearCookie("accessToken", cookieOptions)
        .clearCookie("refreshToken", cookieOptions)
        .json(new apires(200, "User logged out successfully", null));
});

const deleteUser = asynchandler(async (req, res) => {
    const user = await User.findUserById(req.user.id);
    if (!user) throw new apierror(404, "User not found");
    await User.deleteUserById(req.user.id);
    return res.status(200).json(new apires(200, "User deleted successfully", user));
});

const UpdateUser = asynchandler(async (req, res) => {
    const currUser = await User.findUserById(req.user.id);
    if (!currUser) throw new apierror(404, "User not found");
    await User.updateUserById(req.user.id, req.body.name, req.body.email);
    const updatedUser = await User.findUserById(req.user.id);
    return res.status(200).json(new apires(200, "User updated successfully", updatedUser));
});

export default {
    registerUser,
    loginUser,
    getCurrentUser,
    logoutUser,
    deleteUser,
    UpdateUser
};