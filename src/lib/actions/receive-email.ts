
'use server';
/**
 * @fileOverview A server action that acts as a webhook to receive and process inbound emails.
 *
 * This function is designed to be called by an email service provider (e.g., SendGrid, Mailgun)
 * whenever a new email is forwarded to a user's unique address. It parses the email,
 * extracts relevant information, stores it, and triggers business logic like double-booking checks.
 */

import { getAdminDb } from "@/lib/firebase-admin";
import type { Email, BookingDetails, InboundEmailPayload, ReceiveEmailOutput, Event, StuckBlockageTaskPayload, RevenueLeakTaskPayload } from "@/lib/types";
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { createAlert } from './create-alert';
import { CloudTasksClient } from '@google-cloud/tasks';


/**
 * A regex to extract a user ID from a unique forwarding address.
 * It looks for an address in the format of "inbox-USERID@domain.com".
 */
function getUserIdFromEmail(email: string): string | null {
    // Example format: inbox-a4g7k2p9@in.calendarsentinel.com
    // Extracts "a4g7k2p9"
    const match = email.match(/inbox-([a-zA-Z0-9_.-]+)@/);
    return match ? match[1] : null;
}

// A basic classifier to categorize emails.
function getEmailLabel(from: string, subject: string): Email['label'] {
    const lowercasedSubject = subject.toLowerCase();
    const lowercasedFrom = from.toLowerCase();

    if (lowercasedFrom.includes('airbnb') || lowercasedFrom.includes('vrbo') || lowercasedFrom.includes('booking.com') || lowercasedSubject.includes('reservation') || lowercasedSubject.includes('confirmed')) {
        return 'booking';
    }
    if (lowercasedSubject.includes('invoice') || lowercasedSubject.includes('receipt')) {
        return 'receipt';
    }
     if (lowercasedSubject.includes('alert') || lowercasedSubject.includes('warning')) {
        return 'alert';
    }
    return 'other';
}

function isNewBooking(subject: string): boolean {
    const lowerSubject = subject.toLowerCase();
    return (
        lowerSubject.includes('reservation confirmed') ||
        lowerSubject.includes('booking confirmed') ||
        lowerSubject.includes('is confirmed')
    ) && !isCancellation(subject);
}

function isCancellation(subject: string): boolean {
    const lowerSubject = subject.toLowerCase();
    return lowerSubject.includes('cancelled') || lowerSubject.includes('cancellation');
}


// --- Email Parsing Engine ---

/**
 * Tries to parse booking details from a JSON-LD script tag in the email's HTML.
 * This is the most reliable method.
 */
function parseWithJsonLd(html: string): BookingDetails | null {
  try {
    const jsonLdRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/i;
    const match = html.match(jsonLdRegex);
    if (!match || !match[1]) return null;

    const json = JSON.parse(match[1]);
    
    // Check if it's a LodgingReservation schema
    if (json['@type'] === 'LodgingReservation') {
      return {
        platform: json.provider?.name,
        confirmationCode: json.reservationId,
        checkinDate: json.checkinTime ? new Date(json.checkinTime).toISOString() : undefined,
        checkoutDate: json.checkoutTime ? new Date(json.checkoutTime).toISOString() : undefined,
        guestName: json.underName?.name,
        totalPrice: `${json.totalPrice} ${json.priceCurrency}`,
        source: 'json-ld'
      };
    }
    return null;
  } catch (error) {
    console.warn("Could not parse JSON-LD:", error);
    return null;
  }
}

/**
 * If JSON-LD fails, try platform-specific regular expressions.
 * This is more brittle but necessary for platforms that don't use schemas.
 */
