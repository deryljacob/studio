# **App Name**: Calendar Sentinel

## Core Features:

- Calendar Sync: Allow users to connect their Airbnb, Vrbo, Booking.com, and Google Calendar accounts by pasting the iCal URL, or connect their Google Calendar via OAuth.
- Anomaly Detection: Automatically detect suspicious calendar blocks from external sources, triggered after calendar fetch.
- Calendar Health Check: Implement a daily 'Calendar Health Check' which automatically scans for recurring blocks, stale calendar links, conflicting syncs, and expired tokens.
- Alerts: Send immediate alerts via email. Also provide weekly summary reports of calendar anomalies.
- Dashboard: Build a dashboard where the alerts are displayed in a chronological alert log with the timestamp, event source, and the ability to resolve.
- Billing: Free 7-day trial. Implement flat monthly fee with dodopayments.com integration for subscriptions.

## Style Guidelines:

- Primary color: Midnight Blue (#191970), conveying trust and reliability.
- Background color: Light Gray (#F0F0F0), offering a neutral and clean backdrop.
- Accent color: Deep Sky Blue (#00BFFF), to highlight interactive elements and important alerts.
- Body and headline font: 'Inter', a sans-serif font offering a modern, neutral, and readable appearance suitable for both headlines and body text.
- Simple and clear icons, related to calendars and alerts.
- Clean, well-spaced layout with intuitive navigation.
- Subtle animations when data is updated.