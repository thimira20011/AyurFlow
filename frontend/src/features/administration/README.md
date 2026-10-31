# Administration interface

`session.tsx` owns memory-only session state, startup/focus restoration, expiry handling and logout. `sign-in-form.tsx` uses the existing cookie API. `/workspace` shows role work areas; the shared layout guard is UI behavior, never a substitute for Go role/record checks. `apiMutation` obtains current CSRF and never automatically retries writes. `/administration` remains a placeholder until the next AUTH-04 slice. See `docs/api/auth-04-login.md` for setup and verification. No public signup, remember-me policy or password recovery is introduced.
