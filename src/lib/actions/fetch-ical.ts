
'use server';

/**
 * @fileOverview A server action that acts as a proxy to fetch iCal data.
 * This is necessary to bypass browser CORS restrictions.
 * It is secured by verifying the user's Firebase ID token.
 */
import type { FetchIcalInput, FetchIcalOutput } from "@/lib/types";
import { verifyToken } from "@/lib/actions/auth";

export async function fetchIcal({ url, idToken }: FetchIcalInput): Promise<FetchIcalOutput> {
  try {
    // 1. Authenticate the user before proceeding
    const authResult = await verifyToken(idToken);
    if (authResult.status === 'error') {
      return { status: 'error', message: authResult.message };
    }

    // 2. Proceed with fetching the iCal data
    const fetchUrl = url.replace(/webcal(s?):\/\//, 'https://');
    const response = await fetch(fetchUrl, {
      headers: { 
          'User-Agent': 'Mozilla/5.0 (compatible; CalendarSentinel/1.0; +https://yourwebsite.com/bot)' 
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      const errorMessage = `Provider returned HTTP status ${response.status}. The link may be broken or temporarily unavailable.`;
      return { status: 'error', message: errorMessage };
    }
    
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/calendar")) {
         const errorMessage = `Invalid content type: Expected 'text/calendar' but got '${contentType}'. The URL may be a broken link.`;
         return { status: 'error', message: errorMessage };
    }

    const icalData = await response.text();
    if (!icalData || !icalData.trim().startsWith('BEGIN:VCALENDAR')) {
        const errorMessage = "The response was not a valid calendar file. It may be an error page or an empty response.";
        return { status: 'error', message: errorMessage };
    }

    return { status: 'success', message: 'Successfully fetched iCal data.', data: icalData };

  } catch (error: any) {
    console.error('[FETCH_ICAL_ERROR]', error);
    const errorMessage = `A network error occurred: ${error.message}. Please check your connection and the iCal URL.`;
    return { status: 'error', message: errorMessage };
  }
}
