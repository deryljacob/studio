// Mock implementation for useAuthState
export const useAuthState = jest.fn(() => {
  const mockUser = {
    uid: 'test-user-id',
    email: 'test@example.com',
    displayName: 'Test User',
  };
  return [mockUser, false, undefined]; // [user, loading, error]
});
