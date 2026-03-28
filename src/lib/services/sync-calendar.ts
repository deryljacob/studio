
/**
 * @fileOverview A reusable server-side service to sync a single iCal calendar.
 * This encapsulates the logic for fetching, parsing, and updating Firestore,
 * making it usable by both on-demand health checks and future background jobs.
 */

import type { Calendar, Event as EventType } from "@/lib/types";
import { v5 as uuidv5 } from 'uuid';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

const ICAL_NAMESPACE = 'a8f6a2c0-f823-4e4b-87d5-2f847b7c2a79';

// Note: This function is nearly identical to the one in `calendars/page.tsx`.
// In a real-world refactor, you would consolidate this into a single utility.
function simpleIcsParser(icalData: string, calendarId: string, userId: string): EventType[] {
    const events: EventType[] = [];
    const eventRegex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
    let match;

    while ((match = eventRegex.exec(icalData)) !== null) {
        const eventBlock = match[1];
        
        const uidMatch = /UID:(.*)/.exec(eventBlock);
        const dtstartMatch = /DTSTART(?:;[^:]+)?:(.*)/.exec(eventBlock);
        const dtendMatch = /DTEND(?:;[^:]+)?:(.*)/.exec(eventBlock);
        const summaryMatch = /SUMMARY:(.*)/.exec(eventBlock);

        if (uidMatch && dtstartMatch && dtendMatch) {
            const uid = uidMatch[1].trim();
            const startDateStr = dtstartMatch[1].trim();
            const endDateStr = dtendMatch[1].trim();
            const summary = (summaryMatch ? summaryMatch[1].trim() : 'No Title');
            
            const parseDate = (dateStr: string) => {
                const year = parseInt(dateStr.substring(0, 4), 10);
                const month = parseInt(dateStr.substring(4, 6), 10) - 1;
                const day = parseInt(dateStr.substring(6, 8), 10);

                if (dateStr.length > 8 && dateStr.includes('T')) {
                    const hour = parseInt(dateStr.substring(9, 11), 10);
                    const minute = parseInt(dateStr.substring(11, 13), 10);
                    const second = parseInt(dateStr.substring(13, 15), 10);
                    return new Date(Date.UTC(year, month, day, hour, minute, second));
                } else {
                    return new Date(Date.UTC(year, month, day));
                }
            };

            const start = parseDate(startDateStr);
            let end = parseDate(endDateStr);

            if (startDateStr.length === 8 && endDateStr.length === 8 && start.getTime() < end.getTime()) {
                end.setDate(end.getDate() - 1);
            }
            
            const eventId = uuidv5(`${calendarId}-${uid}`, ICAL_NAMESPACE);

            events.push({
                id: eventId,
                eventId: uid,
                calendarId: calendarId,
                userId: userId,
                start: start,
                end: end,
                summary: summary,
                rawData: eventBlock
            });
        }
    }
    return events;
}


async function fetchCalendarData(url: string): Promise<{ success: boolean; data?: string; error?: string }> {
     try {
        const fetchUrl = url.replace(/webcal(s?):\/\//, 'https://');
        const response = await fetch(fetchUrl, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (compatible; CalendarSentinel/1.0; +https://yourwebsite.com/bot)' 
            },
            redirect: 'follow',
        });

        if (!response.ok) {
            return { success: false, error: `Provider returned HTTP status ${response.status}.` };
        }
        
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("text/calendar")) {
            return { success: false, error: `Invalid content type: ${contentType}` };
        }

        const icalData = await response.text();
        if (!icalData || !icalData.trim().startsWith('BEGIN:VCALENDAR')) {
            return { success: false, error: "Response was not a valid calendar file." };
        }

        return { success: true, data: icalData };
    } catch (error: any) {
        console.error('[SYNC_CALENDAR_FETCH_ERROR]', error);
        return { success: false, error: `A network error occurred: ${error.message}` };
    }
}


export async function syncCalendar(adminDb: FirebaseFirestore.Firestore, userId: string, calendar: Calendar): Promise<boolean> {
    const calendarDocRef = adminDb.collection("calendars").doc(calendar.id);

    // 1. Fetch data
    const result = await fetchCalendarData(calendar.feedUrl);

    if (!result.success || !result.data) {
        await calendarDocRef.update({ status: 'error', lastSync: new Date().toISOString(), lastError: result.error });
        return false;
    }

    try {
        // 2. Parse and Write to DB
        const newEvents = simpleIcsParser(result.data, calendar.id, userId);
        
        const userEventsRef = adminDb.collection("events");
        const q = userEventsRef.where("userId", "==", userId).where("calendarId", "==", calendar.id);
        const existingEventsSnapshot = await q.get();
        const existingEventIds = new Set(existingEventsSnapshot.docs.map(doc => doc.id));
        const newEventIds = new Set(newEvents.map(e => e.id));
        
        const batch = adminDb.batch();

        // Add/update new events
        newEvents.forEach(event => {
            const eventRef = adminDb.collection('events').doc(event.id);
            // Firestore Admin SDK requires plain objects, not class instances
            const plainEventObject = {
                 ...event,
                 start: Timestamp.fromDate(event.start),
                 end: Timestamp.fromDate(event.end),
                 syncedAt: FieldValue.serverTimestamp()
            };
            batch.set(eventRef, plainEventObject, { merge: true });
        });

        // Delete old events no longer in the feed
        existingEventIds.forEach(id => {
            if (!newEventIds.has(id)) {
                batch.delete(adminDb.collection('events').doc(id));
            }
        });

        // Update calendar status to active
        batch.update(calendarDocRef, { status: 'active', lastSync: new Date().toISOString(), lastError: null });

        await batch.commit();
        return true;
    } catch (error: any) {
        console.error(`Error processing calendar ${calendar.id}:`, error);
        await calendarDocRef.update({ status: 'error', lastSync: new Date().toISOString(), lastError: 'Failed to process and save events.' });
        return false;
    }
}
