
import { runStuckBlockageCheck } from './run-stuck-blockage-check';
import { getAdminDb } from '@/lib/firebase-admin';
import { createAlert } from '@/lib/actions/create-alert';
import { StuckBlockageTaskPayload } from '@/lib/types';
import { Timestamp } from 'firebase-admin/firestore';

// --- Mocking Firebase Admin and other actions ---
const mockGet = jest.fn();
const mockWhere = jest.fn(() => ({
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

describe('runStuckBlockageCheck Service', () => {

    const testPayload: StuckBlockageTaskPayload = {
        userId: 'user-stuck-block-test',
        cancelledBookingCode: 'CANCELLED123',
        checkinDate: new Date('2024-10-10T14:00:00Z').toISOString(),
        checkoutDate: new Date('2024-10-15T11:00:00Z').toISOString(),
    };

    beforeEach(() => {
        mockGet.mockClear();
        mockWhere.mockClear();
        (createAlert as jest.Mock).mockClear();
    });

    it('should NOT create an alert if no overlapping events are found after cancellation', async () => {
        // Simulate Firestore returning no events in the date range
        mockGet.mockResolvedValueOnce({ empty: true, docs: [] });

        await runStuckBlockageCheck(testPayload);

        // Verify it queried the correct collection with the correct user and date range
        expect(mockCollection).toHaveBeenCalledWith('events');
        expect(mockWhere).toHaveBeenCalledWith('userId', '==', testPayload.userId);
        const checkinTimestamp = Timestamp.fromDate(new Date(testPayload.checkinDate));
        const checkoutTimestamp = Timestamp.fromDate(new Date(testPayload.checkoutDate!));
        expect(mockWhere).toHaveBeenCalledWith('end', '>=', checkinTimestamp);
        expect(mockWhere).toHaveBeenCalledWith('start', '<=', checkoutTimestamp);

        // Crucially, verify createAlert was NOT called
        expect(createAlert).not.toHaveBeenCalled();
    });

    it('should CREATE an alert if an overlapping event IS found after cancellation', async () => {
        const stuckEvent = {
            id: 'stuck-event-1',
            summary: 'This should have been removed',
            start: Timestamp.fromDate(new Date('2024-10-11T00:00:00.000Z')),
            end: Timestamp.fromDate(new Date('2024-10-14T00:00:00.000Z')),
        };
        // Simulate Firestore finding one event that is still blocking the calendar
        mockGet.mockResolvedValueOnce({
            empty: false,
            docs: [{ data: () => stuckEvent, id: stuckEvent.id }]
        });
        
        await runStuckBlockageCheck(testPayload);

        // Verify createAlert WAS called
        expect(createAlert).toHaveBeenCalledTimes(1);

        const alertCallArgs = (createAlert as jest.Mock).mock.calls[0][0];

        expect(alertCallArgs.type).toBe('stuck-blockage');
        expect(alertCallArgs.severity).toBe('warning');
        expect(alertCallArgs.userId).toBe(testPayload.userId);
        expect(alertCallArgs.details.cancelledBookingCode).toBe(testPayload.cancelledBookingCode);
        expect(alertCallArgs.details.stuckEventId).toBe(stuckEvent.id);
        expect(alertCallArgs.event).toContain('Calendar block still present after cancellation');
    });

    it('should handle missing checkout date gracefully', async () => {
        const payloadWithoutCheckout = { ...testPayload, checkoutDate: undefined };
        
        await runStuckBlockageCheck(payloadWithoutCheckout);
        
        // Check that the query still ran, using the checkin date for both start and end
        expect(mockWhere).toHaveBeenCalledWith('end', '>=', Timestamp.fromDate(new Date(testPayload.checkinDate)));
        expect(mockWhere).toHaveBeenCalledWith('start', '<=', Timestamp.fromDate(new Date(testPayload.checkinDate)));
    });

});
