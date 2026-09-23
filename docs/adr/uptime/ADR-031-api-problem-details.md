# ADR-031: API Failures Are Problem Details

## Status

**Implemented** — 2026-09-23. Adopts [`@sdxc/problem`](../../../packages/problem), designed in
[the problem-details package ADR](../ADR-077-problem-details-package.md), across `/api/v1`.

## Background

`/api/v1` answered a failure with `{ "error": { "code", "message" } }`, built by an
`apiError(code, message, status)` helper beside the success envelope. The code was a free
string at each call site, so nothing held the list of codes the API could send: the public
error reference documented codes no handler returned (`METHOD_NOT_ALLOWED`, `ALREADY_ENDED`)
and missed ones that shipped (`SUBSCRIPTION_REQUIRED`, `ENDPOINT_UNAVAILABLE`).

Validation failures joined every schema issue into one `message`, so a client could not tell
which field was wrong without parsing prose. The cron-job ping endpoint and both rate limits
answered in a third shape (`{ "error": "Not Found" }`, `{ "error": "too_many_requests" }`).

## Decision

Every `/api/v1` failure is an RFC 9457 problem details document (`application/problem+json`),
built from one catalog, `apiProblems` in `app/services/api-problems.ts`.

- **Identity.** Each entry's slug is the former code in kebab-case (`VALIDATION_ERROR` →
  `validation-error`), so an error keeps its name across the change.
- **Type URL.** `type` is `https://uptime.sergiodxa.com/docs/api/errors/<slug>`. The public
  origin is the app's own constant origin, and `/docs/api/errors/<slug>` redirects to the error
  reference, so every type dereferences to its documentation.
- **Status per type.** A type always answers with the same status. `internal-error`, the one
  code that answered `400` for a server-side failure, now answers `500`.
- **Validation.** `validation-error` carries an `errors` extension of `{ pointer, code, message }`
  entries, filled from schema issues with `issuesFrom`. A refusal the schema cannot express
  within the request itself (`endsAt` before `startsAt`) uses `invalidField`, which points at
  the field.
- **Conflicts.** A request that collides with existing state answers `409` `conflict`: a status
  page slug already taken, an email the team already invited, a hostname the team already added,
  revoking an invite already accepted, pinging a disabled cron job. The duplicate checks read the
  existing row before writing, which D1 serves without an interactive transaction.
- **Instance.** Each failure gets `instance: urn:uuid:<uuid>`, identifying the occurrence.
- **Rate limits.** Both limiters answer with `rate-limited` through the middleware's `onLimit`,
  and the middleware keeps adding `Retry-After` and the quota headers. The per-monitor ping
  limit sets `Retry-After` itself through the builder's `init`.

The success envelope (`data`/`meta`) is unchanged. HTML routes and inbound webhooks keep their
own responses.

## Consequences

- A breaking change for API clients that read `error.code`; they read the last segment of
  `type` instead. The error reference describes the format and lists every type, and a test
  fails when a catalog entry is missing from it.
- Adding a failure means adding a catalog entry, which gives it a documented, stable URL.
- Tests assert failures through `expectProblem(response, name)`, which checks the media type,
  the entry and the `instance` form in one call.
