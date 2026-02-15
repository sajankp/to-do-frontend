import { AuthResponse, Todo, User } from '../types';

// Use environment variable for API URL, fallback to localhost for development
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

let refreshPromise: Promise<void> | null = null;
type UnauthorizedCallback = () => void;
const unauthorizedCallbacks: UnauthorizedCallback[] = [];

/**
 * Centralized fetch wrapper (Middleware)
 * - Adds credentials: 'include' to all requests
 * - Handles 401 Unauthorized responses with automatic token refresh
 * - Coalesces multiple concurrent 401s into a single refresh request
 */
const fetchClient = async (endpoint: string, options: RequestInit = {}): Promise<Response> => {
  const url = `${BASE_URL}${endpoint}`;

  const config: RequestInit = {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  const response = await fetch(url, config);

  // If unauthorized, attempt to refresh token
  if (response.status === 401) {
    // Prevent infinite loops: Don't refresh if the failed request WAS a refresh attempt
    if (endpoint === '/token/refresh') {
      return response;
    }

    if (!refreshPromise) {
      refreshPromise = (async () => {
        try {
          // Call refresh endpoint directly (bypass wrapper to avoid recursion loop check issues)
          // We use 'include' to send the refresh_token cookie
          const refreshResponse = await fetch(`${BASE_URL}/token/refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
          });

          if (!refreshResponse.ok) {
            // Only notify unauthorized for auth failures (401/403)
            if (refreshResponse.status === 401 || refreshResponse.status === 403) {
              api.notifyUnauthorized();
            }
            throw new Error('Refresh failed');
          }
        } catch (error) {
          // Only notify unauthorized for auth-related errors
          // Network errors or 5xx errors should not force logout
          if (error instanceof Error && error.message === 'Refresh failed') {
            // Already handled above based on status code
          } else {
            // Network error - don't force logout, let the request fail naturally
          }
          throw error;
        } finally {
          refreshPromise = null;
        }
      })();
    }

    try {
      await refreshPromise;
      // Retry the original request
      return fetch(url, config);
    } catch (error) {
      // If refresh failed, the original request fails with 401 (or the error)
      // We can return the original 401 response or throw.
      // Existing logic expects an error to be thrown for handling.
      throw new Error('Unauthorized');
    }
  }

  return response;
};

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    // If we are here, it means it wasn't a 401 (or 401 retry failed and returned 401 again)
    if (response.status === 401) {
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
  // Auth Observer
  onUnauthorized: (callback: UnauthorizedCallback) => {
    unauthorizedCallbacks.push(callback);
    return () => {
      const index = unauthorizedCallbacks.indexOf(callback);
      if (index > -1) {
        unauthorizedCallbacks.splice(index, 1);
      }
    };
  },

  notifyUnauthorized: () => {
    unauthorizedCallbacks.forEach((cb) => cb());
  },

  // Auth
  login: async (
    username: string,
    password: string,
    rememberMe: boolean = true
  ): Promise<AuthResponse> => {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    // Add remember_me if backend supports it (Spec-015 says it does)
    if (rememberMe) {
      formData.append('remember_me', 'true');
    }

    // Spec says: "Set HttpOnly cookies instead of returning tokens in body"
    const response = await fetch(`${BASE_URL}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      credentials: 'include', // Important to accept Set-Cookie
      body: formData,
    });

    return handleResponse<AuthResponse>(response);
  },

  register: async (username: string, email: string, password: string): Promise<boolean> => {
    const response = await fetchClient('/user', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
    return handleResponse<boolean>(response);
  },

  logout: async (): Promise<void> => {
    try {
      await fetchClient('/auth/logout', {
        method: 'POST',
      });
    } finally {
      // Always notify UI to clear state
      api.notifyUnauthorized();
    }
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await fetchClient('/user/me');
    return handleResponse(response);
  },

  // todo
  getTodos: async (): Promise<Todo[]> => {
    const response = await fetchClient('/todo', {
      method: 'GET',
    });
    return handleResponse<Todo[]>(response);
  },

  createTodo: async (
    title: string,
    description: string,
    priority: string,
    due_date: string
  ): Promise<Todo> => {
    const response = await fetchClient('/todo', {
      method: 'POST',
      body: JSON.stringify({ title, description, priority, due_date }),
    });
    return handleResponse<Todo>(response);
  },

  updateTodo: async (id: string | number, todo: Partial<Todo>): Promise<Todo> => {
    const response = await fetchClient(`/todo/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(todo),
    });
    return handleResponse<Todo>(response);
  },

  deleteTodo: async (id: string | number): Promise<void> => {
    const response = await fetchClient(`/todo/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      // reuse handleResponse logic for error parsing
      await handleResponse(response);
    }
  },
};
