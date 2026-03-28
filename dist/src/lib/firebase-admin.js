"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminAuth = getAdminAuth;
exports.getAdminDb = getAdminDb;
/**
 * @fileOverview Firebase Admin SDK Initialization.
 *
 * This file handles the server-side initialization of the Firebase Admin SDK.
 * It uses a lazy initialization pattern to ensure that the SDK is only initialized
 * when it's first needed by a server action. This is the recommended approach for
 * serverless environments like Next.js.
 */
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const server_config_1 = require("./server-config");
// A flag to track if the app has been initialized
let isInitialized = false;
/**
 * Initializes the Firebase Admin SDK if it hasn't been already.
 * This function is the single entry point for all admin-related services.
 */
function initializeAdminApp() {
    if (isInitialized || firebase_admin_1.default.apps.length > 0) {
        isInitialized = true;
        return;
    }
    const serviceAccount = server_config_1.serverConfig.firebaseServiceAccount;
    if (!serviceAccount?.project_id) {
        console.error("Firebase Admin SDK initialization error: Service account credentials are not loaded or are invalid.");
        // We don't throw here to allow the build process to succeed.
        // The error will be caught when a function tries to use the uninitialized SDK.
        return;
    }
    try {
        firebase_admin_1.default.initializeApp({
            credential: firebase_admin_1.default.credential.cert(serviceAccount),
        });
        isInitialized = true;
        console.log("Firebase Admin SDK initialized successfully.");
    }
    catch (error) {
        console.error("Firebase Admin SDK initialization error:", error.stack);
        // Do not throw here to allow build to pass.
    }
}
/**
 * Gets the Firebase Admin Auth service.
 * Initializes the app if it's not already.
 * @returns The Firebase Admin Auth instance.
 */
function getAdminAuth() {
    initializeAdminApp();
    return firebase_admin_1.default.auth();
}
/**
 * Gets the Firebase Admin Firestore service.
 * Initializes the app if it's not already.
 * @returns The Firebase Admin Firestore instance.
 */
function getAdminDb() {
    initializeAdminApp();
    return firebase_admin_1.default.firestore();
}
//# sourceMappingURL=firebase-admin.js.map