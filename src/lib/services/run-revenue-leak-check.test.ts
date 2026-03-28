
import { runRevenueLeakCheck } from './run-revenue-leak-check';
import { getAdminDb } from '@/lib/firebase-admin';
import { createAlert } from '@/lib/actions/create-alert';
import { RevenueLeakTaskPayload } from '@/lib/types';
import { Timestamp } from 'firebase-admin/firestore';

// --- Mocking Firebase Admin and other actions ---
const mockGet = jest.fn();
const mockWhere = jest.fn((fieldPath, opStr, value) => ({
    where: mockWhere,
    get: mockGet,
}));
const mockCollection = jest.fn(() => ({
    where: mockWhere,
}));

jest.mock('@/lib/firebase-admin', () => ({
  getAdminDb: () => ({
    collection: mockCollection,
  }),
}));

jest.mock('@/lib/actions/create-alert', () => ({
  createAlert: jest.fn(),
}));
// --------------------------------

/**
 * Normalizes a date to the start of the day in UTC for testing.
 * This mirrors the logic in the service to ensure test consistency.
 */
const getStartOfDay = (date: Date | string): Date => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};


describe('runRevenueLeakCheck Service', () => {

    const testPayload: RevenueLeakTaskPayload = {
        userId: 'user-revenue-leak-test',
        bookingDetails: {
            confirmationCode: 'BOOKING123',
            platform: 'Airbnb',
            checkinDate: new Date('2024-11-01T16:00:00Z').toISOString(),
            checkoutDate: new Date('2024-11-05T11:00:00Z').toISOString(),
            source: 'json-ld'
        }
    };

    beforeEach(() => {
        mockGet.mockClear();
        mockWhere.mockClear();
        (createAlert as jest.Mock).mockClear();
        mockCollection.mockClear();
    });

    it('should NOT create an alert if a corresponding calendar event is found', async () => {
        // Simulate Firestore finding an overlapping event
        const existingEvent = {
            id: 'event-1',
            summary: 'Booking HMJ...',
            // Event start/end are at midnight, booking times are mid-day.
            // The service should normalize these to match correctly.
            start: Timestamp.fromDate(new Date('2024-11-01T00:00:00Z')),
            end: Timestamp.fromDate(new Date('2024-11-05T00:00:00Z')),
        };
        mockGet.mockResolvedValueOnce({
            empty: false,
            docs: [{ data: () => existingEvent }]
        });

        await runRevenueLeakCheck(testPayload);

        // Verify it queried the correct collection with the correct user and date range
        expect(mockCollection).toHaveBeenCalledWith('events');
        expect(mockWhere).toHaveBeenCalledWith('userId', '==', testPayload.userId);
        
        // Check that the query used the normalized start-of-day dates
        const expectedCheckinStart = Timestamp.fromDate(getStartOfDay(testPayload.bookingDetails.checkinDate!));
        const expectedCheckoutStart = Timestamp.fromDate(getStartOfDay(testPayload.bookingDetails.checkoutDate!));
        
        expect(mockWhere).toHaveBeenCalledWith('end', '>=', expectedCheckinStart);
        expect(mockWhere).toHaveBeenCalledWith('start', '<=', expectedCheckoutStart);

        // Crucially, verify createAlert was NOT called
        expect(createAlert).not.toHaveBeenCalled();
    });

    it('should CREATE a "revenue-leak" alert if no calendar event is found', async () => {
        // Simulate Firestore finding no events
        mockGet.mockResolvedValueOnce({ empty: true, docs: [] });
        
        await runRevenueLeakCheck(testPayload);

        // Verify createAlert WAS called
        expect(createAlert).toHaveBeenCalledTimes(1);

        const alertCallArgs = (createAlert as jest.Mock).mock.calls[0][0];

        expect(alertCallArgs.type).toBe('revenue-leak');
        expect(alertCallArgs.severity).toBe('warning');
        expect(alertCallArgs.userId).toBe(testPayload.userId);
        expect(alertCallArgs.source).toBe(testPayload.bookingDetails.platform);
        expect(alertCallArgs.details.bookingCode).toBe(testPayload.bookingDetails.confirmationCode);
        expect(alertCallArgs.event).toContain('Booking not found on calendar');
    });
    
    it('should not run if booking details are incomplete', async () => {
        const incompletePayload: RevenueLeakTaskPayload = {
            userId: 'user-revenue-leak-test',
            bookingDetails: {
                confirmationCode: 'BOOKING123',
                source: 'generic',
                // Missing dates
            }
        };

        await runRevenueLeakCheck(incompletePayload);

        // None of the database or alert functions should be called
        expect(mockCollection).not.toHaveBeenCalled();
        expect(createAlert).not.toHaveBeenCalled();
    });

});
