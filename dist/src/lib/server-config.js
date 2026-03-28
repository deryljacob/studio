"use strict";
/**
 * @fileOverview Server-side configuration loader.
 *
 * This file is responsible for loading, decoding, and parsing the Firebase
 * service account credentials from environment variables. It's designed to
 * be the single source of truth for server-only configurations. It will not
 * throw an error if the variable is missing during build time, but will result
 * in a null value that can be checked at runtime.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.serverConfig = void 0;
function loadServerConfig() {
    const serviceAccountBase64 = process.env.PRIVATE_FIREBASE_SERVICE_ACCOUNT_BASE64;
    if (!serviceAccountBase64) {
        // During build time, this might be undefined. We'll return null and check later.
        return { firebaseServiceAccount: null };
    }
    try {
        const decodedServiceAccount = Buffer.from(serviceAccountBase64, 'base64').toString('utf8');
        const serviceAccountJson = JSON.parse(decodedServiceAccount);
        return {
            firebaseServiceAccount: serviceAccountJson,
        };
    }
    catch (error) {
        console.error("Failed to parse Firebase service account JSON from Base64.", error);
        // Return null if parsing fails to avoid build-time crashes.
        return { firebaseServiceAccount: null };
    }
}
exports.serverConfig = loadServerConfig();
//# sourceMappingURL=server-config.js.map