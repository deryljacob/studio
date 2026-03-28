
/**
 * @jest-environment node
 */
import { POST } from './route';
import { NextRequest } from 'next/server';
import { Readable } from 'stream';
import crypto from 'crypto';

// --- Mock external dependencies ---
jest.mock('@/lib/firebase-admin', () => ({
  getAdminDb: jest.fn(() => ({
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({
        empty: false,
        docs: [{ ref: { update: jest.fn().mockResolvedValue(true) } }] // Mock ref for update
    }),
    set: jest.fn().mockResolvedValue(true),
    update: jest.fn().mockResolvedValue(true),
  })),
}));


describe('Dodo Webhook Handler', () => {

    const webhookSecret = 'whsec_test_secret';
    process.env.DODO_WEBHOOK_SECRET = webhookSecret;
    process.env.DODO_API_KEY = 'sk_test_123';

    let mockDb: any;
    
    beforeEach(() => {
        jest.clearAllMocks();
        const { getAdminDb } = require('@/lib/firebase-admin');
        mockDb = getAdminDb();
    });

    function createMockRequest(body: string, signatureHeader: string): NextRequest {
        const headers = new Headers({
            'Dodo-Signature': signatureHeader,
            'Content-Type': 'application/json',
        });
        
        const readableStream = new Readable();
        readableStream.push(body);
        readableStream.push(null);

        const req: any = new NextRequest('http://localhost/api/webhooks/dodo', {
            method: 'POST',
            headers,
            body: readableStream,
        });
        
        req.text = async () => body;
        return req;
    }
    
    function generateSignature(timestamp: number, payload: string, secret: string): string {
        const signedPayload = `${timestamp}.${payload}`;
        const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
        return `t=${timestamp},v1=${signature}`;
    }


    it('should return 400 if signature verification fails', async () => {
        const payload = JSON.stringify({ id: 'evt_123', type: 'checkout.session.completed' });
        const invalidSignature = 't=123,v1=invalid_signature';

        const req = createMockRequest(payload, invalidSignature);
        const response = await POST(req);

        expect(response.status).toBe(400);
        const responseText = await response.text();
        expect(responseText).toContain('Signature verification failed');
    });

    it('should successfully handle a checkout.session.completed event to link user', async () => {
        const timestamp = Math.floor(Date.now() / 1000);
        const sessionPayload = {
            id: 'cs_123',
            client_reference_id: 'user_firebase_uid',
            customer: 'cust_123',
        };
        const eventPayload = {
            id: 'evt_123',
            type: 'checkout.session.completed',
            data: { object: sessionPayload },
        };
        const body = JSON.stringify(eventPayload);
        const signature = generateSignature(timestamp, body, webhookSecret);
        
        const req = createMockRequest(body, signature);
        const response = await POST(req);
        
        expect(response.status).toBe(200);

        const docRef = mockDb.collection('users').doc('user_firebase_uid');
        
        expect(docRef.set).toHaveBeenCalledWith({
            dodoCustomerId: 'cust_123',
        }, { merge: true });
    });
    
    it('should successfully handle a subscription.active event', async () => {
        const timestamp = Math.floor(Date.now() / 1000);
        const subscriptionPayload = {
            id: 'sub_123',
            customer: 'cust_123',
            status: 'active',
            current_period_end: timestamp + (30 * 24 * 60 * 60),
            items: { data: [{ price: { id: 'price_prof_plan' } }] }
        };
        const eventPayload = {
            id: 'evt_456',
            type: 'subscription.active',
            data: { object: subscriptionPayload },
        };

        const body = JSON.stringify(eventPayload);
        const signature = generateSignature(timestamp, body, webhookSecret);

        const req = createMockRequest(body, signature);
        const response = await POST(req);
        
        expect(response.status).toBe(200);

        const userRef = mockDb.collection('users').where().limit().get().docs[0].ref;

        expect(mockDb.collection('users').where).toHaveBeenCalledWith('dodoCustomerId', '==', 'cust_123');
        expect(userRef.update).toHaveBeenCalledWith({
            planId: 'price_prof_plan',
            planStatus: 'active',
            planEndsAt: expect.any(Date),
        });
    });

    it('should return 500 if the handler encounters an unexpected error', async () => {
        const timestamp = Math.floor(Date.now() / 1000);
        // Event payload that will cause an error (e.g., trying to find a user that doesn't exist)
        const eventPayload = { 
            type: 'subscription.active', 
            data: { object: { customer: 'cust_nonexistent' } } 
        };
        
        // Mock Firestore to return an empty result for the customer lookup
        mockDb.collection('users').where().limit().get.mockResolvedValueOnce({ empty: true });

        const body = JSON.stringify(eventPayload);
        const signature = generateSignature(timestamp, body, webhookSecret);
        
        const req = createMockRequest(body, signature);
        const response = await POST(req);

        expect(response.status).toBe(500);
        const responseText = await response.text();
        expect(responseText).toContain('No user found with Dodo Customer ID');
    });
});
