/**
 * @fileOverview Firebase Admin SDK Initialization.
 *
 * This file handles the server-side initialization of the Firebase Admin SDK.
 * It uses a lazy initialization pattern to ensure that the SDK is only initialized
 * when it's first needed by a server action. This is the recommended approach for
 * serverless environments like Next.js.
 */
import admin from 'firebase-admin';
import type { ServiceAccount } from 'firebase-admin';
import { serverConfig } from './server-config';

// A flag to track if the app has been initialized
let isInitialized = false;

/**
 * Initializes the Firebase Admin SDK if it hasn't been already.
 * This function is the single entry point for all admin-related services.
 */
function initializeAdminApp() {
  if (isInitialized || admin.apps.length > 0) {
    isInitialized = true;
    return;
  }
  
  const serviceAccount = serverConfig.firebaseServiceAccount;

  if (!serviceAccount?.project_id) {
    console.error("Firebase Admin SDK initialization error: Service account credentials are not loaded or are invalid.");
    // We don't throw here to allow the build process to succeed.
    // The error will be caught when a function tries to use the uninitialized SDK.
    return;
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as ServiceAccount),
    });
    isInitialized = true;
    console.log("Firebase Admin SDK initialized successfully.");
  } catch (error: any) {
    console.error("Firebase Admin SDK initialization error:", error.stack);
    // Do not throw here to allow build to pass.
  }
}

/**
 * Gets the Firebase Admin Auth service.
 * Initializes the app if it's not already.
 * @returns The Firebase Admin Auth instance.
 */
export function getAdminAuth() {
  initializeAdminApp();
  return admin.auth();
}

/**
 * Gets the Firebase Admin Firestore service.
 * Initializes the app if it's not already.
 * @returns The Firebase Admin Firestore instance.
 */
export function getAdminDb() {
  initializeAdminApp();
  return admin.firestore();
}
