import nodemailer from "nodemailer";
import dotenv from "dotenv";
import MonitorCheck from "../model/monitorCheck.model.js";

dotenv.config();

let transporter = null;
let transporterType = null; // 'smtp' | 'ethereal' | 'simulated'

const isConfigured = (val) => {
    if (!val || typeof val !== "string") return false;
    const trimmed = val.trim();
    if (!trimmed) return false;
    const lower = trimmed.toLowerCase();
    return !(
        lower === "your_email@gmail.com" ||
        lower === "your_app_password" ||
        lower.startsWith("your_") ||
        lower.includes("example.com")
    );
};

const getTransporter = async ({ forceRefresh = false, preferEthereal = false } = {}) => {
    if (transporter && !forceRefresh) return { transporter, type: transporterType };

    // 1. If preferEthereal is not requested and real SMTP is configured
    if (!preferEthereal && isConfigured(process.env.SMTP_HOST) && isConfigured(process.env.SMTP_USER) && isConfigured(process.env.SMTP_PASS)) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === "true",
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
        transporterType = "smtp";
        console.log(`📧 Real SMTP transporter initialized (${process.env.SMTP_HOST}:${process.env.SMTP_PORT || 587})`);
        return { transporter, type: transporterType };
    }

    // 2. If preferEthereal is true or USE_ETHEREAL=true
    if (preferEthereal || process.env.USE_ETHEREAL === "true") {
        try {
            const testAccount = await nodemailer.createTestAccount();
            transporter = nodemailer.createTransport({
                host: testAccount.smtp.host,
                port: testAccount.smtp.port,
                secure: testAccount.smtp.secure,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass,
                },
            });
            transporterType = "ethereal";
            console.log(`🧪 Ethereal test SMTP transporter initialized (${testAccount.user})`);
            return { transporter, type: transporterType };
        } catch (etherealErr) {
            console.warn("⚠️ Could not initialize Ethereal test account:", etherealErr.message);
        }
    }

    // 3. Fallback: development / simulated transporter
    transporter = {
        sendMail: async (options) => {
            console.log("\n================ [EMAIL ALERT DISPATCHED (SIMULATED)] ================");
            console.log(`To:      ${options.to}`);
            console.log(`Subject: ${options.subject}`);
            console.log(`From:    ${options.from || "alerts@apimonitor.dev"}`);
            console.log(`Content:\n${options.text}`);
            console.log("====================================================================\n");
            return { messageId: "simulated-" + Date.now() };
        },
    };
    transporterType = "simulated";
    console.log("ℹ️ No valid SMTP credentials found in .env. Using simulated email logger (printed to console)");

    return { transporter, type: transporterType };
};

const verifyTransporter = async () => {
    const isSmtpReady = isConfigured(process.env.SMTP_HOST) &&
                        isConfigured(process.env.SMTP_USER) &&
                        isConfigured(process.env.SMTP_PASS);

    if (!isSmtpReady) {
        return {
            configured: false,
            provider: "simulated",
            message: "SMTP is not configured with real credentials in .env (placeholder or missing values).",
        };
    }

    try {
        const { transporter: client } = await getTransporter({ forceRefresh: true });
        if (client && typeof client.verify === "function") {
            await client.verify();
            return {
                configured: true,
                provider: process.env.SMTP_HOST,
                user: process.env.SMTP_USER,
                status: "connected",
                message: "SMTP connection verified successfully.",
            };
        }
        return {
            configured: true,
            provider: "custom",
            status: "ready",
            message: "Transporter ready.",
        };
    } catch (err) {
        return {
            configured: true,
            provider: process.env.SMTP_HOST,
            user: process.env.SMTP_USER,
            status: "error",
            error: err.message,
            message: `SMTP connection failed: ${err.message}`,
        };
    }
};

