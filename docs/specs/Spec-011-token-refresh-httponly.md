# Spec-011: Token Refresh with HttpOnly Cookies

**Status:** Approved
**Roadmap Items:** TD-011 + TD-015
**Effort:** 1 day (frontend portion)

---

## Problem Statement

When access tokens expire, users are logged out. This spec implements automatic token refresh using HttpOnly cookies set by the backend.

## Goals

1. Use `credentials: 'include'` for all API calls (cookies sent automatically)
2. Retry requests on 401 after attempting refresh
3. "Remember me" checkbox controls refresh token storage
4. Toast notification on silent session refresh
5. Remove all localStorage token handling

---

## Proposed Changes

### 1. API Service (`services/api.ts`)

- Remove `localStorage` token handling
- Add `credentials: 'include'` to all fetch calls
- Add retry logic with the following behavior:
  - On 401, call `POST /token/refresh`
  - If refresh succeeds: retry original request, show toast "Session extended"
  - If refresh fails (401): clear auth state, redirect to login
- **Concurrent request handling:** Use a refresh mutex/promise to ensure only one refresh request is in flight. Other failed requests wait for the single refresh result before retrying.

```typescript
// Pseudocode for concurrent refresh handling
let refreshPromise: Promise<boolean> | null = null;

async function refreshToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise; // Wait for existing refresh

  refreshPromise = doRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}
```

### 2. Types (`types.ts`)

Update `AuthResponse`:

```typescript
export interface AuthResponse {
  message: string;
  token_type: 'cookie';
}
```

### 3. Auth Form (`components/AuthForm.tsx`)

- Add `rememberMe` state (default: true)
- Add checkbox UI below password field
- Pass `remember_me` to login request

### 4. App Component (`App.tsx`)

- Remove `localStorage.getItem('token')` check
- Verify session on mount by calling `GET /auth/me` (returns user info if session valid, 401 if not)
- Logout calls `POST /auth/logout` endpoint (POST method for CSRF protection)

### 5. New Components

- `components/Toast.tsx` - Toast notification for "Session extended"

---

## Security Considerations

### Why HttpOnly Cookies?

HttpOnly cookies cannot be accessed by JavaScript, making authentication tokens immune to XSS theft attacks.

### Cross-Origin Deployment

> [!IMPORTANT]
> Frontend (GitHub Pages) and backend (Render) are on **different domains**.
> This requires `SameSite=None` cookies and `credentials: 'include'` on all requests.

### Cookie Attributes (set by backend)

| Attribute    | Value  | Purpose                                       |
| ------------ | ------ | --------------------------------------------- |
| **HttpOnly** | `true` | Prevents JavaScript access                    |
| **Secure**   | `true` | HTTPS-only (required with SameSite=None)      |
| **SameSite** | `None` | Required for cross-origin cookie transmission |

### CSRF Protection

With `SameSite=None`, automatic CSRF protection is reduced. Mitigations:

1. **Backend CORS:** Only allows `https://sajankp.github.io`
2. **State-changing endpoints:** All use POST/PUT/DELETE (not GET)
3. **Logout:** Uses POST to prevent `<img src>` attacks

### Credential Mode

Using `credentials: 'include'` is **mandatory** for cross-origin cookies:

```typescript
fetch(url, { credentials: 'include', ... })
```

---

## Verification Plan

> **Note:** Manual testing required (TD-010 pending).

### Cookie Attribute Checks

1. **Login with Remember me ON:**

   - Both `access_token` and `refresh_token` cookies present
   - `refresh_token` has long `Max-Age` (e.g., 7 days)
   - `access_token` has short `Max-Age` (e.g., 30 min)
   - Both cookies have `HttpOnly`, `Secure`, and `SameSite=None` flags

2. **Login with Remember me OFF:**

   - Both cookies are session cookies (no `Max-Age`)
   - Cookies cleared when browser closes

3. **Token refresh:**

   - Session extended silently
   - Toast appears with "Session extended"
   - Action completes successfully

4. **Logout:**

   - `POST /auth/logout` called
   - Both cookies cleared (`Max-Age=0`)
   - User redirected to login

5. **No refresh cookie (expired/cleared):**

   - Session ends on next 401
   - User redirected to login without retry loop

6. **Cross-origin verification:**
   - Open DevTools Network tab
   - Confirm cookies sent on API requests to Render domain
   - Confirm CORS headers present in responses
