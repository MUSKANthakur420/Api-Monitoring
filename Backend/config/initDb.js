import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pool from "./db.js";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const initializeDatabase = async () => {
    try {
        const schemaPath = path.join(__dirname, "schema.sql");
        const schemaSql = fs.readFileSync(schemaPath, "utf-8");

        console.log("🔄 Initializing PostgreSQL database tables and migrations...");
        await pool.query(schemaSql);

        // Explicitly guarantee all columns exist
        await pool.query(`
            ALTER TABLE monitors ADD COLUMN IF NOT EXISTS interval_seconds INTEGER DEFAULT 60;
            ALTER TABLE monitors ADD COLUMN IF NOT EXISTS last_status VARCHAR(50) DEFAULT 'pending';
            ALTER TABLE monitors ADD COLUMN IF NOT EXISTS last_status_code INTEGER;
            ALTER TABLE monitors ADD COLUMN IF NOT EXISTS last_response_time INTEGER;
            ALTER TABLE monitors ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMP WITH TIME ZONE;
            ALTER TABLE monitors ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER DEFAULT 0;
            ALTER TABLE monitor_checks ADD COLUMN IF NOT EXISTS error_message TEXT;
        `);

        console.log("✅ Database schema and column migrations applied successfully!");
        return true;
    } catch (error) {
        console.error("❌ Failed to initialize database:", error.message);
        return false;
    }
};

// If run directly from CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    initializeDatabase().then((success) => {
        pool.end();
        process.exit(success ? 0 : 1);
    });
}
