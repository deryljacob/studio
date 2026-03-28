"use strict";
/**
 * @fileOverview Cloud Function to send real-time email notifications for new alerts.
 * This function triggers when a new document is created in the 'alerts' collection.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendAlertEmail = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const firebase_admin_1 = require("../firebase-admin");
// Configuration for ZeptoMail API. These should be set as environment variables.
const ZEPTOMAIL_API_URL = "https://api.zeptomail.com/v1.1/email";
const ZEPTOMAIL_SEND_MAIL_TOKEN = process.env.ZEPTOMAIL_SEND_MAIL_TOKEN;
const ZEPTOMAIL_FROM_EMAIL = process.env.ZEPTOMAIL_FROM_EMAIL;
/**
 * Sends an email using the ZeptoMail API.
 * @param to - The recipient's email address.
 * @param subject - The subject of the email.
 * @param htmlBody - The HTML content of the email.
 * @returns {Promise<boolean>} True if the email was sent successfully, false otherwise.
 */
async function sendEmail(to, subject, htmlBody) {
    if (!ZEPTOMAIL_SEND_MAIL_TOKEN || !ZEPTOMAIL_FROM_EMAIL) {
        console.error("ZeptoMail credentials are not configured in environment variables.");
        return false;
    }
    const payload = {
        from: { address: ZEPTOMAIL_FROM_EMAIL, name: "Calendar Sentinel Alerts" },
        to: [{ email_address: { address: to } }],
        subject: subject,
        htmlbody: htmlBody,
    };
    try {
        const response = await fetch(ZEPTOMAIL_API_URL, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Zoho-enczapikey ${ZEPTOMAIL_SEND_MAIL_TOKEN}`,
            },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const errorBody = await response.json();
            console.error("Failed to send email via ZeptoMail:", response.status, errorBody);
            return false;
        }
        console.log(`Successfully sent email to ${to} with subject: ${subject}`);
        return true;
    }
    catch (error) {
        console.error("Error calling ZeptoMail API:", error);
        return false;
    }
}
/**
 * Creates the HTML body for an alert email.
 * @param alert - The alert data.
 * @returns {string} The formatted HTML for the email.
 */
function createEmailBody(alert) {
    const alertDetailsHtml = Object.entries(alert.details || {})
        .map(([key, value]) => `<p><strong>${key.replace(/_/g, ' ')}:</strong> ${value}</p>`)
        .join('');
    const dashboardUrl = process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard` : 'https://your-app-url.com/dashboard';
    return `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2 style="color: #c0392b;">New ${alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1)} Alert: ${alert.event}</h2>
            <p>A new alert has been generated for your account that requires your attention.</p>
            <div style="background-color: #f9f9f9; border: 1px solid #ddd; padding: 15px; border-radius: 5px;">
                ${alertDetailsHtml}
            </div>
            <p>Please review this issue as soon as possible to prevent any disruption to your bookings.</p>
            <a href="${dashboardUrl}" style="background-color: #2980b9; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                View Dashboard
            </a>
        </div>
    `;
}
exports.sendAlertEmail = (0, firestore_1.onDocumentCreated)({
    document: "alerts/{alertId}",
    region: "asia-south1",
}, async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        console.log("No data associated with the event");
        return;
    }
    const alert = snapshot.data();
    // Rule 1: Only send for critical or warning alerts to avoid spamming
    if (alert.severity !== 'critical' && alert.severity !== 'warning') {
        console.log(`Ignoring info-level alert ${event.params.alertId}.`);
        return;
    }
    const adminDb = (0, firebase_admin_1.getAdminDb)();
    // Rule 2: Check user's notification preferences
    const userDocRef = adminDb.collection('users').doc(alert.userId);
    const userDoc = await userDocRef.get();
    if (!userDoc.exists) {
        console.error(`User document ${alert.userId} not found for alert ${event.params.alertId}.`);
        return;
    }
    const userData = userDoc.data();
    if (!userData?.emailAlerts) {
        console.log(`User ${alert.userId} has disabled email alerts.`);
        return;
    }
    const recipientEmail = userData.email;
    if (!recipientEmail) {
        console.error(`User ${alert.userId} does not have an email address on file.`);
        return;
    }
    // Construct and send the email
    const emailSubject = `[${alert.severity.toUpperCase()}] Calendar Sentinel Alert: ${alert.event}`;
    const emailBody = createEmailBody(alert);
    await sendEmail(recipientEmail, emailSubject, emailBody);
});
//# sourceMappingURL=send-alert-email.js.map