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
- Add retry logic: on 401, call `/token/refresh`, retry original request
- Show toast on successful refresh

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
- Verify session via API call on mount
- Logout calls `/auth/logout` endpoint

### 5. New Components

- `components/Toast.tsx` - Toast notification for "Session extended"

---

## Verification Plan

> **Note:** Manual testing required (TD-010 pending).

1. **Login with Remember me ON:** Both cookies set
2. **Login with Remember me OFF:** Only access_token cookie
3. **Token refresh:** Toast appears, action completes
4. **Logout:** Both cookies cleared
5. **No refresh cookie:** Session ends without retry