function parseWithRegex(html: string, from: string): BookingDetails | null {
    const lowerFrom = from.toLowerCase();
    let details: Partial<BookingDetails> = { source: 'regex' };

    if (lowerFrom.includes('airbnb')) {
        details.platform = 'Airbnb';
        details.confirmationCode = html.match(/Reservation code:.*?<span.*?>\s*([A-Z0-9]+)\s*<\/span>/)?.[1];
        details.checkinDate = html.match(/Check-in.*?<div.*?>.*?(\w+\s\d+,\s\d{4})<\/div>/)?.[1];
        details.checkoutDate = html.match(/Checkout.*?<div.*?>.*?(\w+\s\d+,\s\d{4})<\/div>/)?.[1];
    } else if (lowerFrom.includes('vrbo') || lowerFrom.includes('homeaway')) {
        details.platform = 'Vrbo';
        details.confirmationCode = html.match(/Confirmation\sCode:\s*([A-Z0-9]+)/i)?.[1];
        details.checkinDate = html.match(/Check-in:.*?<td.*?>\s*(\w+\s\d+,\s\d{4})\s*<\/td>/i)?.[1];
        details.checkoutDate = html.match(/Check-out:.*?<td.*?>\s*(\w+\s\d+,\s\d{4})\s*<\/td>/i)?.[1];
    }
    
    if (details.confirmationCode && (details.checkinDate || details.checkoutDate)) {
        return details as BookingDetails;
    }

    return null;
}

/**
 * As a final fallback, parse the plain text of the email for common keywords.
 * This is the least reliable method.
 */
