import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import userRouter from "./routes/user.routes.js";
import monitorRouter from "./routes/monitor.routes.js";
import errorHandler from "./middleware/error.middleware.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const configuredOrigins = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

const allowedOrigins = [
    ...configuredOrigins,
    "https://apimonitoring-jacqp9q52-420royalrajput50806-5145s-projects.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
];

app.use(
    cors({
        origin: function (origin, callback) {
            // Allow requests with no origin (e.g. mobile apps, curl, postman, server-to-server)
            if (!origin) return callback(null, true);

            // Allow if in explicit allowed list, from vercel.app, or local development
            if (
                allowedOrigins.includes(origin) ||
                origin.endsWith(".vercel.app") ||
                origin.includes("localhost") ||
                origin.includes("127.0.0.1")
            ) {
                return callback(null, true);
            }

            return callback(null, true); // Permissive fallback
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    })
);

app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: true, limit: "32kb" }));
app.use(cookieParser());

import fs from "fs";

// Serve Frontend static files (dist if built, otherwise Frontend root)
const frontendDist = path.join(__dirname, "../Frontend/dist");
const frontendRoot = path.join(__dirname, "../Frontend");
const staticPath = fs.existsSync(path.join(frontendDist, "index.html")) ? frontendDist : frontendRoot;
app.use(express.static(staticPath));

// System health probe
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        service: "api-monitoring-system",
        timestamp: new Date().toISOString(),
    });
});

// Mount API routes
app.use("/api/v1/users", userRouter);
app.use("/api/v1/monitors", monitorRouter);

// Fallback to index.html for SPA routing (Express 5 compatible)
app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/")) {
        return next();
    }
    res.sendFile(path.join(staticPath, "index.html"));
});

// Centralized error handling
app.use(errorHandler);

export default app;
