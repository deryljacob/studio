"use strict";
/**
 * @fileOverview Firebase Functions entry point.
 *
 * This file acts as the main index for all Cloud Functions in the application.
 * It imports and re-exports the functions defined in other files, making them
 * discoverable by the Firebase CLI for deployment. This pattern helps keep
 * function code organized in separate modules.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendAlertEmail = void 0;
const send_alert_email_1 = require("./src/lib/functions/send-alert-email");
Object.defineProperty(exports, "sendAlertEmail", { enumerable: true, get: function () { return send_alert_email_1.sendAlertEmail; } });
//# sourceMappingURL=firebase-functions.js.map