function parseWithGeneric(text: string): BookingDetails | null {
    let details: Partial<BookingDetails> = { source: 'generic' };

    details.confirmationCode = text.match(/(?:Confirmation|Reservation)\s*(?:code|#|number|ID):\s*([A-Za-z0-9]+)/i)?.[1];
    details.checkinDate = text.match(/Check-in(?:\sdate)?:?\s*(\w+\s\d+,?\s\d{4})/i)?.[1];
    details.checkoutDate = text.match(/Check-out(?:\sdate)?:?\s*(\w+\s\d+,?\s\d{4})/i)?.[1];
    details.guestName = text.match(/Guest(?:\sName)?:?\s*(.*)/i)?.[1]?.trim();

    if (details.confirmationCode && (details.checkinDate || details.checkoutDate)) {
        return details as BookingDetails;
    }
    
    return null;
}

/**
 * Main parsing function that orchestrates the parsing strategies.
 */
function parseBookingEmail(payload: InboundEmailPayload): BookingDetails {
    // 1. Try with JSON-LD first (most reliable)
    const fromJsonLd = parseWithJsonLd(payload.html);
    if (fromJsonLd) return fromJsonLd;

    // 2. Fallback to platform-specific regex
    const fromRegex = parseWithRegex(payload.html, payload.from);
    if (fromRegex) return fromRegex;

    // 3. Fallback to generic keyword matching on plain text
    const fromGeneric = parseWithGeneric(payload.text);
    if (fromGeneric) return fromGeneric;

    // 4. If all else fails, return no details
    return { source: 'none' };
}

/**
 * Checks for double bookings against existing calendar events in Firestore.
 * @param userId The ID of the user.
 * @param newBooking The details of the new booking.
 */
async function checkForDoubleBooking(userId: string, newBooking: BookingDetails) {
    if (!newBooking.checkinDate || !newBooking.checkoutDate) {
        console.log(`Skipping double booking check for user ${userId} due to missing dates.`);
        return;
    }

    const adminDb = getAdminDb();
    const newBookingStart = new Date(newBooking.checkinDate);
    const newBookingEnd = new Date(newBooking.checkoutDate);

    // Query for any events that overlap with the new booking's date range.
    // An event overlaps if its start is before the new booking ends AND its end is after the new booking starts.
    const eventsRef = adminDb.collection('events');
    const overlappingEventsQuery = eventsRef
        .where('userId', '==', userId)
        .where('start', '<=', Timestamp.fromDate(newBookingEnd))
        .where('end', '>=', Timestamp.fromDate(newBookingStart));
    
    const snapshot = await overlappingEventsQuery.get();

    if (snapshot.empty) {
        console.log(`No conflicting events found for user ${userId}.`);
        return;
    }

    const conflictingEvent = snapshot.docs[0].data() as Event;
    const calendarRef = await adminDb.collection('calendars').doc(conflictingEvent.calendarId).get();
    const conflictingCalendarName = calendarRef.exists ? calendarRef.data()?.platform : 'Unknown Calendar';
    
    console.warn(`Double booking detected for user ${userId}! New booking ${newBooking.confirmationCode} conflicts with existing event ${conflictingEvent.eventId}`);

    await createAlert({
        userId,
        type: 'double-booking',
        severity: 'critical',
        source: newBooking.platform || 'Email',
        event: `Double booking detected with ${conflictingCalendarName}`,
        details: {
            newBookingCode: newBooking.confirmationCode,
            newBookingPlatform: newBooking.platform,
            conflictingEventId: conflictingEvent.eventId,
            conflictingCalendarName: conflictingCalendarName,
            checkinDate: newBooking.checkinDate,
            checkoutDate: newBooking.checkoutDate,
        }
    });
}

/**
 * Enqueues a task to check for a stuck calendar blockage one hour in the future.
 * @param userId The ID of the user.
 * @param cancelledBooking The details of the cancelled booking.
 */
async function enqueueStuckBlockageCheck(userId: string, cancelledBooking: BookingDetails) {
    if (!cancelledBooking.checkinDate || !cancelledBooking.confirmationCode) {
        console.log(`Skipping stuck blockage check for user ${userId} due to missing details.`);
        return;
    }
    
    // These values MUST be set as environment variables in your App Hosting backend.
    const project = process.env.GCP_PROJECT_ID;
    const location = process.env.GCP_REGION; // e.g. us-central1
    const queue = 'stuck-blockage-queue';

    if (!project || !location) {
        console.error('[CloudTasks] GCP_PROJECT_ID or GCP_REGION environment variables are not set.');
        // Fail silently in the context of email processing, but log the error.
        return;
    }

    const tasksClient = new CloudTasksClient();
    const queuePath = tasksClient.queuePath(project, location, queue);

    // The URL of your App Hosting backend + the API route for the task handler.
    const url = `https://${process.env.APP_HOSTING_BACKEND_ID}.apphosting.dev/api/tasks/stuck-blockage-checker`;

    const payload: StuckBlockageTaskPayload = {
        userId,
        cancelledBookingCode: cancelledBooking.confirmationCode,
        checkinDate: cancelledBooking.checkinDate,
        checkoutDate: cancelledBooking.checkoutDate,
    };
    
    // Schedule the task to run in 1 hour.
    const ONE_HOUR_IN_SECONDS = 3600;
    const scheduleTime = new Date(Date.now() + ONE_HOUR_IN_SECONDS * 1000);

    const task = {
        httpRequest: {
            httpMethod: 'POST' as const,
            url,
            headers: {
                'Content-Type': 'application/json',
            },
            // The task payload, converted to a Base64-encoded string.
            body: Buffer.from(JSON.stringify(payload)).toString('base64'),
            // Authenticate the request from Cloud Tasks to the handler.
            oidcToken: {
                // The service account email of the App Hosting backend itself.
                serviceAccountEmail: `service-${process.env.GCP_PROJECT_NUMBER}@gcp-sa-apphosting.iam.gserviceaccount.com`,
            },
        },
        scheduleTime: {
            seconds: Math.floor(scheduleTime.getTime() / 1000),
        },
    };

    try {
        const [response] = await tasksClient.createTask({ parent: queuePath, task });
        console.log(`Created Cloud Task ${response.name} for user ${userId} to check for stuck blockage.`);
    } catch (error) {
        console.error('[CloudTasks] Error creating task for stuck blockage check:', error);
        // Do not re-throw, as we don't want to fail the entire email processing step.
    }
}

/**
 * Enqueues a task to check for a revenue leak 15 minutes in the future.
 * @param userId The ID of the user.
 * @param newBooking The details of the new booking.
 */
async function enqueueRevenueLeakCheck(userId: string, newBooking: BookingDetails) {
    if (!newBooking.checkinDate || !newBooking.confirmationCode) {
        console.log(`Skipping revenue leak check for user ${userId} due to missing details.`);
        return;
    }

    const project = process.env.GCP_PROJECT_ID;
    const location = process.env.GCP_REGION;
    // We can reuse the same queue for multiple task types.
    const queue = 'stuck-blockage-queue'; 
    
    if (!project || !location) {
        console.error('[CloudTasks] GCP_PROJECT_ID or GCP_REGION environment variables are not set.');
        return;
    }

    const tasksClient = new CloudTasksClient();
    const queuePath = tasksClient.queuePath(project, location, queue);

    const url = `https://${process.env.APP_HOSTING_BACKEND_ID}.apphosting.dev/api/tasks/revenue-leak-checker`;

    const payload: RevenueLeakTaskPayload = {
        userId,
        bookingDetails: newBooking,
    };

    // Schedule the task to run in 15 minutes to allow iCal feeds time to update.
    const FIFTEEN_MINUTES_IN_SECONDS = 900;
    const scheduleTime = new Date(Date.now() + FIFTEEN_MINUTES_IN_SECONDS * 1000);

    const task = {
        httpRequest: {
            httpMethod: 'POST' as const,
            url,
            headers: { 'Content-Type': 'application/json' },
            body: Buffer.from(JSON.stringify(payload)).toString('base64'),
            oidcToken: {
                serviceAccountEmail: `service-${process.env.GCP_PROJECT_NUMBER}@gcp-sa-apphosting.iam.gserviceaccount.com`,
            },
        },
        scheduleTime: {
            seconds: Math.floor(scheduleTime.getTime() / 1000),
        },
    };

    try {
        const [response] = await tasksClient.createTask({ parent: queuePath, task });
        console.log(`Created Cloud Task ${response.name} for user ${userId} to check for revenue leak.`);
    } catch (error) {
        console.error('[CloudTasks] Error creating task for revenue leak check:', error);
    }
}


export async function receiveEmail(payload: InboundEmailPayload): Promise<ReceiveEmailOutput> {
    
    // SECURITY: In a production application, you MUST verify the request came from your email provider
    // using a webhook signing key or a secret. This prevents anyone from being able to post fake emails.
    const adminDb = getAdminDb();
    const { to, from, subject, html } = payload;
    
    // 1. Identify the user based on the unique "to" address
    const userId = getUserIdFromEmail(to);

    if (!userId) {
        console.error(`[RECEIVE_EMAIL_ERROR] Could not extract user ID from email address: ${to}`);
        return { status: 'error', message: `Invalid recipient address format.` };
    }

    try {
        // 2. Parse the email to extract booking details
        const bookingDetails = parseBookingEmail(payload);

        // 3. Prepare the data for Firestore
        const newEmail: Omit<Email, 'id' | 'receivedAt'> & { receivedAt: FieldValue } = {
            userId: userId,
            from: from,
            subject: subject,
            // SECURITY: In a real app, you would sanitize this HTML to prevent XSS attacks before rendering.
            body: html, 
            receivedAt: FieldValue.serverTimestamp(),
            isRead: false,
            label: getEmailLabel(from, subject),
            bookingDetails: bookingDetails
        };

        // 4. Add the new email to the 'emails' collection using the Admin SDK
        const emailRef = await adminDb.collection("emails").add(newEmail);
        console.log(`Successfully stored email ${emailRef.id} from ${from} for user ${userId}`);

        // --- Trigger Business Logic ---
        if (bookingDetails.source !== 'none') {
            if (isNewBooking(subject)) {
                // Immediate check for overlaps with existing events.
                await checkForDoubleBooking(userId, bookingDetails);
                // Delayed check to ensure this new booking appears on the calendar.
                await enqueueRevenueLeakCheck(userId, bookingDetails);
            } else if (isCancellation(subject)) {
                // Delayed check to ensure the calendar block is removed.
                await enqueueStuckBlockageCheck(userId, bookingDetails);
            }
        }
        
        return { status: 'success', message: 'Email processed successfully.' };

    } catch (error: any) {
        console.error(`[RECEIVE_EMAIL_ERROR] for user ${userId}:`, error);
        return { status: 'error', message: `Failed to store email: ${error.message}` };
    }
}
