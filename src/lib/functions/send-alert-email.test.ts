
// Set up environment variables for testing
process.env.ZEPTOMAIL_SEND_MAIL_TOKEN = 'test-zeptomail-token';
process.env.ZEPTOMAIL_FROM_EMAIL = 'noreply@test.com';

import functionsTest from 'firebase-functions-test';
import { sendAlertEmail } from './send-alert-email'; 
import type { Alert } from '@/lib/types';
import { getAdminDb } from '../firebase-admin';

// Mock the fetch API used by ZeptoMail sender
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock firebase-admin
jest.mock('../firebase-admin', () => ({
    getAdminDb: jest.fn(() => ({
        collection: jest.fn((name: string) => ({
            doc: jest.fn((id: string) => ({
                get: jest.fn(),
            })),
        })),
    })),
}));

const testEnv = functionsTest();

describe('Cloud Function: sendAlertEmail', () => {

    let getDocMock: jest.Mock;
    let docMock: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        
        getDocMock = jest.fn();
        docMock = jest.fn(() => ({ get: getDocMock }));
        (getAdminDb() as any).collection.mockReturnValue({ doc: docMock });
    });

    afterAll(() => {
        testEnv.cleanup();
    });

    const wrapped = testEnv.wrap(sendAlertEmail);
    
    it('should send an email for a critical alert when user preferences allow it', async () => {
        const alert: Alert = {
            id: 'alert1',
            userId: 'user1',
            type: 'double-booking',
            severity: 'critical',
            status: 'pending',
            source: 'System',
            event: 'Double Booking Detected',
            details: { message: 'A critical issue occurred' },
            createdAt: new Date(),
        };

        const makeSnapshot = testEnv.firestore.makeDocumentSnapshot(alert, 'alerts/alert1');
        
        // Mock user data response from Firestore
        getDocMock.mockResolvedValue({
            exists: true,
            data: () => ({ email: 'test@example.com', emailAlerts: true }),
        });

        // Mock a successful API call to ZeptoMail
        mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ message: 'success' }) });

        await wrapped(makeSnapshot);

        expect(getDocMock).toHaveBeenCalled();
        expect(docMock).toHaveBeenCalledWith('user1');
        expect(mockFetch).toHaveBeenCalledTimes(1);
        
        const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(fetchBody.to[0].email_address.address).toBe('test@example.com');
        expect(fetchBody.subject).toContain('[CRITICAL]');
        expect(fetchBody.htmlbody).toContain('Double Booking Detected');
    });

    it('should NOT send an email for an "info" level alert', async () => {
        const alert: Alert = {
            id: 'alert2',
            userId: 'user2',
            type: 'suspicious-block',
            severity: 'info',
            status: 'pending',
            source: 'System',
            event: 'Manual block found',
            createdAt: new Date(),
        };

        const makeSnapshot = testEnv.firestore.makeDocumentSnapshot(alert, 'alerts/alert2');
        await wrapped(makeSnapshot);

        expect(mockFetch).not.toHaveBeenCalled();
        expect(docMock).not.toHaveBeenCalled(); // Shouldn't even check user prefs
    });

    it('should NOT send an email if the user has emailAlerts disabled', async () => {
        const alert: Alert = {
            id: 'alert3',
            userId: 'user3',
            type: 'sync-error',
            severity: 'warning',
            status: 'pending',
            source: 'Airbnb',
            event: 'Sync failed',
            createdAt: new Date(),
        };

        const makeSnapshot = testEnv.firestore.makeDocumentSnapshot(alert, 'alerts/alert3');

        // Mock user with alerts turned off
        getDocMock.mockResolvedValue({
            exists: true,
            data: () => ({ email: 'test3@example.com', emailAlerts: false }),
        });

        await wrapped(makeSnapshot);

        expect(getDocMock).toHaveBeenCalled();
        expect(docMock).toHaveBeenCalledWith('user3');
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should NOT send an email if the user document does not exist', async () => {
        const alert: Alert = {
            id: 'alert4',
            userId: 'user4-nonexistent',
            type: 'revenue-leak',
            severity: 'warning',
            status: 'pending',
            source: 'System',
            event: 'Booking not found',
            createdAt: new Date(),
        };

        const makeSnapshot = testEnv.firestore.makeDocumentSnapshot(alert, 'alerts/alert4');
        
        // Mock user not found
        getDocMock.mockResolvedValue({ exists: false });

        await wrapped(makeSnapshot);

        expect(getDocMock).toHaveBeenCalled();
        expect(mockFetch).not.toHaveBeenCalled();
    });
});
