import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { api } from './services/api';

// Mock the API module
vi.mock('./services/api', () => ({
  api: {
    getCurrentUser: vi.fn(),
    logout: vi.fn(),
    getTodos: vi.fn().mockResolvedValue([]),
    createTodo: vi.fn(),
    updateTodo: vi.fn(),
    deleteTodo: vi.fn(),
    login: vi.fn(),
    onUnauthorized: vi.fn(() => vi.fn()), // Return a mock unsubscribe function
    onSessionExtended: vi.fn(() => vi.fn()),
    notifyUnauthorized: vi.fn(),
    notifySessionExtended: vi.fn(),
  },
}));

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.onUnauthorized).mockImplementation(() => vi.fn());
    vi.mocked(api.onSessionExtended).mockImplementation(() => vi.fn());
  });

  it('should check session on mount', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({ id: 1, username: 'testuser' });

    render(<App />);

    await waitFor(() => {
      expect(api.getCurrentUser).toHaveBeenCalledTimes(1);
    });
  });

  it('should show todo list if session valid', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({ id: 1, username: 'testuser' });

    render(<App />);

    await waitFor(() => expect(screen.queryByText(/Sign in/i)).not.toBeInTheDocument());
  });

  it('should show login screen if session check fails', async () => {
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('Unauthorized'));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Sign in/i)).toBeInTheDocument();
    });
  });

  it('should subscribe to onUnauthorized events', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({ id: 1, username: 'testuser' });
    render(<App />);
    await waitFor(() => expect(api.onUnauthorized).toHaveBeenCalled());
  });
});
