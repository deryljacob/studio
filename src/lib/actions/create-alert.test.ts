
import { createAlert, CreateAlertInput } from './create-alert';

// --- Mocking Firebase Admin ---
const mockAdd = jest.fn();
const mockCollection = jest.fn(() => ({
  add: mockAdd,
}));

jest.mock('@/lib/firebase-admin', () => ({
  getAdminDb: () => ({
    collection: mockCollection,
  }),
}));
// --------------------------------

describe('createAlert Server Action', () => {

  beforeEach(() => {
    mockAdd.mockClear();
    mockCollection.mockClear();
  });

  it('should successfully create a valid alert', async () => {
    const alertId = 'test-alert-id-123';
    mockAdd.mockResolvedValueOnce({ id: alertId });

    const input: CreateAlertInput = {
      userId: 'user-1',
      type: 'double-booking',
      severity: 'critical',
      source: 'System',
      event: 'Double booking detected between Airbnb and Vrbo',
      details: {
        newBookingCode: 'HMJ3P2Y1Z0',
        conflictingBookingCode: 'HA-ABC123',
      },
    };

    const result = await createAlert(input);

    expect(result.status).toBe('success');
    expect(result.message).toBe('Alert created successfully.');
    expect(result.alertId).toBe(alertId);

    // Verify that the correct collection was used
    expect(mockCollection).toHaveBeenCalledWith('alerts');

    // Verify the data sent to Firestore
    const firestoreData = mockAdd.mock.calls[0][0];
    expect(firestoreData.userId).toBe(input.userId);
    expect(firestoreData.type).toBe(input.type);
    expect(firestoreData.severity).toBe(input.severity);
    expect(firestoreData.status).toBe('pending');
    expect(firestoreData.event).toBe(input.event);
    expect(firestoreData.details).toEqual(input.details);
    expect(firestoreData.createdAt).toBeDefined();
  });

  it('should return an error if required fields are missing', async () => {
    const input: Partial<CreateAlertInput> = {
      userId: 'user-1',
      // Missing type and event
    };

    const result = await createAlert(input as CreateAlertInput);

    expect(result.status).toBe('error');
    expect(result.message).toBe('Missing required fields for alert creation.');
    expect(mockAdd).not.toHaveBeenCalled();
  });
  
  it('should handle Firestore write errors gracefully', async () => {
    const errorMessage = 'Permission denied';
    mockAdd.mockRejectedValueOnce(new Error(errorMessage));

    const input: CreateAlertInput = {
      userId: 'user-2',
      type: 'sync-error',
      severity: 'warning',
      source: 'Airbnb',
      event: 'Failed to sync iCal feed.',
    };

    const result = await createAlert(input);
    
    expect(result.status).toBe('error');
    expect(result.message).toContain(`Failed to create alert: ${errorMessage}`);
    expect(result.alertId).toBeUndefined();
  });

});
