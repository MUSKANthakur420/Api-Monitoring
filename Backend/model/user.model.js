import pool from "../config/db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { apierror } from "../utils/apierror.js";
const createUser=async(name,email,password)=>{
    const hashPassword=await bcrypt.hash(password,10);
    const result=await pool.query(
        `INSERT INTO users (name, email, password)
         VALUES ($1, $2, $3)
         RETURNING id, name, email`,
        [name, email, hashPassword]
    );
    return result.rows[0];
};
const findUserByEmail=async(email)=>{
    const result=await pool.query(
        `SELECT * FROM users WHERE email = $1`,[email]
    );
    return result.rows[0];
}
const findUserById=async(id)=>{
    const result=await pool.query(
        `SELECT id,name,email FROM users WHERE id = $1`,[id]
    );
    return result.rows[0];
}
const updateRefreshToken = async (id, refreshToken) => {
    await pool.query(
        `UPDATE users SET refresh_token = $1 WHERE id = $2`,
        [refreshToken, id]
    );
};
const updateUserById = async (id, name, email) => {
    const result = await pool.query(
        `UPDATE users 
         SET name = COALESCE($1, name),
             email = COALESCE($2, email),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 
         RETURNING id, name, email`,
        [name || null, email || null, id]
    );
    return result.rows[0];
};
const updatePasswordById=async(id,password)=>{
    const hashPassword=await bcrypt.hash(password,10);
    const result=await pool.query(
        `UPDATE users SET password=$1 WHERE id=$2 RETURNING id,name,email`,
        [hashPassword,id]
    );
    return result.rows[0];
}
const deleteUserById=async(id)=>{
    const result=await pool.query(
        `DELETE FROM users WHERE id=$1 RETURNING id,name,email`,
        [id]
    );
    return result.rows[0];
}
const comparePassword=async(password,hashPassword)=>{
   return await bcrypt.compare(password,hashPassword);
}
const generateAccessToken = (user) => {
    const secret = process.env.ACCESS_SECRET || "apimonitor_jwt_access_secret_key_default";
    const expiry = process.env.ACCESS_EXPIRY || "1d";
    return jwt.sign({ id: user.id, name: user.name, email: user.email }, secret, { expiresIn: expiry });
};

const generateRefreshToken = (user) => {
    const secret = process.env.REFRESH_SECRET || "apimonitor_jwt_refresh_secret_key_default";
    const expiry = process.env.REFRESH_EXPIRY || "7d";
    return jwt.sign({ id: user.id }, secret, { expiresIn: expiry });
};
const User = {
    createUser,
    findUserByEmail,
    findUserById,
    updateRefreshToken,
    comparePassword,
    generateAccessToken,
    generateRefreshToken,
    updateUserById,
    updatePasswordById,
    deleteUserById
};

export default User;