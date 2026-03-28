
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SignUpPage from './page';
import { createUserWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

// Mock Firebase Auth and other dependencies
jest.mock('firebase/auth', () => ({
  ...jest.requireActual('firebase/auth'),
  createUserWithEmailAndPassword: jest.fn(),
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
  usePathname: () => '/',
  useSearchParams: () => ({
    get: jest.fn(),
  }),
}));

describe('SignUpPage', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    (createUserWithEmailAndPassword as jest.Mock).mockClear();
    (signInWithPopup as jest.Mock).mockClear();
    (useToast().toast as jest.Mock).mockClear();
    mockRouterPush.mockClear();
  });

  it('renders the initial sign-up options', () => {
    render(<SignUpPage />);
    expect(screen.getByRole('button', { name: /sign up with google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign up with email/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });

  it('shows the email form when "Sign up with email" is clicked', () => {
    render(<SignUpPage />);
    fireEvent.click(screen.getByRole('button', { name: /sign up with email/i }));
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });
  
  it('validates email form and shows error messages', async () => {
    render(<SignUpPage />);
    fireEvent.click(screen.getByRole('button', { name: /sign up with email/i }));
    
    const submitButton = screen.getByRole('button', { name: /sign up with email/i });
    fireEvent.click(submitButton);

    expect(await screen.findByText('Please enter a valid email.')).toBeInTheDocument();
    expect(await screen.findByText('Password must be at least 8 characters.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password456' } });
    fireEvent.click(submitButton);

    expect(await screen.findByText("Passwords don't match.")).toBeInTheDocument();
  });

  it('successfully signs up with email and password', async () => {
    (createUserWithEmailAndPassword as jest.Mock).mockResolvedValue({ user: {} });
    const { toast } = useToast();
    render(<SignUpPage />);
    fireEvent.click(screen.getByRole('button', { name: /sign up with email/i }));

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'newuser@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign up with email/i }));

    await waitFor(() => {
      expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), 'newuser@example.com', 'password123');
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Account Created' }));
      expect(mockRouterPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('handles sign up with an email that is already in use', async () => {
    (createUserWithEmailAndPassword as jest.Mock).mockRejectedValue({ code: 'auth/email-already-in-use' });
    const { toast } = useToast();
    render(<SignUpPage />);
    fireEvent.click(screen.getByRole('button', { name: /sign up with email/i }));

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'used@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /sign up with email/i }));

     await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({
        variant: 'destructive',
        title: 'Sign Up Failed',
        description: 'An account with this email already exists. Please sign in instead.',
      }));
    });
  });

  it('successfully signs up with Google', async () => {
    (signInWithPopup as jest.Mock).mockResolvedValue({ user: {} });
    const { toast } = useToast();
    render(<SignUpPage />);

    fireEvent.click(screen.getByRole('button', { name: /sign up with google/i }));

    await waitFor(() => {
        expect(signInWithPopup).toHaveBeenCalled();
        expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Account Created" }));
        expect(mockRouterPush).toHaveBeenCalledWith("/dashboard");
    });
  });

});
