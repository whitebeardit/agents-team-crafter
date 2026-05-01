# Live Timeline Rollout Checklist

## Scope
- Keep chat console flow as fallback.
- Enable timeline view in `TeamDebugConsole` with toggle.
- Keep graph live behavior unchanged for node status rendering.

## Functional checks
- Open `/teams/:id/graph` and enable `Live`.
- Confirm replay populates timeline on first load.
- Confirm new SSE items are appended without duplicates.
- Confirm `Chat` and `Timeline` toggle works in console panel.
- Confirm filters (`kind`, `actor`) change timeline output correctly.
- Confirm density mode (`compact`/`detailed`) remains readable.

## Reliability checks
- Simulate network interruption and verify stream reconnects.
- Verify no repeated timeline rows after reconnect.
- Verify per-agent memory cap keeps UI responsive.

## Fallback checks
- Switch to `Chat` mode and validate original console interactions.
- Confirm `POST /teams/:id/run/stream` path still works unchanged.
- Confirm disabling `Live` clears transient UI state.

## Exit criteria
- Timeline works in at least two contexts (`graph` + `TeamDebugConsole`).
- No lint/type/test regressions in modified files.
- Manual smoke pass completed in real live session.
