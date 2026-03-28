
/**
 * @fileOverview Core logic for the Revenue Leak Check.
 *
 * This service is decoupled from the API route that receives the task.
 * Its sole responsibility is to take a task payload (containing a new booking's
 * details) and check if a corresponding event exists in Firestore. If not,
 * it creates an alert.
 */

import { getAdminDb } from "@/lib/firebase-admin";
import { RevenueLeakTaskPayload } from "@/lib/types";
import { createAlert } from "@/lib/actions/create-alert";
import { Timestamp } from "firebase-admin/firestore";

/**
 * Normalizes a date to the start of the day in UTC.
 * This prevents timezone issues and ensures comparisons are consistent.
 * @param {Date | string} date The date to normalize.
 * @returns {Date} The normalized date at midnight UTC.
 */
function getStartOfDay(date: Date | string): Date {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}


/**
 * Executes the revenue leak check.
 * @param {RevenueLeakTaskPayload} payload - The data from the Cloud Task.
 */
export async function runRevenueLeakCheck(payload: RevenueLeakTaskPayload): Promise<void> {
    const { userId, bookingDetails } = payload;
    const { confirmationCode, checkinDate, checkoutDate, platform } = bookingDetails;
    
    if (!checkinDate || !checkoutDate || !confirmationCode) {
        console.log(`Skipping revenue leak check for user ${userId} due to missing booking details.`);
        return;
    }
    
    console.log(`Running revenue leak check for user ${userId} and booking ${confirmationCode}`);

    const adminDb = getAdminDb();

    // Normalize dates to the start of the day for reliable querying.
    const checkin = getStartOfDay(checkinDate);
    const checkout = getStartOfDay(checkoutDate);
    
    // We need to check if ANY event exists that sufficiently covers the booking period.
    // A simple query to find an event with the exact start and end time might be too brittle,
    // as iCal feeds can have slight variations in times.
    // A more robust check finds any event that overlaps significantly with the booking.
    const eventsRef = adminDb.collection('events');
    const potentialBlocksQuery = eventsRef
        .where('userId', '==', userId)
        .where('end', '>=', Timestamp.fromDate(checkin))
        .where('start', '<=', Timestamp.fromDate(checkout));
    
    const snapshot = await potentialBlocksQuery.get();

    if (!snapshot.empty) {
        // An event exists that overlaps with the booking period. We assume this is correct.
        // A more advanced system could check if the event summary contains the confirmation code.
        console.log(`Revenue leak check passed for user ${userId}. A calendar block exists for booking ${confirmationCode}.`);
        return;
    }

    // If we are here, it means NO event was found covering the booking dates.
    console.warn(`Revenue Leak DETECTED for user ${userId}. No calendar block found for new booking ${confirmationCode}.`);
    
    // Create an alert to notify the user.
    await createAlert({
        userId,
        type: 'revenue-leak',
        severity: 'warning',
        source: platform || 'System',
        event: `Booking not found on calendar`,
        details: {
            bookingCode: confirmationCode,
            bookingPlatform: platform,
            checkinDate: new Date(checkinDate).toISOString().split('T')[0],
            checkoutDate: new Date(checkoutDate).toISOString().split('T')[0],
            message: `A new booking confirmation (${confirmationCode}) was received, but no corresponding block was found on your synced calendars after 15 minutes.`
        }
    });
}
