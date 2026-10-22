import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/apimonitor";

const isCloudDb =
    process.env.DATABASE_SSL === "true" ||
    (typeof connectionString === "string" && (
        connectionString.includes("neon.tech") ||
        connectionString.includes("supabase.co") ||
        connectionString.includes("render.com") ||
        connectionString.includes("sslmode=require")
    ));

const pool = new Pool({
    connectionString,
    ssl: isCloudDb ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

pool.on("error", (err) => {
    console.error("⚠️ Unexpected error on idle PostgreSQL client:", err.message);
});

export default pool;