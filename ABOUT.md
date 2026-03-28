# About Calendar Sentinel

Calendar Sentinel is an automated monitoring and anomaly detection system designed specifically for short-term rental hosts and property managers. It acts as a fail-safe layer between various booking platforms (like Airbnb, Vrbo, and Booking.com) and your synchronized calendars.

## The Problem
Short-term rental platforms use iCal feeds to sync availability. However, these feeds are not real-time and can suffer from "sync lag." A booking on Airbnb might take 15-30 minutes to appear on a Vrbo calendar, creating a window for a **double booking**. Conversely, a cancellation might not clear a block immediately, leading to a **revenue leak** (missed availability).

## Core Features

### 1. Intelligent Calendar Sync
*   Connects to multiple iCal feeds (Airbnb, Vrbo, Booking.com, Google Calendar).
*   Visualizes all bookings in a unified, color-coded dashboard.
*   Performs regular background syncs to ensure data freshness.

### 2. Automated Anomaly Detection
The system proactively looks for issues that cost hosts money or cause stress:
*   **Double Bookings**: Detects overlapping reservations across different platforms.
*   **Revenue Leaks**: Identifies if a new booking confirmation email was received but no corresponding block appeared on the calendar after 15 minutes.
*   **Stuck Blockages**: Detects if a cancellation email was received but the calendar block remains present after one hour.
*   **Suspicious Blocks**: Flags manual blocks with summaries like "Blocked" or "Unavailable" that might be forgotten.
*   **Policy Violations**: Flags unusually long stays (>30 days) or recurring personal events that shouldn't block guest dates.

### 3. Integrated Booking Inbox
*   Users get a unique forwarding address (`inbox-[UID]@in.calendarsentinel.com`).
*   **Automated Parsing**: Uses JSON-LD, platform-specific Regex, and generic keyword matching to extract booking details (dates, guest name, price) from forwarded emails.
*   **Audit Trail**: Maintains a read-only log of all communications for verification.

### 4. Real-Time Alerts
*   Sends critical notifications via Email (using ZeptoMail/Zoho) and potentially SMS.
*   Interactive Dashboard allows users to "Resolve" alerts by re-verifying the underlying calendar state.

## Technical Architecture

### Frontend
*   **Framework**: Next.js 15 (App Router) with TypeScript.
*   **UI Components**: ShadCN UI (Radix-based) and Tailwind CSS.
*   **State Management**: React Hooks and Firebase Real-time Listeners (via `react-firebase-hooks`).

### Backend (Serverless)
*   **Database**: Google Cloud Firestore (NoSQL).
*   **Authentication**: Firebase Authentication (Email/Password & Google OAuth).
*   **Server Actions**: Secure, server-side logic for data mutations and external API calls.
*   **Background Jobs**: 
    *   **Cloud Functions (v2)**: Triggered by Firestore writes (e.g., sending alert emails when an alert is created).
    *   **Cloud Tasks**: Used for "delayed verification" (e.g., scheduling a check 15 minutes after a booking email arrives).

### Integrations
*   **Payment Processing**: Dodo Payments for subscription management (Free Trial -> Professional Plan).
*   **Webhook Handling**: A secure endpoint (`/api/webhooks/dodo`) with signature verification and automated customer data retrieval.
*   **Email Sending**: ZeptoMail for reliable delivery of critical alerts.

## Data Security
*   **Firestore Security Rules**: Strict owner-only access to data.
*   **Environment Secrets**: All API keys and signing secrets are managed via server-side environment variables.
*   **Webhook Verification**: Uses HMAC-SHA256 signature verification to prevent spoofing.

---
*Created for the Firebase Studio Prototype.*