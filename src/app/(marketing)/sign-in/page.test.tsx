
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SignInPage from './page';
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

// Mock Firebase Auth and other dependencies
jest.mock('firebase/auth', () => ({
  ...jest.requireActual('firebase/auth'),
  signInWithEmailAndPassword: jest.fn(),
  signInWithPopup: jest.fn(),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: jest.fn(() => ({
    toast: jest.fn(),
  })),
}));

const mockRouterPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
  }),
}));

describe('SignInPage', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    (signInWithEmailAndPassword as jest.Mock).mockClear();
    (signInWithPopup as jest.Mock).mockClear();
    (useToast().toast as jest.Mock).mockClear();
    mockRouterPush.mockClear();
  });

  it('renders the sign-in form correctly', () => {
    render(<SignInPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
  });

  it('validates form fields and shows error messages', async () => {
    render(<SignInPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('Please enter a valid email.')).toBeInTheDocument();
    expect(await screen.findByText('Password is required.')).toBeInTheDocument();
  });

  it('successfully signs in with email and password', async () => {
    (signInWithEmailAndPassword as jest.Mock).mockResolvedValue({ user: {} });
    const { toast } = useToast();
    render(<SignInPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), 'test@example.com', 'password123');
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Signed In' }));
      expect(mockRouterPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('handles incorrect email/password sign-in', async () => {
    (signInWithEmailAndPassword as jest.Mock).mockRejectedValue({ code: 'auth/invalid-credential' });
    const { toast } = useToast();
    render(<SignInPage />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'wrong@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrongpassword' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({
        variant: 'destructive',
        title: 'Sign In Failed',
        description: 'Invalid credentials. Please check your email and password and try again.',
      }));
    });
  });
  
  it('successfully signs in with Google', async () => {
    (signInWithPopup as jest.Mock).mockResolvedValue({ user: {} });
    const { toast } = useToast();
    render(<SignInPage />);

    fireEvent.click(screen.getByRole('button', { name: /sign in with google/i }));

    await waitFor(() => {
        expect(signInWithPopup).toHaveBeenCalled();
        expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Signed In" }));
        expect(mockRouterPush).toHaveBeenCalledWith("/dashboard");
    });
  });

});