const sendDowntimeAlert = async ({
    monitor,
    userEmail,
    userName = "Developer",
    statusCode,
    responseTime,
    errorMessage,
    preferEthereal = false,
}) => {
    try {
        const { transporter: mailClient, type } = await getTransporter({ preferEthereal });
        const fromAddress = process.env.ALERT_EMAIL_FROM || '"API Sentinel" <alerts@apimonitor.dev>';
        const dashboardUrl = process.env.DASHBOARD_URL || process.env.CORS_ORIGIN || "http://localhost:5173";
        const subject = `🚨 CRITICAL: API Down Alert - "${monitor.name}"`;

        const text = `
[CRITICAL ALERT] API Down: "${monitor.name}"
============================================================

Hello ${userName},

Your monitored API endpoint has failed automated health checks and is currently DOWN.

INCIDENT DETAILS:
------------------------------------------------------------
• Service Name   : ${monitor.name}
• Target Endpoint: ${monitor.url}
• HTTP Status    : ${statusCode ? `${statusCode} (Failed)` : "No Response / Timed Out"}
• Latency        : ${responseTime || 0} ms
• Error Details  : ${errorMessage || "Status code >= 400 or connection timeout"}
• Timestamp      : ${new Date().toUTCString()}

RECOMMENDED ACTIONS:
------------------------------------------------------------
1. Inspect server logs for recent 5xx exceptions or crashed processes.
2. Verify database connection pools and background workers.
3. Check hosting infrastructure health and domain DNS records.

Dashboard: ${dashboardUrl}

--
API Monitoring Platform Sentinel
`;

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Outage Alert</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);">
          <!-- Top Status Accent Line -->
          <tr>
            <td style="height: 5px; background: linear-gradient(90deg, #ef4444, #dc2626); font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>
          
          <!-- Card Header -->
          <tr>
            <td style="padding: 28px 32px 20px 32px; border-bottom: 1px solid #f1f5f9;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle">
                    <span style="font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #dc2626; display: block; margin-bottom: 6px;">
                      ⚠️ Critical Outage Alert
                    </span>
                    <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.25;">
                      ${monitor.name} is DOWN
                    </h1>
                  </td>
                  <td align="right" valign="middle">
                    <span style="display: inline-block; padding: 6px 14px; background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 9999px; font-size: 12px; font-weight: 700; color: #b91c1c;">
                      ● OFFLINE
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Summary Message -->
          <tr>
            <td style="padding: 24px 32px 16px 32px; font-size: 15px; line-height: 1.6; color: #334155;">
              Hello <strong>${userName}</strong>,<br>
              Automated health check verification failed for endpoint <strong>${monitor.name}</strong>. The service is currently unresponsive or returned an error status code.
            </td>
          </tr>

          <!-- Metric Breakdown Table -->
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #64748b; width: 35%;">
                    Target URL
                  </td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #0f172a; word-break: break-all;">
                    ${monitor.url}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #64748b;">
                    HTTP Status
                  </td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 700; color: #dc2626;">
                    ${statusCode ? `${statusCode} (Failed)` : "No Response / Timed Out"}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #64748b;">
                    Latency
                  </td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #0f172a; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">
                    ${responseTime || 0} ms
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #64748b;">
                    Error Details
                  </td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #b91c1c; font-weight: 500;">
                    ${errorMessage || "Response status >= 400 or network timeout"}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #64748b;">
                    Detected At
                  </td>
                  <td style="padding: 12px 16px; font-size: 13px; color: #475569;">
                    ${new Date().toUTCString()}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Actionable Troubleshooting Advice Box -->
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px;">
                <tr>
                  <td>
                    <div style="font-size: 13px; font-weight: 700; color: #92400e; margin-bottom: 8px;">
                      🛠️ Recommended Troubleshooting Steps:
                    </div>
                    <ul style="margin: 0; padding-left: 20px; font-size: 12.5px; color: #78350f; line-height: 1.6;">
                      <li>Check your cloud provider logs (Render, AWS, Vercel, Railway) for crashes.</li>
                      <li>Verify your database and cache (Redis, Postgres) connection pools.</li>
                      <li>Check domain DNS settings and SSL certificate validity.</li>
                      <li>Inspect recent code deployments for unhandled exceptions or syntax errors.</li>
                    </ul>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Action Buttons -->
          <tr>
            <td style="padding: 0 32px 32px 32px;" align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="border-radius: 8px; background-color: #0f172a;">
                    <a href="${dashboardUrl}" target="_blank" style="font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; padding: 12px 24px; display: inline-block; border-radius: 8px; letter-spacing: 0.02em;">
                      Open Monitoring Dashboard →
                    </a>
                  </td>
                  <td width="12"></td>
                  <td align="center" style="border-radius: 8px; background-color: #f1f5f9; border: 1px solid #cbd5e1;">
                    <a href="${monitor.url}" target="_blank" style="font-size: 14px; font-weight: 600; color: #334155; text-decoration: none; padding: 11px 20px; display: inline-block; border-radius: 8px;">
                      Test API URL ↗
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; line-height: 1.5;">
              Automated alert sent by your <strong>API Monitoring Platform</strong><br>
              You received this because your email is registered as the incident contact for this monitor.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

        const info = await mailClient.sendMail({
            from: fromAddress,
            to: userEmail,
            subject,
            text,
            html,
        });

        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
            console.log(`🔗 Email Preview URL: ${previewUrl}`);
        }

        // Record incident in database if this is a registered monitor
        if (monitor?.id) {
            try {
                await MonitorCheck.recordIncidentAlert(
                    monitor.id,
                    "down",
                    statusCode,
                    responseTime,
                    errorMessage || "API DOWN",
                    userEmail
                );
            } catch (dbErr) {
                console.warn("⚠️ Could not record incident alert in DB:", dbErr.message);
            }
        }

        return {
            success: true,
            messageId: info.messageId,
            previewUrl: previewUrl || null,
            type,
        };
    } catch (err) {
        console.error("❌ Failed to send downtime alert email:", err.message);
        return {
            success: false,
            error: err.message,
        };
    }
};

