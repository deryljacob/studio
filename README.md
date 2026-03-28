# Calendar Sentinel

Automated calendar monitoring and anomaly detection for short-term rental hosts.

## Quick Start

1.  **Sync your Calendars**: Go to the [Calendars](/calendars) page and paste your iCal URLs from Airbnb or Vrbo.
2.  **Setup Forwarding**: Copy your unique address from the [Inbox](/inbox) and set up an auto-forwarding rule in your email client for booking confirmations.
3.  **Monitor**: View the [Dashboard](/dashboard) for any detected anomalies like double bookings or revenue leaks.

## Development

This project is built with:
*   **Next.js 15**
*   **Firebase** (Auth, Firestore, Functions)
*   **ShadCN UI**
*   **Dodo Payments**

For detailed technical information, see [ABOUT.md](./ABOUT.md).

## Deployment

This app is designed to be hosted on **Firebase App Hosting**. 
Ensure the following environment variables are set:
*   `NEXT_PUBLIC_FIREBASE_CONFIG`
*   `DODO_PAYMENTS_API_KEY`
*   `DODO_WEBHOOK_SECRET`
*   `ZEPTOMAIL_SEND_MAIL_TOKEN`
*   `PRIVATE_FIREBASE_SERVICE_ACCOUNT_BASE64` (for Admin SDK access)
