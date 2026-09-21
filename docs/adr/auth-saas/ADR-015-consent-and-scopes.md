# ADR-015: Consent and Scopes

## Status

**Proposed** - 2026-09-18

## Background

A scope is what a client asks for and a grant is what a person agreed to give it. Between
them sits the consent screen, the one moment in the protocol where a person is shown what
an application will be able to read and decides.

[ADR-011](./ADR-011-authorization-endpoint-and-pkce.md) branches on this: its
`beginAuthorization` returns a `consent` outcome carrying a `ConsentScreen`, and
[ADR-012](./ADR-012-token-endpoint-and-refresh-rotation.md) mints tokens for whatever
scopes the resulting grant holds. What is left to settle is which scopes exist, what each
one carries, when the screen is shown, what is stored so it is shown once rather than every
time, and how a person takes the decision back.

Consent and scopes are part of the OIDC/OAuth2 core, so they are available on Free,
including the tenant's own scope definitions.

## Context

### A scope is a name; a claim is a value

| Scope            | What it carries                                                                  |
| ---------------- | -------------------------------------------------------------------------------- |
| `openid`         | `sub`, and the presence of an ID token                                           |
| `profile`        | The OIDC profile claims — `name`, `given_name`, `picture`, `locale` and the rest |
| `email`          | `email`, `email_verified`                                                        |
| `address`        | `address`                                                                        |
| `offline_access` | No claims; it is what makes a refresh token issuable                             |

The OIDC `phone` scope is absent, and no subject holds a phone number. The verified mailbox
is the ownership credential here, so a number would add a carrier attack surface and a
per-message cost while carrying nothing a client can use.

A tenant defines its own scopes beyond these — `invoices:read`, `reports:write` — and each
carries a title and description for the screen and, optionally, a list of claims to add to
`/userinfo` and the ID token. A tenant-defined scope with no claims is a name that reaches
the access token's `scope` claim and means whatever the tenant's own API decides. Turning
scopes into a role and permission model is ADR-031: Roles and Permissions, which is its own
add-on; the vocabulary itself is base.

### Consent answers a question about the client, not about the request

| Situation                                           | Screen                                |
| --------------------------------------------------- | ------------------------------------- |
| Client is first-party                               | Skipped                               |
| A stored grant already covers every requested scope | Skipped                               |
| A requested scope is outside the stored grant       | Shown, listing the new scopes         |
| No stored grant                                     | Shown                                 |
| `prompt=consent`                                    | Shown                                 |
| Consent needed under `prompt=none`                  | `consent_required` back to the client |

A first-party client is one the tenant registered as its own application, which ADR-014:
Clients and Client Secrets records on the client. Asking a person to authorize the
tenant's own sign-in application to read their profile on the tenant's own site is a dialog
that teaches people to click through dialogs, so it is skipped — and the grant is still
written, so the client appears in the account portal and can be revoked like any other.

OIDC says a request using `offline_access` should ask for `prompt=consent`. A third-party
client asking for it therefore sees the screen with offline access named on it. A
first-party client skips the screen for `offline_access` as for anything else, because the
person's relationship is with the tenant rather than with that application.

### A remembered decision is only honest if it can be taken back

Storing consent is what keeps the second sign-in quiet, and it also means a decision made
once stays in force unattended. The record therefore has to be visible and revocable by the
person who made it, and revoking it has to reach the tokens it authorized rather than
merely stopping the next one.

## Decision

### Tables

`scopes` holds `name`, `title`, `description`, `claims`, `is_standard`, `created_at`. The
standard rows above are seeded by ADR-004's schema registry when a tenant object is
created; tenant-defined rows are written through the management API.

`grants` holds `subject_id`, `client_id`, `scopes`, `created_at`, `updated_at`, keyed on
the subject and client pair. One row is a person's standing decision about one application.

### What the consent screen is given

The screen is rendered from what `beginAuthorization` already returned, so showing it costs
no round trip of its own:

```ts
type ConsentScreen = {
	client: {
		id: string;
		name: string;
		logoUri: string | null;
		policyUri: string | null;
		tosUri: string | null;
	};
	subject: { id: string; displayName: string; email: string | null };
	requested: Array<{ scope: string; title: string; description: string; granted: boolean }>;
};
```

