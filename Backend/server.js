import dotenv from "dotenv";
import app from "./app.js";
import { initializeDatabase } from "./config/initDb.js";
import { startMonitorWorker } from "./workers/monitor.worker.js";
import { startMonitorScheduler, stopMonitorScheduler } from "./scheduler/monitor.scheduler.js";

dotenv.config();

const PORT = process.env.PORT || 8000;

const startServer = async () => {
    console.log("🚀 Starting API Monitoring Platform...");

    // 1. Initialize PostgreSQL schema
    try {
        await initializeDatabase();
    } catch (dbErr) {
        console.warn("⚠️ Warning: PostgreSQL schema auto-init warning:", dbErr.message);
    }

    // 2. Initialize BullMQ worker & scheduler if Redis is enabled
    const disableWorker = process.env.DISABLE_EMBEDDED_WORKER === "true";
    if (!disableWorker) {
        try {
            console.log("⚙️ Initializing BullMQ Worker and Scheduler in embedded mode...");
            startMonitorWorker();
            startMonitorScheduler();
        } catch (workerErr) {
            console.warn("⚠️ BullMQ / Redis worker failed to start. Health checks can still be triggered manually:", workerErr.message);
        }
    } else {
        console.log("ℹ️ Standalone worker mode configured (DISABLE_EMBEDDED_WORKER=true). Run 'npm run worker' separately.");
    }

    // 3. Start Express server
    const server = app.listen(PORT, () => {
        console.log(`\n======================================================`);
        console.log(`📡 API Monitoring Server running on port ${PORT}`);
        console.log(`🔗 API Base URL: http://localhost:${PORT}/api/v1`);
        console.log(`❤️ Health Check: http://localhost:${PORT}/health`);
        console.log(`======================================================\n`);
    });

    // Graceful Shutdown
    const shutdown = async (signal) => {
        console.log(`\n🛑 Received ${signal}. Gracefully shutting down...`);
        stopMonitorScheduler();
        server.close(() => {
            console.log("🔌 HTTP Server closed");
            process.exit(0);
        });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
};

startServer().catch((err) => {
    console.error("💥 Fatal error during server startup:", err);
    process.exit(1);
});
