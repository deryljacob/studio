
// This is a simplified testing environment.
// We'll simulate the logic from the CalendarsPage component.

// The function to be tested, extracted for clarity.
const getPlatformName = (url: string): string => {
  try {
    const hostname = new URL(url).hostname;
    if (hostname.includes('airbnb')) return 'Airbnb';
    if (hostname.includes('vrbo') || hostname.includes('homeaway')) return 'Vrbo';
    if (hostname.includes('booking.com')) return 'Booking.com';
    if (hostname.includes('google.com')) return 'Google Calendar';
    
    const domain = hostname.replace('www.', '').split('.')[0];
    return (domain.charAt(0).toUpperCase() + domain.slice(1));
  } catch (error) {
    return 'iCal'; // fallback
  }
}

describe('iCal URL Validation and Platform Detection', () => {
  
  // Test cases for URL validation
  test('should reject an empty URL', () => {
    const url = "  ";
    expect(url.trim()).toBeFalsy();
  });

  test('should reject an invalid URL format', () => {
    const url = "not-a-valid-url";
    expect(() => new URL(url)).toThrow();
  });

  test('should accept a valid http URL', () => {
    const url = "http://www.airbnb.com/calendar/ical/123.ics";
    expect(() => new URL(url)).not.toThrow();
  });

  test('should correctly parse a webcal URL', () => {
    let url = "webcal://www.airbnb.com/calendar/ical/123.ics";
    if (url.startsWith('webcal://')) {
        url = url.replace('webcal://', 'https://');
    }
    expect(() => new URL(url)).not.toThrow();
    expect(url).toBe('https://www.airbnb.com/calendar/ical/123.ics');
  });

  // Test cases for platform detection
  test('should detect Airbnb from URL', () => {
    const url = 'https://www.airbnb.com/calendar/ical/12345.ics';
    expect(getPlatformName(url)).toBe('Airbnb');
  });

  test('should detect Vrbo from URL', () => {
    const url = 'https://www.vrbo.com/icalendar/guid.ics';
    expect(getPlatformName(url)).toBe('Vrbo');
  });

  test('should detect Booking.com from URL', () => {
    const url = 'https://calendar.booking.com/ical/123.ics';
    expect(getPlatformName(url)).toBe('Booking.com');
  });
  
  test('should detect Google Calendar from URL', () => {
    const url = 'https://calendar.google.com/calendar/ical/..../basic.ics';
    expect(getPlatformName(url)).toBe('Google Calendar');
  });

  test('should fallback to a generic name for unknown iCal providers', () => {
    const url = 'https://www.unknown-provider.net/cal.ics';
    expect(getPlatformName(url)).toBe('Unknown-provider');
  });

  test('should fallback to iCal for invalid URLs', () => {
    const url = 'this is not a url';
    expect(getPlatformName(url)).toBe('iCal');
  });

});
