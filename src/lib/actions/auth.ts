
'use server';
/**
 * @fileOverview A server action for verifying a Firebase ID token.
 * This is a critical security function to authenticate server-side requests.
 */
import type { VerifyTokenInput, VerifyTokenOutput } from "@/lib/types";
import { getAdminAuth } from "@/lib/firebase-admin";

/**
 * Verifies a Firebase ID token. This is a server-only utility.
 * @param {string} idToken The Firebase ID token from the client.
 * @returns {Promise<VerifyTokenOutput>} An object with the status and UID if successful.
 */
export async function verifyToken(idToken?: string | null): Promise<VerifyTokenOutput> {
  if (!idToken) {
    return { status: 'error', message: 'Authentication error: ID token is missing.' };
  }

  try {
    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    
    if (!decodedToken.uid) {
        return { status: 'error', message: 'Authentication error: Invalid token.' };
    }

    return { status: 'success', message: 'Token verified.', uid: decodedToken.uid };

  } catch (error: any) {
    console.error('[VERIFY_TOKEN_ERROR]', error);
    // Provide a generic error message to the client to avoid leaking implementation details.
    return { status: 'error', message: 'Authentication error: Could not verify token.' };
  }
}
