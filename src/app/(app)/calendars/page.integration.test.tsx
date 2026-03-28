
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CalendarsPage from './page';
import { addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

// Mock Firebase and other external dependencies
jest.mock('firebase/firestore', () => ({
  ...jest.requireActual('firebase/firestore'),
  addDoc: jest.fn(),
  serverTimestamp: jest.fn(() => new Date()),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  doc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  writeBatch: jest.fn().mockReturnValue({
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  }),
  getDocs: jest.fn().mockResolvedValue({ docs: [] }),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: jest.fn(() => ({
    toast: jest.fn(),
  })),
}));

jest.mock('@/lib/actions/fetch-ical', () => ({
    fetchIcal: jest.fn(),
}));


describe('CalendarsPage - Integration with Firestore', () => {

  beforeEach(() => {
    // Reset mocks before each test
    (addDoc as jest.Mock).mockClear();
    (useToast().toast as jest.Mock).mockClear();
    require('react-firebase-hooks/firestore').useCollection.mockReturnValue([
        { docs: [] }, 
        false, 
        undefined
    ]);
  });


  it('should call Firestore addDoc when a valid iCal URL is submitted', async () => {
    render(<CalendarsPage />);

    // 1. Open the dialog
    fireEvent.click(screen.getByText('Add Calendar'));
    
    // 2. Fill in the iCal URL
    const icalUrlInput = screen.getByLabelText('iCal URL');
    const testUrl = 'https://www.airbnb.com/calendar/ical/12345.ics';
    fireEvent.change(icalUrlInput, { target: { value: testUrl } });

    // 3. Click the connect button
    const connectButton = screen.getByText('Connect via iCal');
    fireEvent.click(connectButton);

    // 4. Assert that addDoc was called with the correct data
    await waitFor(() => {
      expect(addDoc).toHaveBeenCalledTimes(1);
    });

    const addDocCall = (addDoc as jest.Mock).mock.calls[0];
    const newSourceData = addDocCall[1];

    expect(newSourceData.userId).toBe('test-user-id');
    expect(newSourceData.feedUrl).toBe(testUrl);
    expect(newSourceData.platform).toBe('Airbnb');
    expect(newSourceData.status).toBe('never');
  });

  it('should show an error toast for a duplicate URL and not call Firestore', async () => {
     // Mock useCollection to return a source that already exists
    const useCollectionMock = require('react-firebase-hooks/firestore').useCollection;
    useCollectionMock.mockReturnValueOnce([
        { 
            docs: [{ 
                id: '1', 
                data: () => ({ feedUrl: 'https://www.airbnb.com/calendar/ical/12345.ics', platform: 'Airbnb', color: 'red' }) 
            }]
        }, 
        false, 
        undefined
    ]);

    const { toast } = useToast();
    render(<CalendarsPage />);
    
    fireEvent.click(screen.getByText('Add Calendar'));
    
    const icalUrlInput = screen.getByLabelText('iCal URL');
    const testUrl = 'https://www.airbnb.com/calendar/ical/12345.ics';
    fireEvent.change(icalUrlInput, { target: { value: testUrl } });

    const connectButton = screen.getByText('Connect via iCal');
    fireEvent.click(connectButton);

    await waitFor(() => {
        expect(toast).toHaveBeenCalledWith(expect.objectContaining({
            variant: "destructive",
            title: "Duplicate URL",
        }));
    });

    expect(addDoc).not.toHaveBeenCalled();
  });
});
