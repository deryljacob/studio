/**
 * @fileOverview Firebase Functions entry point.
 *
 * This file acts as the main index for all Cloud Functions in the application.
 * It imports and re-exports the functions defined in other files, making them
 * discoverable by the Firebase CLI for deployment. This pattern helps keep
 * function code organized in separate modules.
 */

import { sendAlertEmail } from './src/lib/functions/send-alert-email';

// Export the functions that you want to deploy.
// The key (e.g., 'sendAlertEmail') will be the name of the function in the Firebase console.
export {
    sendAlertEmail
};
