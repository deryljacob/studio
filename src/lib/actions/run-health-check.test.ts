
import { runHealthCheck, RunHealthCheckInput } from './run-health-check';
import { getAdminDb } from '@/lib/firebase-admin';
import { verifyToken } from '@/lib/actions/auth';
import { createAlert } from './create-alert';
import { syncCalendar } from '../services/sync-calendar';
import { Timestamp } from 'firebase-admin/firestore';
import { Calendar, Event } from '@/lib/types';

// --- Mock external dependencies ---
jest.mock('@/lib/firebase-admin');
jest.mock('@/lib/actions/auth');
jest.mock('@/lib/actions/create-alert');
jest.mock('../services/sync-calendar');

const mockGetAdminDb = getAdminDb as jest.Mock;
const mockVerifyToken = verifyToken as jest.Mock;
const mockCreateAlert = createAlert as jest.Mock;
const mockSyncCalendar = syncCalendar as jest.Mock;

describe('runHealthCheck Server Action', () => {
    let mockGet: jest.Mock;
    let mockWhere: jest.Mock;
    let mockCollection: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();

        mockGet = jest.fn();
        mockWhere = jest.fn(() => ({ get: mockGet, where: mockWhere }));
        mockCollection = jest.fn((name) => {
            if (name === 'calendars') return { where: mockWhere };
            if (name === 'events') return { where: mockWhere };
            return {};
        });

        mockGetAdminDb.mockReturnValue({ collection: mockCollection });
        mockVerifyToken.mockResolvedValue({ status: 'success', uid: 'test-user-id' });
    });

    const input: RunHealthCheckInput = { idToken: 'test-token' };

    it('should attempt to sync all ical calendars for the user', async () => {
        const calendars = [
            { id: 'cal1', type: 'ical', feedUrl: 'url1' },
            { id: 'cal2', type: 'google' }, // Should be ignored
            { id: 'cal3', type: 'ical', feedUrl: 'url3' },
        ];
        mockGet.mockResolvedValueOnce({ empty: false, docs: calendars.map(c => ({ id: c.id, data: () => c})) });
        mockGet.mockResolvedValueOnce({ empty: true, docs: [] }); // For double booking check
        mockGet.mockResolvedValueOnce({ empty: true, docs: [] }); // For anomaly check


        mockSyncCalendar.mockResolvedValue(true);

        await runHealthCheck(input);

        expect(mockSyncCalendar).toHaveBeenCalledTimes(2); // Only for the two ical calendars
        expect(mockSyncCalendar).toHaveBeenCalledWith(expect.anything(), 'test-user-id', expect.objectContaining({ id: 'cal1' }));
        expect(mockSyncCalendar).toHaveBeenCalledWith(expect.anything(), 'test-user-id', expect.objectContaining({ id: 'cal3' }));
    });

    it('should create a sync-error alert if a calendar fails to sync', async () => {
        const errorCalendar = {
            id: 'cal-error',
            type: 'ical',
            status: 'active',
            feedUrl: 'http://example.com/error.ics'
        };
        mockGet.mockResolvedValueOnce({ empty: false, docs: [{ id: errorCalendar.id, data: () => errorCalendar }] });
        mockGet.mockResolvedValueOnce({ empty: true, docs: [] }); // For double booking
        mockGet.mockResolvedValueOnce({ empty: true, docs: [] }); // For anomaly check

        mockSyncCalendar.mockResolvedValue(false); // Simulate that the sync fails

        await runHealthCheck(input);

        expect(mockSyncCalendar).toHaveBeenCalledWith(expect.anything(), 'test-user-id', expect.objectContaining(errorCalendar));
        expect(mockCreateAlert).toHaveBeenCalledWith(expect.objectContaining({
            type: 'sync-error',
            details: expect.objectContaining({ calendarId: 'cal-error' })
        }));
    });

    it('should create a double-booking alert if overlapping events are found', async () => {
        const event1 = {
            calendarId: 'cal1',
            start: Timestamp.fromDate(new Date('2024-12-01')),
            end: Timestamp.fromDate(new Date('2024-12-05')),
        };
        const event2 = {
            calendarId: 'cal2', // Different calendar
            start: Timestamp.fromDate(new Date('2024-12-03')), // Overlaps
            end: Timestamp.fromDate(new Date('2024-12-07')),
        };
        mockGet.mockResolvedValueOnce({ empty: true, docs: [] }); // No calendars to sync
        mockGet.mockResolvedValueOnce({ empty: false, docs: [{ data: () => event1 }, { data: () => event2 }] });
        mockGet.mockResolvedValueOnce({ empty: true, docs: [] }); // No anomalies

        await runHealthCheck(input);

        expect(mockCreateAlert).toHaveBeenCalledTimes(1);
        expect(mockCreateAlert).toHaveBeenCalledWith(expect.objectContaining({
            type: 'double-booking',
            severity: 'critical'
        }));
    });

    it('should create a recurring-event alert for events with RRULE', async () => {
        const recurringEvent = {
            summary: 'Recurring Event',
            rawData: '...RRULE:FREQ=WEEKLY...',
            start: Timestamp.fromDate(new Date()),
            end: Timestamp.fromDate(new Date()),
        };
        mockGet.mockResolvedValueOnce({ empty: true, docs: [] }); // No calendars
        mockGet.mockResolvedValueOnce({ empty: true, docs: [] }); // No double bookings
        mockGet.mockResolvedValueOnce({ empty: false, docs: [{ data: () => recurringEvent }] });

        await runHealthCheck(input);
        
        expect(mockCreateAlert).toHaveBeenCalledTimes(1);
        expect(mockCreateAlert).toHaveBeenCalledWith(expect.objectContaining({ type: 'recurring-event' }));
    });

    it('should create a long-stay-block alert for bookings over 30 days', async () => {
        const longStayEvent = {
            summary: 'A very long stay',
            start: Timestamp.fromDate(new Date('2024-01-01')),
            end: Timestamp.fromDate(new Date('2024-02-15')), // > 30 days
            rawData: '',
            platform: 'Airbnb'
        };
        const normalEvent = {
            summary: 'A normal stay',
            start: Timestamp.fromDate(new Date('2024-03-01')),
            end: Timestamp.fromDate(new Date('2024-03-05')),
            rawData: '',
            platform: 'Vrbo'
        }
         mockGet.mockResolvedValueOnce({ empty: true, docs: [] }); // No calendars
        mockGet.mockResolvedValueOnce({ empty: true, docs: [] }); // No double bookings
        mockGet.mockResolvedValueOnce({ empty: false, docs: [{ data: () => longStayEvent }, { data: () => normalEvent }] });

        await runHealthCheck(input);

        expect(mockCreateAlert).toHaveBeenCalledTimes(1);
        expect(mockCreateAlert).toHaveBeenCalledWith(expect.objectContaining({ type: 'long-stay-block' }));
    });
    
    it('should create a suspicious-block alert for events with "blocked" in summary', async () => {
        const suspiciousEvent = {
            summary: 'This date is BLOCKED',
            start: Timestamp.fromDate(new Date()),
            end: Timestamp.fromDate(new Date()),
            rawData: '',
        };
        mockGet.mockResolvedValueOnce({ empty: true, docs: [] }); // No calendars
        mockGet.mockResolvedValueOnce({ empty: true, docs: [] }); // No double bookings
        mockGet.mockResolvedValueOnce({ empty: false, docs: [{ data: () => suspiciousEvent }] });

        await runHealthCheck(input);

        expect(mockCreateAlert).toHaveBeenCalledTimes(1);
        expect(mockCreateAlert).toHaveBeenCalledWith(expect.objectContaining({ type: 'suspicious-block' }));
    });


    it('should NOT create a double-booking alert for overlapping events on the SAME calendar', async () => {
        const event1 = {
            calendarId: 'cal1',
            start: Timestamp.fromDate(new Date('2024-12-01')),
            end: Timestamp.fromDate(new Date('2024-12-05')),
        };
        const event2 = {
            calendarId: 'cal1', // SAME calendar
            start: Timestamp.fromDate(new Date('2024-12-03')),
            end: Timestamp.fromDate(new Date('2024-12-07')),
        };
        mockGet.mockResolvedValueOnce({ empty: true, docs: [] }); // No calendars
        mockGet.mockResolvedValueOnce({ empty: false, docs: [{ data: () => event1 }, { data: () => event2 }] });
        mockGet.mockResolvedValueOnce({ empty: true, docs: [] }); // No anomalies


        await runHealthCheck(input);

        expect(mockCreateAlert).not.toHaveBeenCalled();
    });

    it('should return a success message if no issues are found', async () => {
        mockGet.mockResolvedValue({ empty: true, docs: [] }); // No calendars, no events

        const result = await runHealthCheck(input);

        expect(mockSyncCalendar).not.toHaveBeenCalled();
        expect(mockCreateAlert).not.toHaveBeenCalled();
        expect(result.status).toBe('success');
        expect(result.message).toContain('All systems nominal');
    });

    it('should return an error if token verification fails', async () => {
        mockVerifyToken.mockResolvedValue({ status: 'error', message: 'Invalid token' });
        
        const result = await runHealthCheck(input);

        expect(result.status).toBe('error');
        expect(result.message).toBe('Invalid token');
        expect(mockCollection).not.toHaveBeenCalled();
    });
});
