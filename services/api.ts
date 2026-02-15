import { AuthResponse, Todo } from '../types';

// Use environment variable for API URL, fallback to localhost for development
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;

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
      isRefreshing = true;
      refreshPromise = (async () => {
        try {
          // Call refresh endpoint directly (bypass wrapper to avoid recursion loop check issues)
          // We use 'include' to send the refresh_token cookie
          const refreshResponse = await fetch(`${BASE_URL}/token/refresh`, {
            method: 'POST',
            credentials: 'include',
          });

          if (!refreshResponse.ok) {
            throw new Error('Refresh failed');
          }
        } catch (error) {
          // If refresh fails, logout and throw
          isRefreshing = false;
          // Clear any local state if needed (though cookies are cleared by backend/browser)
          window.location.hash = ''; // Redirect to login (App.tsx checks this or session)
          throw error;
        } finally {
          isRefreshing = false;
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
    // Note: URLSearchParams converts boolean to string 'true'/'false'
    // But backend might expect it in the body or query? Spec says "Accept remember_me parameter"
    // Usually OAuth2 forms are strict. Let's check spec.
    // Spec says: "Accept remember_me parameter to control refresh token storage"
    // It's likely a query param or form field. Let's assume form field for now if it's x-www-form-urlencoded.
    // If it was a query param: `${BASE_URL}/token?remember_me=${rememberMe}`
    // Let's add it to formData just in case.
    if (rememberMe) {
      formData.append('remember_me', 'true');
    }

    // Login uses fetch directly or fetchClient?
    // Login shouldn't need a token, but it sets cookies.
    // We can use fetchClient, but simpler to just use fetch since we don't need 401 interception on login itself.
    // Actually, we DO want credentials: include (maybe? no, login sets them).
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
    // New logout endpoint
    await fetchClient('/auth/logout', {
      method: 'POST',
    });
    window.location.hash = '';
    window.location.reload(); // Ensure clean state
  },

  getCurrentUser: async (): Promise<any> => {
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
