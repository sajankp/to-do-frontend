import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { api } from './api';
import { server } from '../src/setupTests';
import { http, HttpResponse } from 'msw';

const BASE_URL = 'http://localhost:8000';

describe('API Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    // Reset window.location mock (still needed if any legacy code touched it, but we removed it)
    // Minimally mock it just in case
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { hash: '', reload: vi.fn(), href: '' },
    });
  });

  it('should include credentials: "include" in requests', async () => {
    let capturedRequest: Request | undefined;

    server.use(
      http.get(`${BASE_URL}/todo`, ({ request }) => {
        capturedRequest = request;
        return HttpResponse.json([]);
      })
    );

    await api.getTodos();

    expect(capturedRequest).toBeDefined();
    expect(capturedRequest?.credentials).toBe('include');
  });

  it('should NOT include Authorization header (cookies used instead)', async () => {
    let capturedHeaders: Headers | undefined;

    server.use(
      http.get(`${BASE_URL}/todo`, ({ request }) => {
        capturedHeaders = request.headers;
        return HttpResponse.json([]);
      })
    );

    await api.getTodos();

    expect(capturedHeaders?.get('Authorization')).toBeNull();
  });

  it('should refresh token and retry request on 401', async () => {
    let todoCallCount = 0;
    let refreshCallCount = 0;

    server.use(
      http.get(`${BASE_URL}/todo`, () => {
        todoCallCount++;
        if (todoCallCount === 1) {
          return new HttpResponse(null, { status: 401 });
        }
        return HttpResponse.json([{ id: 1, title: 'Refreshed Todo' }]);
      }),
      http.post(`${BASE_URL}/token/refresh`, () => {
        refreshCallCount++;
        return HttpResponse.json({ message: 'Refreshed' });
      })
    );

    const todos = await api.getTodos();

    expect(refreshCallCount).toBe(1);
    expect(todoCallCount).toBe(2); // Initial fail + Retry
    expect(todos).toHaveLength(1);
  });

  it('should notify unauthorized observers if refresh fails', async () => {
    server.use(
      http.get(`${BASE_URL}/todo`, () => {
        return new HttpResponse(null, { status: 401 });
      }),
      http.post(`${BASE_URL}/token/refresh`, () => {
        return new HttpResponse(null, { status: 401 }); // Refresh also failed
      })
    );

    const onUnauthorizedSpy = vi.fn();
    api.onUnauthorized(onUnauthorizedSpy);

    await expect(api.getTodos()).rejects.toThrow('Unauthorized');

    expect(onUnauthorizedSpy).toHaveBeenCalled();
    // Ensure we don't reload page
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  it('should coalesce multiple concurrent 401s into a single refresh', async () => {
    let refreshCallCount = 0;
    let todoCalls = 0;
    let patchCalls = 0;

    server.resetHandlers(
      http.get(`${BASE_URL}/todo`, () => {
        todoCalls++;
        if (todoCalls === 1) return new HttpResponse(null, { status: 401 });
        return HttpResponse.json([]);
      }),
      http.patch(`${BASE_URL}/todo/1`, () => {
        patchCalls++;
        if (patchCalls === 1) return new HttpResponse(null, { status: 401 });
        return HttpResponse.json({});
      }),
      http.post(`${BASE_URL}/token/refresh`, async () => {
        refreshCallCount++;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return HttpResponse.json({ message: 'Refreshed' });
      })
    );

    await Promise.allSettled([api.getTodos(), api.updateTodo(1, { title: 'Updated' })]);

    expect(refreshCallCount).toBe(1);
    expect(todoCalls).toBe(2);
    expect(patchCalls).toBe(2);
  });
});
