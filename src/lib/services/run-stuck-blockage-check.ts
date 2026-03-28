/**
 * @fileOverview Core logic for the Stuck Blockage Check.
 *
 * This service is decoupled from the API route that receives the task.
 * Its sole responsibility is to take a task payload and execute the check
 * against Firestore to see if a calendar block was properly removed after a
 * cancellation email was received.
 */

import { getAdminDb } from "@/lib/firebase-admin";
import { StuckBlockageTaskPayload } from "@/lib/types";
import { createAlert } from "@/lib/actions/create-alert";
import { Timestamp } from "firebase-admin/firestore";

/**
 * Executes the stuck blockage check.
 * @param {StuckBlockageTaskPayload} payload - The data from the Cloud Task.
 */
export async function runStuckBlockageCheck(payload: StuckBlockageTaskPayload): Promise<void> {
    const { userId, cancelledBookingCode, checkinDate, checkoutDate } = payload;
    
    console.log(`Running stuck blockage check for user ${userId} and booking ${cancelledBookingCode}`);

    const adminDb = getAdminDb();

    const checkin = new Date(checkinDate);
    // If checkout is missing, we can still check for a block on the check-in day.
    const checkout = checkoutDate ? new Date(checkoutDate) : checkin;
    
    // Query for any calendar events that are still present within the cancelled date range.
    // An event overlaps if its end is on or after the check-in, and its start is on or before the check-out.
    const eventsRef = adminDb.collection('events');
    const stuckEventsQuery = eventsRef
        .where('userId', '==', userId)
        .where('end', '>=', Timestamp.fromDate(checkin))
        .where('start', '<=', Timestamp.fromDate(checkout));
    
    const snapshot = await stuckEventsQuery.get();

    if (snapshot.empty) {
        // This is the expected outcome. The calendar block was removed correctly.
        console.log(`No stuck blockage found for user ${userId}. All clear.`);
        return;
    }

    // If we are here, it means at least one event is still blocking the calendar.
    const stuckEvent = snapshot.docs[0];
    console.warn(`Stuck blockage DETECTED for user ${userId}. Event ${stuckEvent.id} is still blocking the calendar for cancelled booking ${cancelledBookingCode}.`);
    
    // Create an alert to notify the user.
    await createAlert({
        userId,
        type: 'stuck-blockage',
        severity: 'warning',
        source: 'System',
        event: `Calendar block still present after cancellation`,
        details: {
            cancelledBookingCode,
            stuckEventId: stuckEvent.id,
            stuckEventSummary: stuckEvent.data().summary,
            checkinDate: checkin.toISOString().split('T')[0], // Just the date part
            checkoutDate: checkout.toISOString().split('T')[0],
            message: `A calendar block is still present for dates that should have been cleared by cancellation ${cancelledBookingCode}. Please manually verify your calendar.`
        }
    });
}
