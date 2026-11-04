# ADR-191: Remix CSP middleware and `@sdxc/security-headers`

## Status

**Accepted** - 2026-11-04

## Background

Remix 3.2.0 ships `csp()` from `remix/middleware/csp` (and `ContentSecurityPolicy` from
`remix/headers/content-security-policy`): a nonce-based Content-Security-Policy middleware that
stamps the nonce onto generated import maps, module preloads, and `css()` styles, and rewrites
resource nonces across client navigation. That overlaps the CSP and nonce path that lived in
`@sdxc/security-headers`. The package still owns every other response security header apps
configure together.

## Context

### What Remix 3.2.0 covers

| Capability                                                 | Remix `csp()` |
| ---------------------------------------------------------- | ------------- |
| Enforced and Report-Only CSP                               | yes           |
| Per-request nonce, shared with frames and `render()`       | yes           |
| Auto-nonce on import maps, module preloads, `css()` styles | yes           |
| `Reporting-Endpoints`                                      | yes           |
| HSTS / Referrer-Policy / Permissions-Policy / COOP / CORP  | no            |
| `X-Content-Type-Options` / `X-Frame-Options`               | no            |
| CSP violation report body parsing                          | no            |
| CLI / programmatic header audit                            | no            |

### What `@sdxc/security-headers` keeps

HSTS, Referrer-Policy, Permissions-Policy, COOP/COEP/CORP, nosniff, optional `xFrameOptions`,
typed CSP parse/stringify/merge (for audits, the CLI, and Remix factories via `remixCsp`),
`parseReports`, the audit CLI, and `cspPatch()` for the rare handler that must rewrite a CSP
header Remix already serialized (import-map hash, front-channel logout `frame-src`,
check-session).

## Decision

Use Remix's `csp()` for Content-Security-Policy, Reporting-Endpoints, and the request nonce.
Keep `@sdxc/security-headers` for the other response policy headers and for CSP utilities.
Do not deprecate the package on npm.

Apps install both middlewares:

```ts
cspPatch(), // only when a handler must rewrite CSP after the fact
csp({
	reportOnlyPolicy: ({ nonce }) => remixCsp(CONTENT_SECURITY_POLICY, nonce),
	reportingEndpoints: { csp: "/reports/csp" },
}),
securityHeaders(SECURITY_POLICY),
assets(resolver, { nonce: (ctx) => getCspNonce(ctx) }),
render({ assets: resolver }),
```

`SecurityHeaders.Policy` no longer carries CSP fields. `ctx.securityHeaders.nonce` is gone;
callers read `getCspNonce(ctx)`. Handler-time CSP changes go through `patchCsp(ctx, …)` with
`cspPatch()` wrapping `csp()`.

## Consequences

### Positive

- Remix owns nonce stamping on `css()`, import maps, frames and client navigation.
- One package still reviews HSTS, Permissions-Policy and the rest as a typed object.
- CSP parse, audit and report parsing keep a home without reimplementing Remix.

### Negative

- Two middlewares per app instead of one.
- `cspPatch()` is an escape hatch for policies Remix serializes before handlers run.

### Neutral

- Peer dependency is `remix` 3.2.0.
- ADR-089's package still stands; its "Remix writes no CSP" claim is superseded here.

## Alternatives Considered

### Delete `@sdxc/security-headers` and deprecate on npm

**Rejected because**: Remix does not cover HSTS, Permissions-Policy, Referrer-Policy,
COOP/CORP, nosniff, report parsing or the audit CLI.

### Keep CSP inside `@sdxc/security-headers` middleware

**Rejected because**: Remix's `render()` integration for nonces on styles and import maps is
the better CSP path, and duplicating it would drift on every Remix release.

## References

- [remix@3.2.0 release notes](https://github.com/remix-run/remix/releases/tag/remix%403.2.0)
- [ADR-089: Security Headers Package](./ADR-089-security-headers-package.md)
