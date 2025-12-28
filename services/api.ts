import { AuthResponse, Todo } from '../types';

// Use environment variable for API URL, fallback to localhost for development
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('token');
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
};

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('token');
      window.location.hash = '';
      throw new Error('Unauthorized');
    }
    const errorData = await response
      .json()
      .catch(() => ({ detail: 'An unexpected error occurred' }));
    const message = Array.isArray(errorData.detail)
      ? errorData.detail.map((e: any) => e.msg).join(', ')
      : errorData.detail || 'API Error';
    throw new Error(message);
  }
  return response.json();
};

export const api = {
  // Auth
  login: async (username: string, password: string): Promise<AuthResponse> => {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    const response = await fetch(`${BASE_URL}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });
    return handleResponse<AuthResponse>(response);
  },

  register: async (username: string, email: string, password: string): Promise<boolean> => {
    const response = await fetch(`${BASE_URL}/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    return handleResponse<boolean>(response);
  },

  // todo
  getTodos: async (): Promise<Todo[]> => {
    const response = await fetch(`${BASE_URL}/todo`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return handleResponse<Todo[]>(response);
  },

  createTodo: async (
    title: string,
    description: string,
    priority: string,
    due_date: string
  ): Promise<Todo> => {
    const response = await fetch(`${BASE_URL}/todo`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ title, description, priority, due_date }),
    });
    return handleResponse<Todo>(response);
  },

  updateTodo: async (id: string | number, todo: Partial<Todo>): Promise<Todo> => {
    const response = await fetch(`${BASE_URL}/todo/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(todo),
    });
    return handleResponse<Todo>(response);
  },

  deleteTodo: async (id: string | number): Promise<void> => {
    const response = await fetch(`${BASE_URL}/todo/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to delete');
    }
    // Consume response body as API returns JSON on success
    await response.json().catch(() => {});
  },
};