`granted` is what makes incremental consent renderable: a client that returns later asking
for `invoices:read` alongside scopes the person already gave sees a screen that says so,
and the person decides about the addition rather than about the whole set again.

### Deciding, and undeciding

```ts
decideConsent(input: {
  interactionId: string; sessionId: string; approved: boolean; now: number;
}): AuthorizationOutcome;

revokeGrant(input: { subjectId: string; clientId: string; now: number }):
  { kind: "revoked" } | { kind: "unknown" };

listGrants(input: { subjectId: string; cursor: string | null; limit: number }):
  { grants: Array<{ clientId: string; clientName: string; scopes: string[]; createdAt: number }>;
    cursor: string | null };
```

`decideConsent` returns ADR-011's `AuthorizationOutcome`, so approval and denial are one
round trip each: approval unions the agreed scopes into the grant and answers with a
redirect carrying a code, denial answers with a redirect carrying `access_denied`. The
scopes it records come from the stored interaction rather than from the submitted form, so
a tampered submission authorizes nothing the original request did not ask for.

`revokeGrant` deletes the row and, in the same operation, runs
`UPDATE refresh_tokens SET revoked_at = ? WHERE subject_id = ? AND client_id = ?`, so the
application stops working now rather than at the end of its refresh window. `listGrants`
returns both ordering columns in its projection, as ADR-001 requires of anything paginated.

## Consequences

### Positive

- Consent costs no round trip beyond the authorization request that raised it, approving
  costs one, and the screen distinguishes what is already granted from what is being asked
  for, so a person sees a new permission as a new permission.
- Revocation reaches issued refresh tokens, so withdrawing consent is immediate rather than
  eventual.
- A tenant's own scopes are first-class, so an API behind this provider describes its own
  permissions in the same vocabulary as the standard ones.

### Negative

- First-party clients skipping the screen means the flag that marks a client first-party is
  a security decision made in a settings form, where it does not look like one.
- A grant is keyed by subject and client, so two applications registered as one client
  share one grant and one revocation.
- Storing a decision means a scope's meaning can drift after the fact: a tenant that
  redefines what `reports:write` covers changes what old grants allow.

### Neutral

- Claims attached to a tenant-defined scope resolve in the object rather than from the
  cached snapshot ADR-013 describes, so they cost a round trip at `/userinfo`.
- Scopes a client requests but has not been registered for are refused at the authorization
  endpoint, so the screen never offers something the client could not receive.

## Alternatives Considered

**Ask for consent on every authorization request.** No stored grant, no revocation surface,
and the person sees every request. It also trains people to approve a screen they meet
several times a day, which makes the screen stop carrying information. Rejected.

**Replace the whole grant on each consent.** Simpler than a union, and it keeps the record
equal to the last decision. It silently drops scopes the person granted earlier, so a
client asking for less would lose access it still had. Rejected in favour of union plus
explicit revocation.

**Let the consent form post the scopes back.** The conventional HTML shape, and it allows
per-scope checkboxes. It also makes the browser the authority on what was requested, which
turns a form field into an escalation path. Rejected: the stored interaction is the
authority, and selective consent is expressible against it without trusting the form.

## References

- [ADR-001: Auth SaaS on Per-Tenant Durable Objects](./ADR-001-auth-saas-on-per-tenant-durable-objects.md) — whole-operation methods and the pagination projection rule
- [ADR-011: Authorization Endpoint and PKCE](./ADR-011-authorization-endpoint-and-pkce.md) — raises the consent outcome and owns `AuthorizationOutcome`
- [ADR-012: Token Endpoint and Refresh Rotation](./ADR-012-token-endpoint-and-refresh-rotation.md) — issues tokens for a grant's scopes and holds the rows revocation reaches
- [ADR-013: Discovery and UserInfo](./ADR-013-discovery-and-userinfo.md) — publishes the catalog as `scopes_supported` and returns the claims a scope carries
- [ADR-014: Clients and Client Secrets](./ADR-014-clients-and-client-secrets.md) — records which clients are first-party and which scopes each may request
