


export type User = {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  // Billing
  dodoCustomerId?: string;
  planId?: string;
  planStatus?: 'trialing' | 'active' | 'canceled' | 'expired' | null;
  planEndsAt?: any; // Firestore Timestamp
  // Settings
  emailAlerts?: boolean;
  smsAlerts?: boolean;
  phone?: string;
};


export type Alert = {
  id: string;
  userId: string;
  type: 'double-booking' | 'stuck-blockage' | 'revenue-leak' | 'sync-error' | 'health-check' | 'suspicious-block' | 'long-stay-block' | 'recurring-event' | string;
  severity: 'critical' | 'warning' | 'info';
  status: 'pending' | 'resolved' | 'ignored';
  source: 'Airbnb' | 'Vrbo' | 'Booking.com' | 'Google Calendar' | 'System' | string;
  event: string;
  details?: {
    [key: string]: any;
    conflictingCalendarName?: string;
    conflictingEventId?: string;
    conflictingBookingCode?: string;
    newBookingCode?: string;
    cancelledBookingCode?: string;
    stuckEventId?: string;
    message?: string;
  };
  createdAt: any; // Firestore ServerTimestamp
  resolvedAt?: any;
};

export type Calendar = {
  id: string;
  userId: string;
  type: 'ical' | 'google';
  feedUrl: string;
  platform: 'Airbnb' | 'Vrbo' | 'Booking.com' | 'Google Calendar' | 'iCal' | string;
  status: 'active' | 'error' | 'expired' | 'never';
  lastSync: string; // ISO 8601 date string or 'never'
  color: string;
  createdAt: any; // Using 'any' for Firebase ServerTimestamp
  lastError?: string;
};

export type Event = {
  id: string; // Firestore document ID
  eventId: string; // UID from iCal
  calendarId: string;
  userId: string;
  start: Date; // Converted to JS Date object
  end: Date;   // Converted to JS Date object
  summary: string;
  rawData: string;
}

export type BookingDetails = {
  platform?: string;
  confirmationCode?: string;
  checkinDate?: string;
  checkoutDate?: string;
  guestName?: string;
  totalPrice?: string;
  source: 'json-ld' | 'regex' | 'generic' | 'none';
}

export type Email = {
  id: string;
  userId: string;
  from: string;
  subject: string;
  body: string; // Should be sanitized HTML
  receivedAt: Date; // Converted to JS Date object
  isRead: boolean;
  label?: 'booking' | 'receipt' | 'alert' | 'other';
  bookingDetails?: BookingDetails;
}


// Dodo.js specific types for window object
export interface DodoCheckout {
    present: (options: { clientSecret: string }) => Promise<void>;
}

export interface Dodo {
    checkout: DodoCheckout;
}


// --- Action & Task Payloads ---

export interface InboundEmailPayload {
    to: string;
    from: string;
    subject: string;
    html: string;
    text: string;
}

export interface ReceiveEmailOutput {
  status: 'success' | 'error';
  message: string;
}

export interface FetchIcalInput {
  url: string;
  idToken: string;
}

export interface FetchIcalOutput {
  status: 'success' | 'error';
  message: string;
  data?: string;
}

export interface CreateAlertInput {
    userId: string;
    type: Alert['type'];
    severity: Alert['severity'];
    source: Alert['source'];
    event: string;
    details?: Alert['details'];
}

export interface CreateAlertOutput {
  status: 'success' | 'error';
  message: string;
  alertId?: string;
}


export interface ResolveAlertInput {
  alertId: string;
  idToken: string;
}

export interface ResolveAlertOutput {
  status: 'resolved' | 'persistent' | 'error';
  message: string;
}

export interface VerifyTokenInput {
  idToken?: string | null;
}

export interface VerifyTokenOutput {
  status: 'success' | 'error';
  message: string;
  uid?: string;
}

export interface StuckBlockageTaskPayload {
    userId: string;
    cancelledBookingCode: string;
    checkinDate: string; // ISO String
    checkoutDate?: string; // ISO String
}

export interface RevenueLeakTaskPayload {
    userId: string;
    bookingDetails: BookingDetails;
}


// --- Billing ---
export interface CreateCheckoutSessionInput {
    idToken: string;
}

export interface CreateCheckoutSessionOutput {
    status: 'success' | 'error';
    message: string;
    clientSecret?: string;
    url?: string;
}

export interface CreatePortalSessionInput {
    idToken: string;
}

export interface CreatePortalSessionOutput {
    status: 'success' | 'error';
    message: string;
    url?: string;
}
