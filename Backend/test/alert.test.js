import { test, describe } from "node:test";
import assert from "node:assert";
import AlertService from "../services/alert.service.js";

describe("Alert Service & Email Transporter", () => {
    test("detects unconfigured/placeholder SMTP and falls back cleanly without crashing", async () => {
        const verifyStatus = await AlertService.verifyTransporter();
        assert.ok(typeof verifyStatus === "object");
        assert.strictEqual(typeof verifyStatus.configured, "boolean");
    });

    test("successfully dispatches simulated downtime alert", async () => {
        const result = await AlertService.sendDowntimeAlert({
            monitor: { id: null, name: "Test API Service", url: "https://example.com/api" },
            userEmail: "420munna6901@gmail.com",
            userName: "Munna",
            statusCode: 502,
            responseTime: 1800,
            errorMessage: "Bad Gateway",
        });

        assert.strictEqual(result.success, true);
        assert.ok(result.messageId);
    });

    test("successfully dispatches simulated recovery alert", async () => {
        const result = await AlertService.sendRecoveryAlert({
            monitor: { id: null, name: "Test API Service", url: "https://example.com/api" },
            userEmail: "420munna6901@gmail.com",
            userName: "Munna",
            statusCode: 200,
            responseTime: 120,
        });

        assert.strictEqual(result.success, true);
        assert.ok(result.messageId);
    });

    test("sendTestAlert dispatches formatted test alert properly", async () => {
        const result = await AlertService.sendTestAlert({
            userEmail: "420munna6901@gmail.com",
            userName: "Munna",
            type: "down",
        });

        assert.strictEqual(result.success, true);
        assert.ok(result.messageId);
    });
});
