
/**
 * @fileOverview API Route for handling Cloud Tasks for the Revenue Leak Check.
 *
 * This endpoint is designed to be called exclusively by Google Cloud Tasks,
 * typically triggered after a new booking email has been received and a delay
 * has passed. It verifies the authenticity of the incoming request and then
 * triggers the core logic to check if the new booking is correctly reflected
 * on the user's synchronized calendars.
 */

import { NextRequest, NextResponse } from 'next/server';
import { RevenueLeakTaskPayload } from '@/lib/types';
import { runRevenueLeakCheck } from '@/lib/services/run-revenue-leak-check';
import { getAdminAuth } from '@/lib/firebase-admin';

// This forces the handler to run on the Node.js runtime, not the edge.
// It's required because the Firebase Admin SDK is not compatible with the edge.
export const runtime = 'nodejs';

// In a real production environment, the service account email can be found
// on the Cloud Run service details page for your App Hosting backend.
const APP_HOSTING_SERVICE_ACCOUNT_EMAIL = `service-${process.env.GCP_PROJECT_NUMBER}@gcp-sa-apphosting.iam.gserviceaccount.com`;


/**
 * Verifies that the incoming request is a legitimate OIDC-authenticated
 * request from Cloud Tasks.
 * @param {NextRequest} request The incoming Next.js request.
 * @returns {Promise<boolean>} True if the token is valid, false otherwise.
 */
async function verifyCloudTasksToken(request: NextRequest): Promise<boolean> {
    try {
        const authorizationHeader = request.headers.get('authorization');
        if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
            console.warn('[AUTH] Missing or malformed Authorization header.');
            return false;
        }

        const token = authorizationHeader.split('Bearer ')[1];
        if (!token) {
            console.warn('[AUTH] No bearer token found in header.');
            return false;
        }
        
        // This verifies that the token was signed by Google and intended for our app.
        const auth = getAdminAuth();
        const ticket = await auth.verifyIdToken(token);
        const payload = ticket;
        
        // Additionally, verify the token was issued by the correct service account.
        if (payload.email !== APP_HOSTING_SERVICE_ACCOUNT_EMAIL) {
            console.error(`[AUTH] Invalid issuer email: ${payload.email}`);
            return false;
        }

        return true;
    } catch (error) {
        console.error('[AUTH] Token verification failed:', error);
        return false;
    }
}


export async function POST(request: NextRequest) {
    // 1. Verify the request is from Cloud Tasks
    const isVerified = await verifyCloudTasksToken(request);
    if (!isVerified) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // 2. Parse the payload from the task body
        const payload = (await request.json()) as RevenueLeakTaskPayload;

        if (!payload.userId || !payload.bookingDetails) {
             return NextResponse.json({ error: 'Invalid task payload' }, { status: 400 });
        }

        // 3. Execute the core logic
        await runRevenueLeakCheck(payload);
        
        // 4. Acknowledge the task was successfully processed
        return NextResponse.json({ status: 'success' }, { status: 200 });

    } catch (error) {
        console.error('[REVENUE_LEAK_HANDLER_ERROR]', error);
        // Let Cloud Tasks know the job failed so it can be retried.
        // Return a 500 status to trigger a retry.
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// Implement a simple GET handler for basic health checks if needed.
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
