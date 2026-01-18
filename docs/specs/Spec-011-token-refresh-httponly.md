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

HttpOnly cookies cannot be accessed by JavaScript, making authentication tokens immune to XSS theft attacks. Even if malicious scripts are injected, they cannot read or exfiltrate the tokens.

### Cookie Attributes (set by backend)

| Attribute    | Value         | Purpose                             |
| ------------ | ------------- | ----------------------------------- |
| **HttpOnly** | `true`        | Prevents JavaScript access          |
| **Secure**   | `true` (prod) | HTTPS-only transmission             |
| **SameSite** | `Lax`         | CSRF protection for POST/PUT/DELETE |

### Logout Security

The `/auth/logout` endpoint uses `POST` method to prevent CSRF attacks. A `GET` logout could be exploited by embedding `<img src="/auth/logout">` on external sites.

### Credential Mode

Using `credentials: 'include'` ensures cookies are sent with all requests, including cross-origin requests to the API.

---

## Verification Plan

> **Note:** Manual testing required (TD-010 pending).

### Cookie Attribute Checks

1. **Login with Remember me ON:**

   - Both `access_token` and `refresh_token` cookies present
   - `refresh_token` has long `Max-Age` (e.g., 7 days)
   - `access_token` has short `Max-Age` (e.g., 30 min)
   - Both cookies have `HttpOnly` and `Secure` flags

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
