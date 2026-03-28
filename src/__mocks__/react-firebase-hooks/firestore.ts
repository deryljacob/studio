// Mock implementation for useCollection
export const useCollection = jest.fn((query) => {
  if (!query) {
    return [[], true, undefined];
  }
  // You can add more sophisticated logic here to return different mock data based on the query
  return [[], false, undefined]; // [value, loading, error]
});
