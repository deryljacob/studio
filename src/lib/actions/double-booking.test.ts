
import { receiveEmail, InboundEmailPayload } from './receive-email';
import { getAdminDb } from '@/lib/firebase-admin';
import { createAlert } from './create-alert';

// --- Mocking Firebase Admin and other actions ---
const mockAdd = jest.fn();
const mockGet = jest.fn();
const mockWhere = jest.fn(() => ({
    where: mockWhere,
    get: mockGet,
}));
const mockCollection = jest.fn((collectionName: string) => {
    if (collectionName === 'alerts') {
        return { add: mockAdd } // Used by createAlert
    }
    if (collectionName === 'events') {
        return { where: mockWhere }
    }
     if (collectionName === 'emails') {
        return { add: jest.fn().mockResolvedValue({ id: 'new-email-id' }) }
    }
    return {
        doc: () => ({ get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ platform: 'Vrbo' })}) })
    }
});

jest.mock('@/lib/firebase-admin', () => ({
  getAdminDb: () => ({
    collection: mockCollection,
  }),
}));

jest.mock('./create-alert', () => ({
  createAlert: jest.fn(),
}));
// --------------------------------

describe('Double-Booking Check within receiveEmail Action', () => {
  const testUserId = 'test-user-double-book';
  const testEmail: InboundEmailPayload = {
      to: `inbox-${testUserId}@in.calendarsentinel.com`,
      from: 'reservations@airbnb.com',
      subject: 'Reservation Confirmed for Your Stay',
      html: `
        <script type="application/ld+json">
        {
            "@context": "http://schema.org",
            "@type": "LodgingReservation",
            "reservationId": "AIRBNB123",
            "provider": { "name": "Airbnb" },
            "checkinTime": "2024-09-15T16:00:00-04:00",
            "checkoutTime": "2024-09-20T11:00:00-04:00"
        }
        </script>
      `,
      text: 'Your reservation is confirmed.',
  };


  beforeEach(() => {
    mockAdd.mockClear();
    mockGet.mockClear();
    mockWhere.mockClear();
    (createAlert as jest.Mock).mockClear();
  });

  it('should NOT trigger an alert if no conflicting events are found', async () => {
    // Simulate Firestore returning no overlapping events
    mockGet.mockResolvedValueOnce({ empty: true, docs: [] });

    await receiveEmail(testEmail);

    // Ensure it checked the events collection
    expect(mockCollection).toHaveBeenCalledWith('events');
    expect(mockWhere).toHaveBeenCalledWith('userId', '==', testUserId);

    // Ensure createAlert was NOT called
    expect(createAlert).not.toHaveBeenCalled();
  });
  
  it('should trigger a double-booking alert if a conflicting event is found', async () => {
    const conflictingEvent = {
        id: 'event-vrbo-1',
        eventId: 'vrbo-cal-event-id',
        calendarId: 'vrbo-calendar-id',
        userId: testUserId,
        summary: 'Existing Vrbo Booking',
        start: { toDate: () => new Date('2024-09-18T00:00:00.000Z') }, // Overlaps
        end: { toDate: () => new Date('2024-09-22T00:00:00.000Z') },
    };

    // Simulate Firestore finding one overlapping event
    mockGet.mockResolvedValueOnce({
      empty: false,
      docs: [{ data: () => conflictingEvent }]
    });

    await receiveEmail(testEmail);

    // Ensure createAlert WAS called
    expect(createAlert).toHaveBeenCalledTimes(1);

    const alertCallArgs = (createAlert as jest.Mock).mock.calls[0][0];

    expect(alertCallArgs.type).toBe('double-booking');
    expect(alertCallArgs.severity).toBe('critical');
    expect(alertCallArgs.userId).toBe(testUserId);
    expect(alertCallArgs.details.newBookingCode).toBe('AIRBNB123');
    expect(alertCallArgs.details.conflictingEventId).toBe(conflictingEvent.eventId);
    expect(alertCallArgs.details.conflictingCalendarName).toBe('Vrbo');
  });

  it('should NOT perform a check if the email is not a new booking', async () => {
    const cancellationEmail = {
        ...testEmail,
        subject: 'Reservation CANCELLATION notice'
    };

    await receiveEmail(cancellationEmail);

    // The events collection should not have been queried
    expect(mockWhere).not.toHaveBeenCalled();
    expect(createAlert).not.toHaveBeenCalled();
  });

   it('should NOT perform a check if booking details cannot be parsed', async () => {
    const junkEmail = {
        to: `inbox-${testUserId}@in.calendarsentinel.com`,
        from: 'marketing@example.com',
        subject: 'Special Offer!',
        html: '<p>Some random email content.</p>',
        text: 'Some random email content.',
    };

    await receiveEmail(junkEmail);

    expect(mockWhere).not.toHaveBeenCalled();
    expect(createAlert).not.toHaveBeenCalled();
  });

});
