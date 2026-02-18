import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TodoList } from './TodoList';
import { api } from '../services/api';
import { Todo } from '../types';

// Mock the API module
vi.mock('../services/api', () => ({
  api: {
    getTodos: vi.fn(),
    createTodo: vi.fn(),
    updateTodo: vi.fn(),
    deleteTodo: vi.fn(),
  },
}));

const mockTodos: Todo[] = [
  {
    id: '1',
    title: 'Test Todo 1',
    description: 'Description 1',
    completed: false,
    priority: 'medium',
    due_date: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user_id: '1',
  },
  {
    id: '2',
    title: 'Test Todo 2',
    description: 'Description 2',
    completed: true,
    priority: 'high',
    due_date: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user_id: '1',
  },
];

describe('TodoList Component', () => {
  const mockOnLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getTodos).mockImplementation(async (completed) => {
      if (completed === undefined) return mockTodos;
      return mockTodos.filter((t) => t.completed === completed);
    });
  });

  it('renders todos correctly', async () => {
    render(<TodoList onLogout={mockOnLogout} />);

    await waitFor(() => {
      expect(screen.getByText('Test Todo 1')).toBeInTheDocument();
      expect(screen.getByText('Test Todo 2')).toBeInTheDocument();
    });
  });

  it('filters todos correctly', async () => {
    render(<TodoList onLogout={mockOnLogout} />);

    await waitFor(() => expect(screen.getByText('Test Todo 1')).toBeInTheDocument());

    // Switch to 'Active'
    const activeFilterBtn = screen.getByText('Active');
    fireEvent.click(activeFilterBtn);

    await waitFor(() => {
      expect(screen.getByText('Test Todo 1')).toBeInTheDocument();
      expect(screen.queryByText('Test Todo 2')).not.toBeInTheDocument();
    });

    // Switch to 'Completed'
    const completedFilterBtn = screen.getByText('Completed');
    fireEvent.click(completedFilterBtn);

    await waitFor(() => {
      expect(screen.queryByText('Test Todo 1')).not.toBeInTheDocument();
      expect(screen.getByText('Test Todo 2')).toBeInTheDocument();
    });
  });

  it('optimistically updates todo completion', async () => {
    render(<TodoList onLogout={mockOnLogout} />);

    await waitFor(() => expect(screen.getByText('Test Todo 1')).toBeInTheDocument());

    const todo1 = mockTodos[0];

    // Mock API success but delay it to verify optimistic update
    vi.mocked(api.updateTodo).mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100)); // Delay
      return { ...todo1, completed: true };
    });

    // Find the toggle button within the todo item
    const todoItem = screen.getByText('Test Todo 1').closest('.group');
    const toggleBtn = todoItem?.querySelector('button');

    expect(toggleBtn).toBeInTheDocument();
    if (toggleBtn) fireEvent.click(toggleBtn);

    // Expect immediate UI update (optimistic)
    // The todo text gets line-through class when completed
    await waitFor(() => {
      const title = screen.getByText('Test Todo 1');
      expect(title).toHaveClass('line-through');
    });

    // Verify API called
    expect(api.updateTodo).toHaveBeenCalledWith('1', { completed: true });
  });

  it('reverts optimistic update on API failure', async () => {
    render(<TodoList onLogout={mockOnLogout} />);

    await waitFor(() => expect(screen.getByText('Test Todo 1')).toBeInTheDocument());

    const todoItem = screen.getByText('Test Todo 1').closest('.group');
    const toggleBtn = todoItem?.querySelector('button');

    // Mock API failure
    vi.mocked(api.updateTodo).mockRejectedValue(new Error('API Error'));

    if (toggleBtn) fireEvent.click(toggleBtn);

    // Initially changes to completed (optimistic)
    await waitFor(() => {
      const title = screen.getByText('Test Todo 1');
      expect(title).toHaveClass('line-through');
    });

    // Then reverts back to incomplete
    await waitFor(() => {
      const title = screen.getByText('Test Todo 1');
      expect(title).not.toHaveClass('line-through');
    });
  });
});
