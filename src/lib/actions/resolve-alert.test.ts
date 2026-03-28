
'use server';

import { resolveAlert, ResolveAlertInput } from './resolve-alert';
import { getAdminDb } from '@/lib/firebase-admin';
import { verifyToken } from '@/lib/actions/auth';
import { Timestamp } from 'firebase-admin/firestore';

// --- Mock external dependencies ---
jest.mock('@/lib/firebase-admin');
jest.mock('@/lib/actions/auth');

const mockGetAdminDb = getAdminDb as jest.Mock;
const mockVerifyToken = verifyToken as jest.Mock;


describe('resolveAlert Server Action', () => {
  let mockDoc: jest.Mock;
  let mockCollection: jest.Mock;
  let mockUpdate: jest.Mock;
  let mockGet: jest.Mock;
  let mockWhere: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mocks for each test
    mockUpdate = jest.fn().mockResolvedValue(undefined);
    mockGet = jest.fn();
    mockWhere = jest.fn(() => ({ where: mockWhere, get: mockGet }));
    mockDoc = jest.fn(() => ({ get: mockGet, update: mockUpdate }));
    mockCollection = jest.fn(() => ({ doc: mockDoc, where: mockWhere }));

    mockGetAdminDb.mockReturnValue({ collection: mockCollection });
    mockVerifyToken.mockResolvedValue({ status: 'success', uid: 'test-user-123' });
  });

  const input: ResolveAlertInput = {
    alertId: 'test-alert-id',
    idToken: 'test-token-123',
  };

  it('should successfully resolve a "revenue-leak" alert if the block is now present', async () => {
    // 1. Setup: Define the alert and the event that should resolve it.
    const alertData = {
      userId: 'test-user-123',
      type: 'revenue-leak',
      details: {
        checkinDate: '2024-08-01T00:00:00.000Z',
        checkoutDate: '2024-08-05T00:00:00.000Z',
      },
    };
    const resolvingEvent = {
        id: 'found-event',
        userId: 'test-user-123',
        start: Timestamp.fromDate(new Date('2024-08-01T00:00:00.000Z')),
        end: Timestamp.fromDate(new Date('2024-08-05T00:00:00.000Z')),
    };
    
    // Mock the responses from Firestore
    // The first time get() is called, it's for the alert.
    mockGet.mockResolvedValueOnce({ exists: true, data: () => alertData });
    // The second time get() is called, it's for the event query.
    mockGet.mockResolvedValueOnce({ empty: false, docs: [{ id: 'found-event', data: () => resolvingEvent }] });


    // 2. Execute the action
    const result = await resolveAlert(input);

    // 3. Assertions
    expect(mockVerifyToken).toHaveBeenCalledWith({ idToken: input.idToken });
    expect(mockCollection).toHaveBeenCalledWith('alerts');
    expect(mockDoc).toHaveBeenCalledWith(input.alertId);
    expect(mockCollection).toHaveBeenCalledWith('events'); // From re-verification
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith({
      status: 'resolved',
      resolvedAt: expect.anything(), // We expect a server timestamp
    });
    expect(result.status).toBe('resolved');
    expect(result.message).toContain('successfully resolved');
  });

  it('should return "persistent" if a "revenue-leak" alert issue still exists', async () => {
    // 1. Setup: Alert exists, but no corresponding event
     const alertData = {
        userId: 'test-user-123',
        type: 'revenue-leak',
        details: {
            checkinDate: '2024-08-01T00:00:00.000Z',
            checkoutDate: '2024-08-05T00:00:00.000Z',
        },
    };
    
    // First get() call returns the alert
    mockGet.mockResolvedValueOnce({ exists: true, data: () => alertData });
    // Second get() call for the events query returns nothing
    mockGet.mockResolvedValueOnce({ empty: true, docs: [] });

    // 2. Execute the action
    const result = await resolveAlert(input);

    // 3. Assertions
    expect(mockUpdate).not.toHaveBeenCalled(); // The alert status should not change
    expect(result.status).toBe('persistent');
    expect(result.message).toContain('The underlying issue still exists');
  });

  it('should resolve a generic alert without re-verification', async () => {
    // 1. Setup: Mock a generic alert type
    const alertData = {
         userId: 'test-user-123',
         type: 'health-check', // This type doesn't have a custom verification handler
    };
    mockGet.mockResolvedValue({ exists: true, data: () => alertData });
    
    // 2. Execute
    const result = await resolveAlert(input);

    // 3. Assertions
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'resolved', resolvedAt: expect.anything() });
    expect(result.status).toBe('resolved');
    // Ensure the events collection was NOT queried for this type
    expect(mockCollection).toHaveBeenCalledTimes(1);
    expect(mockCollection).toHaveBeenCalledWith('alerts');
  });

  it('should return an error if the user is not authorized', async () => {
    // 1. Setup: Token belongs to a different user than the alert
    mockVerifyToken.mockResolvedValue({ status: 'success', uid: 'attacker-user-id' });
    const alertData = { userId: 'test-user-123', type: 'some-type' };
    mockGet.mockResolvedValue({ exists: true, data: () => alertData });

    // 2. Execute
    const result = await resolveAlert(input);

    // 3. Assertions
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(result.status).toBe('error');
    expect(result.message).toContain('not authorized');
  });

  it('should return an error if the alert does not exist', async () => {
    // 1. Setup: Firestore has no document for this ID
    mockGet.mockResolvedValue({ exists: false, data: () => null });

    // 2. Execute
    const result = await resolveAlert(input);

    // 3. Assertions
    expect(result.status).toBe('error');
    expect(result.message).toBe('Alert not found.');
  });
  
   it('should return an error if token verification fails', async () => {
    // 1. Setup: The authentication action fails
    mockVerifyToken.mockResolvedValue({ status: 'error', message: 'Invalid token' });

    // 2. Execute
    const result = await resolveAlert(input);

    // 3. Assertions
    expect(mockDoc).not.toHaveBeenCalled();
    expect(result.status).toBe('error');
    expect(result.message).toBe('Invalid token');
  });
});
