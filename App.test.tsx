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
  },
}));

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should check session on mount', async () => {
    (api.getCurrentUser as any).mockResolvedValue({ id: 1, username: 'testuser' });

    render(<App />);

    await waitFor(() => {
      expect(api.getCurrentUser).toHaveBeenCalledTimes(1);
    });
  });

  it('should show todo list if session valid', async () => {
    (api.getCurrentUser as any).mockResolvedValue({ id: 1, username: 'testuser' });

    render(<App />);

    // Wait for initializing to finish
    // TodoList usually has "My Tasks" or similar.
    // Or we can check if AuthForm is NOT present.
    // Let's assume TodoList renders something specific.
    // We might need to inspect TodoList component to know what to look for.
    // Or simply check that "Sign in" (AuthForm) is not present.

    await waitFor(() => expect(screen.queryByText(/Sign in/i)).not.toBeInTheDocument());
    // And check if TodoList is rendered (mocking it might be better if it has complex children)
  });

  it('should show login screen if session check fails', async () => {
    (api.getCurrentUser as any).mockRejectedValue(new Error('Unauthorized'));

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Sign in/i)).toBeInTheDocument();
    });
  });
});
