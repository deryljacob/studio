
'use server';
/**
 * @fileOverview An action for resolving an alert.
 * It re-verifies the condition that triggered the alert before marking it as resolved.
 */

import { getAdminDb } from "@/lib/firebase-admin";
import { verifyToken } from "@/lib/actions/auth";
import type { Alert, ResolveAlertInput, ResolveAlertOutput } from "@/lib/types";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

/**
 * Checks if a 'revenue-leak' alert has been resolved by verifying
 * that a calendar block now exists for the booking in question.
 */
async function verifyRevenueLeakResolved(alert: Alert): Promise<boolean> {
    if (!alert.details?.checkinDate || !alert.details?.checkoutDate) {
        return false; // Cannot verify without dates
    }
    
    const adminDb = getAdminDb();
    const checkin = new Date(alert.details.checkinDate);
    const checkout = new Date(alert.details.checkoutDate);

    const eventsRef = adminDb.collection('events');
    const potentialBlocksQuery = eventsRef
        .where('userId', '==', alert.userId)
        .where('end', '>=', Timestamp.fromDate(checkin))
        .where('start', '<=', Timestamp.fromDate(checkout));
    
    const snapshot = await potentialBlocksQuery.get();
    
    // If the snapshot is NOT empty, it means a block has been found. The leak is fixed.
    return !snapshot.empty;
}

// Placeholder for future implementation
async function verifyDoubleBookingResolved(alert: Alert): Promise<boolean> {
    // TODO: Implement logic to re-check for overlapping events based on alert.details.
    return true; // Assume resolved for now
}


export async function resolveAlert(input: ResolveAlertInput): Promise<ResolveAlertOutput> {
    const { alertId, idToken } = input;
    
    // 1. Authenticate the request
    const authResult = await verifyToken(idToken);
    if (authResult.status === 'error' || !authResult.uid) {
      return { status: 'error', message: authResult.message };
    }
    
    const adminDb = getAdminDb();
    const alertRef = adminDb.collection('alerts').doc(alertId);

    try {
        const alertDoc = await alertRef.get();
        if (!alertDoc.exists) {
            return { status: 'error', message: 'Alert not found.' };
        }

        const alert = alertDoc.data() as Alert;
        
        // Security check: ensure the user owns this alert
        if (alert.userId !== authResult.uid) {
             return { status: 'error', message: 'You are not authorized to resolve this alert.' };
        }

        let isResolved = false;

        // 2. Route to the correct verification function based on alert type
        switch (alert.type) {
            case 'revenue-leak':
                console.log(`Verifying resolution for revenue-leak alert ${alertId}`);
                isResolved = await verifyRevenueLeakResolved(alert);
                break;
            case 'double-booking':
                 console.log(`Verifying resolution for double-booking alert ${alertId}`);
                isResolved = await verifyDoubleBookingResolved(alert);
                break;
            // Default case for alerts that don't have automated verification
            default:
                console.log(`No specific verification for alert type '${alert.type}'. Assuming manual resolution.`);
                isResolved = true;
                break;
        }

        // 3. Update the document if the issue is confirmed to be resolved
        if (isResolved) {
            await alertRef.update({
                status: 'resolved',
                resolvedAt: FieldValue.serverTimestamp()
            });
            return {
                status: 'resolved',
                message: `Alert ${alert.type} has been successfully resolved.`,
            };
        } else {
            return {
                status: 'persistent',
                message: 'The underlying issue still exists. Please double-check your calendars and try again.',
            };
        }

    } catch (error: any) {
        console.error(`[RESOLVE_ALERT_ERROR] for alert ${alertId}:`, error);
        return { status: 'error', message: `An unexpected error occurred: ${error.message}` };
    }
}
