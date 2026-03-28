
'use server';
/**
 * @fileOverview A server action to perform a comprehensive, on-demand health check.
 * This includes checking for stale calendars, attempting re-syncs, and auditing for double bookings.
 */

import { getAdminDb } from "@/lib/firebase-admin";
import { verifyToken } from "@/lib/actions/auth";
import type { Alert, Calendar as CalendarType, Event as EventType, CreateAlertInput } from "@/lib/types";
import { createAlert } from './create-alert';
import { syncCalendar } from '../services/sync-calendar';
import { Timestamp } from "firebase-admin/firestore";
import { differenceInDays } from 'date-fns';


export interface RunHealthCheckInput {
    idToken: string;
}

export interface RunHealthCheckOutput {
    status: 'success' | 'error';
    message: string;
    alertsCreated: number;
}

// --- Health Check Modules ---

/**
 * Syncs all of the user's iCal calendars and creates alerts for any that fail.
 * @param adminDb - An instance of the Firebase Admin Firestore DB.
 * @param userId - The ID of the user to check.
 * @returns The number of alerts created during the check.
 */
async function syncAllCalendars(adminDb: FirebaseFirestore.Firestore, userId: string): Promise<number> {
    const calendarsRef = adminDb.collection('calendars');
    let alertsCreated = 0;

    const calendarsSnapshot = await calendarsRef.where('userId', '==', userId).where('type', '==', 'ical').get();
    if (calendarsSnapshot.empty) {
        return 0;
    }

    console.log(`Health Check: Found ${calendarsSnapshot.docs.length} iCal calendars to sync for user ${userId}.`);

    const syncPromises = calendarsSnapshot.docs.map(async (doc) => {
        const calendar = { id: doc.id, ...doc.data() } as CalendarType;
        const syncSuccess = await syncCalendar(adminDb, userId, calendar);

        if (!syncSuccess) {
            console.warn(`Health Check: Sync failed for calendar '${calendar.id}'. Creating alert.`);
            await createAlert({
                userId,
                type: 'sync-error',
                severity: 'warning',
                source: calendar.platform,
                event: `Failed to sync calendar`,
                details: {
                    calendarId: calendar.id,
                    feedUrl: calendar.feedUrl,
                    message: `The health check failed to sync this calendar. The iCal link may be broken or the provider may be having issues.`
                }
            });
            return 1;
        }
        return 0;
    });
    
    const results = await Promise.all(syncPromises);
    alertsCreated = results.reduce((sum, current) => sum + current, 0);

    return alertsCreated;
}


/**
 * Performs a full audit of all user events to detect double bookings.
 * @param adminDb - An instance of the Firebase Admin Firestore DB.
 * @param userId - The ID of the user to check.
 * @returns The number of alerts created during the check.
 */
async function checkForDoubleBookings(adminDb: FirebaseFirestore.Firestore, userId: string): Promise<number> {
    const eventsRef = adminDb.collection('events');
    const eventsSnapshot = await eventsRef.where('userId', '==', userId).get();
    if (eventsSnapshot.docs.length < 2) {
        return 0;
    }
    
    const events = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EventType));
    let alertsCreated = 0;
    const foundOverlaps = new Set<string>();

    for (let i = 0; i < events.length; i++) {
        for (let j = i + 1; j < events.length; j++) {
            const eventA = events[i];
            const eventB = events[j];
            const overlapKey = [eventA.id, eventB.id].sort().join('-');

            if (foundOverlaps.has(overlapKey) || eventA.calendarId === eventB.calendarId) {
                continue;
            }

            const startA = (eventA.start as unknown as Timestamp).toDate();
            const endA = (eventA.end as unknown as Timestamp).toDate();
            const startB = (eventB.start as unknown as Timestamp).toDate();
            const endB = (eventB.end as unknown as Timestamp).toDate();

            if (startA <= endB && endA >= startB) {
                console.warn(`Health Check: Double booking found between event ${eventA.id} and ${eventB.id} for user ${userId}.`);
                
                await createAlert({
                    userId,
                    type: 'double-booking',
                    severity: 'critical',
                    source: 'System',
                    event: 'Double booking detected',
                    details: {
                        message: `An overlap was found between "${eventA.summary}" and "${eventB.summary}".`,
                        event1_id: eventA.id,
                        event2_id: eventB.id,
                    }
                });
                alertsCreated++;
                foundOverlaps.add(overlapKey);
            }
        }
    }
    return alertsCreated;
}

