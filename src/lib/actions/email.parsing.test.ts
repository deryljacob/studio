
// This is a simplified testing environment.
// We'll simulate the logic from the receive-email action.

type BookingDetails = {
  platform?: string;
  confirmationCode?: string;
  checkinDate?: string;
  checkoutDate?: string;
  guestName?: string;
  totalPrice?: string;
  source: 'json-ld' | 'regex' | 'generic' | 'none';
};

// --- Extracted Parsing Logic for Testing ---

function parseWithJsonLd(html: string): BookingDetails | null {
  try {
    const jsonLdRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/i;
    const match = html.match(jsonLdRegex);
    if (!match || !match[1]) return null;

    const json = JSON.parse(match[1]);
    
    if (json['@type'] === 'LodgingReservation') {
      return {
        platform: json.provider?.name,
        confirmationCode: json.reservationId,
        checkinDate: json.checkinTime ? new Date(json.checkinTime).toISOString() : undefined,
        checkoutDate: json.checkoutTime ? new Date(json.checkoutTime).toISOString() : undefined,
        guestName: json.underName?.name,
        totalPrice: `${json.totalPrice} ${json.priceCurrency}`,
        source: 'json-ld'
      };
    }
    return null;
  } catch (error) {
    return null;
  }
}

function parseWithRegex(html: string, from: string): BookingDetails | null {
    const lowerFrom = from.toLowerCase();
    let details: Partial<BookingDetails> = { source: 'regex' };

    if (lowerFrom.includes('airbnb')) {
        details.platform = 'Airbnb';
        details.confirmationCode = html.match(/Reservation code:.*?<span.*?>\s*([A-Z0-9]+)\s*<\/span>/)?.[1];
        details.checkinDate = html.match(/Check-in.*?<div.*?>.*?(\w+\s\d+,\s\d{4})<\/div>/)?.[1];
        details.checkoutDate = html.match(/Checkout.*?<div.*?>.*?(\w+\s\d+,\s\d{4})<\/div>/)?.[1];
    } else if (lowerFrom.includes('vrbo') || lowerFrom.includes('homeaway')) {
        details.platform = 'Vrbo';
        details.confirmationCode = html.match(/Confirmation\sCode:\s*([A-Z0-9]+)/i)?.[1];
        details.checkinDate = html.match(/Check-in:.*?<td.*?>\s*(\w+\s\d+,\s\d{4})\s*<\/td>/i)?.[1];
        details.checkoutDate = html.match(/Check-out:.*?<td.*?>\s*(\w+\s\d+,\s\d{4})\s*<\/td>/i)?.[1];
    }
    
    if (details.confirmationCode && (details.checkinDate || details.checkoutDate)) {
        return details as BookingDetails;
    }

    return null;
}

function parseWithGeneric(text: string): BookingDetails | null {
    let details: Partial<BookingDetails> = { source: 'generic' };

    details.confirmationCode = text.match(/(?:Confirmation|Reservation)\s*(?:code|#|number|ID):\s*([A-Za-z0-9]+)/i)?.[1];
    details.checkinDate = text.match(/Check-in(?:\sdate)?:?\s*(\w+\s\d+,?\s\d{4})/i)?.[1];
    details.checkoutDate = text.match(/Check-out(?:\sdate)?:?\s*(\w+\s\d+,?\s\d{4})/i)?.[1];
    details.guestName = text.match(/Guest(?:\sName)?:?\s*(.*)/i)?.[1]?.trim();

    if (details.confirmationCode && (details.checkinDate || details.checkoutDate)) {
        return details as BookingDetails;
    }
    
    return null;
}

// --- Test Suite ---

describe('Email Parsing Engine', () => {

    describe('JSON-LD Parser', () => {
        it('should correctly parse a standard LodgingReservation schema', () => {
            const html = `
                <html><body>
                <script type="application/ld+json">
                {
                    "@context": "http://schema.org",
                    "@type": "LodgingReservation",
                    "reservationId": "CONF12345",
                    "provider": { "@type": "Organization", "name": "Airbnb" },
                    "checkinTime": "2024-09-15T16:00:00-04:00",
                    "checkoutTime": "2024-09-20T11:00:00-04:00",
                    "underName": { "@type": "Person", "name": "John Doe" },
                    "totalPrice": "500.00",
                    "priceCurrency": "USD"
                }
                </script>
                </body></html>
            `;
            const result = parseWithJsonLd(html);
            expect(result).not.toBeNull();
            expect(result?.source).toBe('json-ld');
            expect(result?.platform).toBe('Airbnb');
            expect(result?.confirmationCode).toBe('CONF12345');
            expect(result?.guestName).toBe('John Doe');
            expect(result?.totalPrice).toBe('500.00 USD');
            expect(new Date(result?.checkinDate!).getFullYear()).toBe(2024);
        });

        it('should return null if JSON-LD is not for LodgingReservation', () => {
             const html = `
                <html><body>
                <script type="application/ld+json">
                {
                    "@type": "Event"
                }
                </script>
                </body></html>
            `;
             const result = parseWithJsonLd(html);
             expect(result).toBeNull();
        });
    });

    describe('Platform-Specific Regex Parser', () => {
        it('should parse an Airbnb email format', () => {
            const from = 'reservations@airbnb.com';
            const html = `
                <div>Reservation code: <span style="font-weight:bold;">HMJ3P2Y1Z0</span></div>
                <div>
                    <div>Check-in</div>
                    <div>August 1, 2024</div>
                </div>
                <div>
                    <div>Checkout</div>
                    <div>August 5, 2024</div>
                </div>
            `;
            const result = parseWithRegex(html, from);
            expect(result).not.toBeNull();
            expect(result?.source).toBe('regex');
            expect(result?.platform).toBe('Airbnb');
            expect(result?.confirmationCode).toBe('HMJ3P2Y1Z0');
            expect(result?.checkinDate).toBe('August 1, 2024');
        });

        it('should parse a Vrbo email format', () => {
            const from = 'support@vrbo.com';
            const html = `
                <table>
                    <tr><td>Confirmation Code: HA-ABC123</td></tr>
                    <tr><td>Check-in: <td>July 20, 2024</td></td></tr>
                    <tr><td>Check-out: <td>July 25, 2024</td></td></tr>
                </table>
            `;
             const result = parseWithRegex(html, from);
             expect(result).not.toBeNull();
             expect(result?.source).toBe('regex');
             expect(result?.platform).toBe('Vrbo');
             expect(result?.confirmationCode).toBe('HA-ABC123');
             expect(result?.checkinDate).toBe('July 20, 2024');
        });
    });
    
    describe('Generic Fallback Parser', () => {
        it('should extract details from a generic text email', () => {
            const text = `
                Your booking is confirmed.
                Reservation #: GUEST-9876
                Check-in date: Dec 1, 2024
                Check-out date: Dec 10, 2024
                Guest Name: Jane Smith
            `;
            const result = parseWithGeneric(text);
            expect(result).not.toBeNull();
            expect(result?.source).toBe('generic');
            expect(result?.confirmationCode).toBe('GUEST-9876');
            expect(result?.checkinDate).toBe('Dec 1, 2024');
            expect(result?.guestName).toBe('Jane Smith');
        });
         it('should return null if essential details are missing', () => {
            const text = `Thank you for your interest.`;
            const result = parseWithGeneric(text);
            expect(result).toBeNull();
        });
    });
});
