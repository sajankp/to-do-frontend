# Spec-019: Trailing Slashes on API Requests

## Background

The backend API requires trailing slashes on endpoints. Currently, the frontend requests endpoints without trailing slashes (e.g. `POST /todo`), which results in the backend issuing a 307 Temporary Redirect to `/todo/`. This introduces unnecessary latency.

## Objectives

- Append trailing slashes to all API endpoints requested by the frontend to eliminate 307 redirects.

## Implementation Details

1. Update `services/api.ts` to ensure all `fetch` and `fetchClient` calls include a trailing slash.
2. Update the MSW test mocks in `services/api.test.ts` to match the new endpoints with trailing slashes, ensuring that the test suite continues to pass.

## Testing Strategy

- Run frontend unit tests via `npm run test` to verify MSW intercepts correctly.
- Rely on automated tests since UI functionality should remain identical, just without the underlying HTTP redirect.
