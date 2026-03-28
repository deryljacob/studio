
'use server';
/**
 * @fileOverview A server action for creating a new alert in Firestore.
 * This is a secure, backend-only function that uses the Firebase Admin SDK.
 */

import { getAdminDb } from "@/lib/firebase-admin";
import type { Alert, CreateAlertInput, CreateAlertOutput } from "@/lib/types";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Creates a new alert document in the 'alerts' collection in Firestore.
 * This function is designed to be called from other server actions when an
 * alert-worthy condition is detected. It does not perform any business logic
 * to detect alerts itself; it only stores them.
 *
 * @param {CreateAlertInput} input - The data needed to create the alert.
 * @returns {Promise<CreateAlertOutput>} The result of the operation.
 */
export async function createAlert(input: CreateAlertInput): Promise<CreateAlertOutput> {
  const { userId, type, severity, source, event, details } = input;

  if (!userId || !type || !event) {
    return { status: 'error', message: 'Missing required fields for alert creation.' };
  }

  const adminDb = getAdminDb();

  try {
    const newAlert: Omit<Alert, 'id' | 'createdAt'> & { createdAt: FieldValue } = {
      userId,
      type,
      severity,
      status: 'pending',
      source,
      event,
      details: details || {},
      createdAt: FieldValue.serverTimestamp(),
    };

    const alertRef = await adminDb.collection('alerts').add(newAlert);
    
    console.log(`Successfully created alert ${alertRef.id} for user ${userId}.`);

    return { 
        status: 'success', 
        message: 'Alert created successfully.',
        alertId: alertRef.id
    };

  } catch (error: any) {
    console.error(`[CREATE_ALERT_ERROR] for user ${userId}:`, error);
    return { status: 'error', message: `Failed to create alert: ${error.message}` };
  }
}