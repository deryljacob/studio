
// This is a simplified testing environment.
// We'll simulate the logic from the CalendarsPage component.
import { v5 as uuidv5 } from 'uuid';

const ICAL_NAMESPACE = 'a8f6a2c0-f823-4e4b-87d5-2f847b7c2a79';
type EventType = {
  id: string;
  eventId: string;
  calendarId: string;
  userId: string;
  start: Date;
  end: Date;
  summary: string;
  rawData: string;
};

// Extracted from CalendarsPage for isolated testing
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

            if (startDateStr.length === 8 && endDateStr.length === 8 && start < end) {
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

describe('simpleIcsParser', () => {
    const calendarId = 'test-calendar';
    const userId = 'test-user';

    it('should parse a single, all-day event correctly', () => {
        const icalData = `
BEGIN:VEVENT
DTSTART;VALUE=DATE:20240801
DTEND;VALUE=DATE:20240802
UID:single-day-event
SUMMARY:Single Day Booking
END:VEVENT
        `.trim();
        const events = simpleIcsParser(icalData, calendarId, userId);
        expect(events).toHaveLength(1);
        expect(events[0].summary).toBe('Single Day Booking');
        expect(events[0].start).toEqual(new Date('2024-08-01T00:00:00.000Z'));
        // The end date is exclusive in iCal for all-day, so it should be the same as the start date after parsing.
        expect(events[0].end).toEqual(new Date('2024-08-01T00:00:00.000Z'));
    });

    it('should parse a multi-day, all-day event correctly', () => {
        const icalData = `
BEGIN:VEVENT
DTSTART;VALUE=DATE:20240810
DTEND;VALUE=DATE:20240815
UID:multi-day-event
SUMMARY:Week Long Stay
END:VEVENT
        `.trim();
        const events = simpleIcsParser(icalData, calendarId, userId);
        expect(events).toHaveLength(1);
        expect(events[0].summary).toBe('Week Long Stay');
        expect(events[0].start).toEqual(new Date('2024-08-10T00:00:00.000Z'));
        // End date is inclusive after parsing (8/15 -> 8/14)
        expect(events[0].end).toEqual(new Date('2024-08-14T00:00:00.000Z'));
    });

    it('should parse an event with specific start and end times (UTC)', () => {
        const icalData = `
BEGIN:VEVENT
DTSTART:20240820T140000Z
DTEND:20240822T110000Z
UID:timed-event
SUMMARY:Check-in/Check-out
END:VEVENT
        `.trim();
        const events = simpleIcsParser(icalData, calendarId, userId);
        expect(events).toHaveLength(1);
        expect(events[0].summary).toBe('Check-in/Check-out');
        expect(events[0].start).toEqual(new Date('2024-08-20T14:00:00.000Z'));
        // For timed events, the end date is not adjusted.
        expect(events[0].end).toEqual(new Date('2024-08-22T11:00:00.000Z'));
    });

    it('should handle multiple events in one feed', () => {
        const icalData = `
BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART;VALUE=DATE:20240901
DTEND;VALUE=DATE:20240902
UID:event1
SUMMARY:First Event
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20240905
DTEND;VALUE=DATE:20240908
UID:event2
SUMMARY:Second Event
END:VEVENT
END:VCALENDAR
        `.trim();
        const events = simpleIcsParser(icalData, calendarId, userId);
        expect(events).toHaveLength(2);
        expect(events.find(e => e.eventId === 'event1')?.summary).toBe('First Event');
        expect(events.find(e => e.eventId === 'event2')?.summary).toBe('Second Event');
    });

    it('should assign a default summary if one is not provided', () => {
        const icalData = `
BEGIN:VEVENT
DTSTART;VALUE=DATE:20241001
DTEND;VALUE=DATE:20241002
UID:no-summary-event
END:VEVENT
        `.trim();
        const events = simpleIcsParser(icalData, calendarId, userId);
        expect(events).toHaveLength(1);
        expect(events[0].summary).toBe('No Title');
    });
    
    it('should return an empty array for an empty iCal string', () => {
        const events = simpleIcsParser('', calendarId, userId);
        expect(events).toEqual([]);
    });
});