const sendRecoveryAlert = async ({
    monitor,
    userEmail,
    userName = "Developer",
    statusCode = 200,
    responseTime = 0,
    preferEthereal = false,
}) => {
    try {
        const { transporter: mailClient, type } = await getTransporter({ preferEthereal });
        const fromAddress = process.env.ALERT_EMAIL_FROM || '"API Sentinel" <alerts@apimonitor.dev>';
        const dashboardUrl = process.env.DASHBOARD_URL || process.env.CORS_ORIGIN || "http://localhost:5173";
        const subject = `✅ RESOLVED: API Back Online - "${monitor.name}"`;

        const text = `
[INCIDENT RESOLVED] API Restored: "${monitor.name}"
============================================================

Hello ${userName},

Great news! Your monitored API endpoint has passed health checks and is once again OPERATIONAL.

RECOVERY DETAILS:
------------------------------------------------------------
• Service Name   : ${monitor.name}
• Target Endpoint: ${monitor.url}
• HTTP Status    : ${statusCode} OK
• Response Time  : ${responseTime} ms
• Restored At    : ${new Date().toUTCString()}

Automated checks are now passing normally.

Dashboard: ${dashboardUrl}

--
API Monitoring Platform Sentinel
`;

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Restored Alert</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);">
          <!-- Top Status Accent Line -->
          <tr>
            <td style="height: 5px; background: linear-gradient(90deg, #10b981, #059669); font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>
          
          <!-- Card Header -->
          <tr>
            <td style="padding: 28px 32px 20px 32px; border-bottom: 1px solid #f1f5f9;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle">
                    <span style="font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #059669; display: block; margin-bottom: 6px;">
                      ✅ Incident Resolved
                    </span>
                    <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.25;">
                      ${monitor.name} is BACK ONLINE
                    </h1>
                  </td>
                  <td align="right" valign="middle">
                    <span style="display: inline-block; padding: 6px 14px; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 9999px; font-size: 12px; font-weight: 700; color: #047857;">
                      ● OPERATIONAL
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Summary Message -->
          <tr>
            <td style="padding: 24px 32px 16px 32px; font-size: 15px; line-height: 1.6; color: #334155;">
              Hello <strong>${userName}</strong>,<br>
              Great news! Your API endpoint <strong>${monitor.name}</strong> has successfully recovered and health checks are passing normally.
            </td>
          </tr>

          <!-- Metric Breakdown Table -->
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #64748b; width: 35%;">
                    Target URL
                  </td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #0f172a; word-break: break-all;">
                    ${monitor.url}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #64748b;">
                    HTTP Status
                  </td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 700; color: #059669;">
                    ${statusCode || 200} OK
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #64748b;">
                    Response Latency
                  </td>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; font-weight: 600; color: #0f172a; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">
                    ${responseTime || 0} ms
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #64748b;">
                    Restored At
                  </td>
                  <td style="padding: 12px 16px; font-size: 13px; color: #475569;">
                    ${new Date().toUTCString()}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Action Button -->
          <tr>
            <td style="padding: 0 32px 32px 32px;" align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="border-radius: 8px; background-color: #0f172a;">
                    <a href="${dashboardUrl}" target="_blank" style="font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; padding: 12px 24px; display: inline-block; border-radius: 8px; letter-spacing: 0.02em;">
                      View Live Metrics in Dashboard →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; line-height: 1.5;">
              Automated alert sent by your <strong>API Monitoring Platform</strong><br>
              Incident automatically closed.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

        const info = await mailClient.sendMail({
            from: fromAddress,
            to: userEmail,
            subject,
            text,
            html,
        });

        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
            console.log(`🔗 Email Preview URL: ${previewUrl}`);
        }

        if (monitor?.id) {
            try {
                await MonitorCheck.recordIncidentAlert(
                    monitor.id,
                    "recovery",
                    statusCode,
                    responseTime,
                    "API Service Restored",
                    userEmail
                );
            } catch (dbErr) {
                console.warn("⚠️ Could not record incident alert in DB:", dbErr.message);
            }
        }

        return {
            success: true,
            messageId: info.messageId,
            previewUrl: previewUrl || null,
            type,
        };
    } catch (err) {
        console.error("❌ Failed to send recovery alert email:", err.message);
        return {
            success: false,
            error: err.message,
        };
    }
};

const sendTestAlert = async ({
    userEmail,
    userName = "Developer",
    monitorName = "Production Auth & User API",
    monitorUrl = "https://api.example.com/v1/health",
    type = "down",
    preferEthereal = false,
}) => {
    const isDown = type === "down";
    const monitor = {
        id: null,
        name: monitorName,
        url: monitorUrl,
    };

    if (isDown) {
        return await sendDowntimeAlert({
            monitor,
            userEmail,
            userName,
            statusCode: 503,
            responseTime: 1420,
            errorMessage: "HTTP 503 Service Unavailable: Gateway upstream connection timed out",
            preferEthereal,
        });
    } else {
        return await sendRecoveryAlert({
            monitor,
            userEmail,
            userName,
            statusCode: 200,
            responseTime: 118,
            preferEthereal,
        });
    }
};

const AlertService = {
    sendDowntimeAlert,
    sendRecoveryAlert,
    sendTestAlert,
    verifyTransporter,
    getTransporter,
};

export default AlertService;
export { sendDowntimeAlert, sendRecoveryAlert, sendTestAlert, verifyTransporter, getTransporter };
