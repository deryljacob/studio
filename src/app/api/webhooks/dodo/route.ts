
/**
 * @fileOverview Webhook handler for Dodo Payments.
 * This endpoint securely receives events from Dodo and updates user subscription data in Firestore.
 * It also logs events to a 'webhook_logs' collection for visual debugging.
 */

import type { NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';

async function logWebhookEvent(db: FirebaseFirestore.Firestore, type: string, status: string, payload: any, error?: string) {
    try {
        await db.collection('webhook_logs').add({
            type,
            status,
            payload,
            error: error || null,
            timestamp: FieldValue.serverTimestamp(),
        });
    } catch (e) {
        console.error('[DODO_LOG_ERROR]', e);
    }
}

async function verifyDodoSignature(req: NextRequest, body: string, secret: string): Promise<{ isValid: boolean; reason?: string }> {
    const signatureHeader = req.headers.get('Dodo-Signature');
    if (!signatureHeader) {
        return { isValid: false, reason: 'Missing Dodo-Signature header' };
    }

    const parts = signatureHeader.split(',');
    const timestampPart = parts.find(p => p.startsWith('t='));
    const signaturePart = parts.find(p => p.startsWith('v1='));

    if (!timestampPart || !signaturePart) {
        return { isValid: false, reason: 'Malformed Dodo-Signature header' };
    }

    const timestamp = timestampPart.split('=')[1];
    const signature = signaturePart.split('=')[1];

    const fiveMinutes = 5 * 60 * 1000;
    if (Date.now() - (parseInt(timestamp, 10) * 1000) > fiveMinutes) {
        return { isValid: false, reason: 'Webhook timestamp is too old' };
    }

    const signedPayload = `${timestamp}.${body}`;
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(signedPayload)
        .digest('hex');

    const isValid = crypto.timingSafeEqual(Buffer.from(expectedSignature, 'hex'), Buffer.from(signature, 'hex'));
    return { isValid, reason: isValid ? undefined : 'Calculated signatures do not match' };
}

async function fetchDodoCustomer(customerId: string): Promise<any> {
    const apiKey = process.env.DODO_PAYMENTS_API_KEY;
    if (!apiKey) throw new Error('Dodo API key not configured');

    const response = await fetch(`https://api.dodopayments.com/v1/customers/${customerId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) throw new Error(`Failed to fetch customer: ${response.status}`);
    return await response.json();
}

export async function POST(req: NextRequest) {
    const adminDb = getAdminDb();
    const webhookSecret = process.env.DODO_WEBHOOK_SECRET;

    if (!webhookSecret) {
        return new Response('Config Error', { status: 500 });
    }

    const body = await req.text();
    let event: any;
    
    try {
        event = JSON.parse(body);
    } catch (e) {
        return new Response('Invalid JSON', { status: 400 });
    }

    const { isValid, reason } = await verifyDodoSignature(req, body, webhookSecret);
    if (!isValid) {
        console.error(`[DODO_WEBHOOK_ERROR] Signature verification failed: ${reason}`);
        await logWebhookEvent(adminDb, event.type || 'unknown', 'failed', event, `Signature error: ${reason}`);
        return new Response(`Webhook Error: ${reason}`, { status: 400 });
    }

    try {
        switch (event.type) {
            case 'subscription.active':
            case 'subscription.renewed':
            case 'customer.subscription.updated': {
                const subscription = event.data.object;
                const customerId = subscription.customer;
                
                if (!customerId) {
                    await logWebhookEvent(adminDb, event.type, 'error', event, 'No customer ID in subscription payload');
                    return new Response('Missing Customer ID', { status: 200 });
                }

                const customer = await fetchDodoCustomer(customerId);
                const userId = customer?.metadata?.userId;

                if (!userId) {
                    await logWebhookEvent(adminDb, event.type, 'error', { subscription, customer }, 'User ID missing in customer metadata');
                    return new Response('User ID missing', { status: 200 });
                }

                const userRef = adminDb.collection('users').doc(userId);
                let planEndsAt = new Date();
                if (subscription.current_period_end) {
                    planEndsAt = new Date(typeof subscription.current_period_end === 'number' ? subscription.current_period_end * 1000 : subscription.current_period_end);
                }

                const updateData: any = {
                    dodoCustomerId: customerId,
                    planStatus: subscription.status,
                    planEndsAt: planEndsAt,
                };

                if (subscription.items?.data?.[0]?.price?.id) {
                    updateData.planId = subscription.items.data[0].price.id;
                }

                await userRef.set(updateData, { merge: true });
                await logWebhookEvent(adminDb, event.type, 'success', { updateData, userId });
                break;
            }

            default:
                await logWebhookEvent(adminDb, event.type, 'ignored', event);
        }

        return new Response(JSON.stringify({ received: true }), { status: 200 });
    } catch (error: any) {
        console.error(`[DODO_WEBHOOK_HANDLER_ERROR] ${error.message}`);
        await logWebhookEvent(adminDb, event.type || 'processing', 'error', event, error.message);
        return new Response(`Handler Error: ${error.message}`, { status: 500 });
    }
}