/**
 * Audits events for anomalies like suspicious blocks, long stays, and recurring events.
 * @param adminDb - An instance of the Firebase Admin Firestore DB.
 * @param userId - The ID of the user to check.
 * @returns The number of alerts created during the check.
 */
async function auditEventsForAnomalies(adminDb: FirebaseFirestore.Firestore, userId: string): Promise<number> {
    const eventsRef = adminDb.collection('events');
    const eventsSnapshot = await eventsRef.where('userId', '==', userId).get();
    if (eventsSnapshot.empty) {
        return 0;
    }

    const events = eventsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EventType));
    let alertsCreated = 0;
    const bookingPlatforms = ['Airbnb', 'Vrbo', 'Booking.com'];

    for (const event of events) {
        // Rule 1: Suspicious Blockage
        if (event.summary.toLowerCase().includes('blocked') || event.summary.toLowerCase().includes('unavailable')) {
            await createAlert({
                userId,
                type: 'suspicious-block',
                severity: 'info',
                source: 'System',
                event: `Suspicious block: "${event.summary}"`,
                details: { eventId: event.id, summary: event.summary }
            });
            alertsCreated++;
        }

        // Rule 2: Unusually Long Stay
        const start = (event.start as unknown as Timestamp).toDate();
        const end = (event.end as unknown as Timestamp).toDate();
        const duration = differenceInDays(end, start);
        const calendar = await adminDb.collection('calendars').doc(event.calendarId).get().then(doc => doc.data() as CalendarType);

        if (duration > 30 && bookingPlatforms.includes(calendar?.platform)) {
             await createAlert({
                userId,
                type: 'long-stay-block',
                severity: 'critical',
                source: calendar.platform,
                event: `Unusually long block: ${duration} days`,
                details: { eventId: event.id, summary: event.summary, duration }
            });
            alertsCreated++;
        }

        // Rule 3: Recurring Event
        if (event.rawData?.includes('RRULE')) {
             await createAlert({
                userId,
                type: 'recurring-event',
                severity: 'warning',
                source: 'System',
                event: `Recurring event found: "${event.summary}"`,
                details: { eventId: event.id, summary: event.summary }
            });
            alertsCreated++;
        }
    }
    return alertsCreated;
}


// --- Main Action ---

export async function runHealthCheck(input: RunHealthCheckInput): Promise<RunHealthCheckOutput> {
    const { idToken } = input;

    const authResult = await verifyToken(idToken);
    if (authResult.status === 'error' || !authResult.uid) {
        return { status: 'error', message: authResult.message, alertsCreated: 0 };
    }
    const userId = authResult.uid;
    const adminDb = getAdminDb();
    let totalAlerts = 0;
    
    try {
        console.log(`Starting health check for user: ${userId}`);
        
        totalAlerts += await syncAllCalendars(adminDb, userId);
        totalAlerts += await checkForDoubleBookings(adminDb, userId);
        totalAlerts += await auditEventsForAnomalies(adminDb, userId);

        console.log(`Health check finished for user: ${userId}. Found ${totalAlerts} new issues.`);

        if (totalAlerts > 0) {
            return {
                status: 'success',
                message: `Health check complete. ${totalAlerts} new alert(s) have been created for your review.`,
                alertsCreated: totalAlerts,
            };
        }
        
        return {
            status: 'success',
            message: 'Health check complete. All systems nominal.',
            alertsCreated: 0
        };

    } catch (error: any) {
        console.error(`[RUN_HEALTH_CHECK_ERROR] for user ${userId}:`, error);
        return { status: 'error', message: `An unexpected error occurred: ${error.message}`, alertsCreated: totalAlerts };
    }
}
