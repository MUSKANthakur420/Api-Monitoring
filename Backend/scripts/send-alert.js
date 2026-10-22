import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import AlertService from "../services/alert.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const targetEmail = process.argv[2] || "420munna6901@gmail.com";
const alertType = process.argv[3] || "down"; // 'down' or 'recovery'

console.log("\n==================================================================");
console.log("🚨  API MONITORING PLATFORM - ALERT SYSTEM DIAGNOSTIC & TEST TOOL");
console.log("==================================================================\n");

console.log(`🎯 Recipient Target : ${targetEmail}`);
console.log(`📦 Alert Type       : ${alertType.toUpperCase()}`);
console.log(`⚙️  SMTP Host        : ${process.env.SMTP_HOST || "(not set)"}`);
console.log(`⚙️  SMTP Port        : ${process.env.SMTP_PORT || "587"}`);
console.log(`⚙️  SMTP User        : ${process.env.SMTP_USER || "(not set)"}`);
console.log(`⚙️  SMTP Pass        : ${process.env.SMTP_PASS ? "••••••••••••" : "(not set)"}`);
console.log(`⚙️  Alert From       : ${process.env.ALERT_EMAIL_FROM || "Default"}\n`);

const isPlaceholder = (val) => {
    if (!val) return true;
    const lower = val.toLowerCase().trim();
    return (
        lower === "your_email@gmail.com" ||
        lower === "your_app_password" ||
        lower.startsWith("your_") ||
        lower.includes("example.com")
    );
};

const run = async () => {
    const hasPlaceholder = isPlaceholder(process.env.SMTP_USER) || isPlaceholder(process.env.SMTP_PASS);

    if (hasPlaceholder) {
        console.log("⚠️  NOTICE: Placeholder credentials detected in Backend/.env");
        console.log("   (SMTP_USER or SMTP_PASS has placeholder values).");
        console.log("\n   To deliver emails directly to real Gmail inboxes like " + targetEmail + ":");
        console.log("   1. Open Google Account: https://myaccount.google.com/security");
        console.log("   2. Turn ON 2-Step Verification if not already enabled.");
        console.log("   3. Go to 'App Passwords': https://myaccount.google.com/apppasswords");
        console.log("   4. Create an App Name (e.g., 'API Monitor') and copy the 16-character password.");
        console.log("   5. Update Backend/.env with:");
        console.log("      SMTP_USER=your_real_gmail@gmail.com");
        console.log("      SMTP_PASS=xxxx xxxx xxxx xxxx\n");
        console.log("🧪 Disagreeable with real creds right now? Testing via Ethereal Mock SMTP instead...\n");

        console.log("⏳ Dispatching test alert through Ethereal...");
        const result = await AlertService.sendTestAlert({
            userEmail: targetEmail,
            userName: "Munna",
            monitorName: "Production Auth API (Health Check Test)",
            monitorUrl: "https://api.example.com/v1/health",
            type: alertType,
            preferEthereal: true,
        });

        if (result.success) {
            console.log("\n✅ [SUCCESS] Test alert generated successfully!");
            console.log(`📨 Message ID : ${result.messageId}`);
            if (result.previewUrl) {
                console.log(`\n🔗 LIVE EMAIL PREVIEW URL:`);
                console.log(`👉 ${result.previewUrl}`);
                console.log(`\n   Open the URL above in your browser to inspect the exact HTML alert email!`);
            }
        } else {
            console.error("\n❌ [FAILED] Could not send test alert:", result.error);
        }
        return;
    }

    console.log("🔍 Checking connection to configured SMTP server...");
    const verifyResult = await AlertService.verifyTransporter();

    if (!verifyResult.configured || verifyResult.status === "error") {
        console.error(`\n❌ [SMTP AUTH FAILED] ${verifyResult.message || verifyResult.error}`);
        console.log("\nIf you are using Gmail:");
        console.log(" - Ensure you are using a 16-character 'Google App Password', NOT your standard password.");
        console.log(" - Generate it at https://myaccount.google.com/apppasswords");
        return;
    }

    console.log("✅ SMTP connection verified successfully!");
    console.log(`⏳ Dispatching real alert email to ${targetEmail}...`);

    const result = await AlertService.sendTestAlert({
        userEmail: targetEmail,
        userName: "Munna",
        monitorName: "Production Auth API (Health Check Test)",
        monitorUrl: "https://api.example.com/v1/health",
        type: alertType,
        preferEthereal: false,
    });

    if (result.success) {
        console.log(`\n🎉 [SUCCESS] Alert email successfully sent to ${targetEmail}!`);
        console.log(`📨 Message ID: ${result.messageId}`);
        console.log("📬 Check your Gmail inbox (and Spam/Junk folder if not immediately visible).");
    } else {
        console.error(`\n❌ [FAILED] Error sending email:`, result.error);
    }
};

run().catch((err) => {
    console.error("💥 Unexpected error:", err);
    process.exit(1);
});
