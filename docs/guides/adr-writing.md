# ADR Guidelines

This document describes how to write Architecture Decision Records (ADRs) in this monorepo.

## What is an ADR?

An Architecture Decision Record captures a significant technical decision along with its context and consequences. ADRs document the "why" behind architectural choices, making it easier for current and future team members to understand the reasoning.

## When to Write an ADR

Write an ADR when:

- Introducing a new pattern or technology
- Making significant changes to system architecture
- Migrating from one approach to another
- Extracting shared packages from application code
- Implementing complex features that span multiple components
- Making decisions that affect multiple applications
- Deferring a decision for future implementation

Do not write an ADR for:

- Bug fixes
- Routine feature additions
- Code refactoring that follows existing patterns
- Minor implementation details

## File Location and Naming

### Monorepo-wide decisions

Place in `docs/adr/` with sequential numbering:

```
docs/adr/ADR-001-new-package-extraction.md
docs/adr/ADR-002-sso-logout-with-id-token-hint.md
docs/adr/ADR-003-oidc-backchannel-logout.md
```

### App-specific decisions

Place in `docs/adr/{app}/` with app-scoped sequential numbering:

```
docs/adr/auth/ADR-001-package-consistency.md
docs/adr/auth/ADR-002-self-login-oauth-flow.md
docs/adr/uptime/ADR-001-analytics-engine-migration.md
```

### Naming convention

```
ADR-{number}-{kebab-case-title}.md
```

- Use three-digit padding for consistency (001, 002, etc.)
- Use kebab-case for the title
- Keep titles concise but descriptive

## Structure

Every ADR should follow this structure:

1. **Title** - ADR number and descriptive name
2. **Status** - Current state with date
3. **Background** - What prompted this decision
4. **Context** - Current state, problems, and technical details
5. **Decision** - What we decided to do
6. **Consequences** - Positive, negative, and neutral impacts
7. **Implementation Plan** (optional) - Phased approach for complex changes
8. **Alternatives Considered** (optional) - Other options evaluated
9. **References** (optional) - Links to specs, docs, or related ADRs
10. **Current Progress** (optional) - Checklist of completed phases
11. **Notes** (optional) - Additional context and gotchas

## Section Guidelines

### Title

Use the ADR number and a clear, descriptive name:

```markdown
# ADR-001: New Package Extraction
```

### Status

Include the status in bold with the date:

```markdown
## Status

**Implemented** - 2026-02-16
```

Valid statuses:

| Status          | Description                           |
| --------------- | ------------------------------------- |
| **Proposed**    | Under discussion, not yet accepted    |
| **Accepted**    | Decision made, implementation pending |
| **Implemented** | Fully implemented and deployed        |
| **Deferred**    | Postponed for future consideration    |
| **Superseded**  | Replaced by another ADR (link to it)  |
| **Deprecated**  | No longer relevant, kept for history  |

For superseded ADRs, include a link:

```markdown
## Status

**Superseded** by [ADR-005](./ADR-005-improved-approach.md) - 2026-03-01
```

### Background

Explain what prompted the need for this decision. Include:

- The problem or opportunity
- How it was discovered
- Why it matters now

Keep it to 1-2 paragraphs.

```markdown
## Background

The monorepo uses a centralized OAuth 2.0 / OpenID Connect authorization server
for authentication across multiple client applications. Users can log in once
and be authenticated across all apps (Single Sign-On).

However, when a user logs out of a client application, they remain logged in
to the auth server and other client apps. This breaks the expected SSO logout
behavior.
```

### Context

Provide the technical context needed to understand the decision:

- Current state and architecture
- Specific issues or limitations
- Technical constraints
- Relevant code paths or files

Use subsections, tables, and code blocks to organize information:

```markdown
## Context

### Current Logout Flow

1. User clicks "Logout" in a client app
2. Client app destroys its local session
3. User is still logged in to auth server and other apps

### Technical Issues Identified

| Issue                      | Location                     |
| -------------------------- | ---------------------------- |
| ID token not stored        | `apps/uptime/app/session.ts` |
| No redirect to auth server | `apps/blog/app/routes/*.tsx` |
| Wrong URI validation       | `apps/auth/app/modules/*.ts` |
```

### Decision

Describe what was decided and why. Include:

- The chosen approach
- Key design decisions
- API designs or schemas
- Code examples showing the implementation

Organize complex decisions with subsections:

```markdown
## Decision

Implement OIDC RP-Initiated Logout by:

1. **Storing the ID token** in client app sessions
2. **Redirecting to auth server** on logout with `id_token_hint`
3. **Fixing URI validation** in auth server

### Apps/Uptime Changes

#### 1. Update Session Type

Add `idToken` field to store the raw JWT string:

\`\`\`typescript
export interface SessionData {
id: string;
name: string;
idToken: string; // Raw ID token JWT for OIDC logout
}
\`\`\`
```

### Consequences

List the impacts of the decision. Always include positive, negative, and neutral sections:

```markdown
## Consequences

### Positive

- **True SSO logout**: Logging out of any app logs the user out everywhere
- **OIDC compliant**: Follows the specification
- **Security**: Session is properly revoked on the auth server

### Negative

- **Extra redirect**: Logout now requires a round-trip to the auth server
- **Session storage**: ID tokens add ~1KB to session size

### Neutral

- **Backwards compatible**: Existing sessions without `idToken` still work
```

### Implementation Plan (optional)

For complex changes, break down the work into phases:

```markdown
## Implementation Plan

### Phase 1: Schema Changes

**Priority:** High
**Estimated Effort:** 1 hour

1. Update Drizzle schema with new tables
2. Generate and apply migration
3. Verify locally

### Phase 2: Dual-Write

**Priority:** High
**Estimated Effort:** 2 hours

1. Add writes to both old and new systems
2. Verify data consistency
```

### Alternatives Considered (optional)

Document options that were evaluated but not chosen:

```markdown
## Alternatives Considered

### 1. Make `id_token_hint` Optional

Instead of storing ID tokens, modify the auth server to accept logout
requests without the hint.

**Rejected because**: The `id_token_hint` provides additional security
by proving the client actually authenticated this user.

### 2. Backchannel Logout

Implement OIDC Backchannel Logout where the auth server notifies all
client apps when a user logs out.

**Rejected because**: This adds significant complexity and isn't
necessary for our use case.
```

### References (optional)

Link to relevant specifications, documentation, or related ADRs:

```markdown
## References

- [OIDC RP-Initiated Logout 1.0](https://openid.net/specs/openid-connect-rpinitiated-1_0.html)
- [RFC 6749 - OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc6749)
- [ADR-002: SSO Logout](./ADR-002-sso-logout-with-id-token-hint.md)
```

### Current Progress (optional)

For in-progress ADRs, track completion with checkboxes:

```markdown
## Current Progress

- [x] Phase 1: Schema Changes
  - [x] Update Drizzle schema
  - [x] Generate migration
  - [x] Apply locally
- [x] Phase 2: Dual-Write
- [ ] Phase 3: Switch Reads
- [ ] Phase 4: Stop Dual-Write
```

### Notes (optional)

Capture additional context, gotchas, or implementation details:

```markdown
## Notes

- All packages are `private: true` since they're workspace-only
- Use Bun's test runner for consistency with the monorepo
- The `@sdxc/hooks` package has peer dependencies on React and React Router
- SSL monitoring relies on manually entered expiry dates (Workers can't read TLS certs)
- Daily aggregation uses idempotent upserts - safe to run multiple times
```

## Template

```markdown
# ADR-{number}: {Title}

## Status

**{Status}** - {Date}

## Background

{1-2 paragraphs explaining what prompted this decision}

## Context

### Current State

{Describe the current architecture or approach}

### Issues Identified

{List specific problems or limitations}

| Issue | Impact |
| ----- | ------ |
| ...   | ...    |

## Decision

{Describe what was decided}

### Key Changes

{Break down the changes by component or phase}

#### Component/Phase 1

\`\`\`typescript
// Code example
\`\`\`

## Consequences

### Positive

- **Benefit 1** - Explanation
- **Benefit 2** - Explanation

### Negative

- **Drawback 1** - Explanation
- **Drawback 2** - Explanation

### Neutral

- **Trade-off 1** - Explanation

## Implementation Plan

### Phase 1: {Name}

**Priority:** {High/Medium/Low}
**Estimated Effort:** {Time estimate}

1. Step one
2. Step two

### Phase 2: {Name}

...

## Alternatives Considered

### 1. {Alternative Name}

{Description}

**Rejected because**: {Reason}

## References

- [Link text](URL)
- [Related ADR](./ADR-XXX-name.md)

## Current Progress

- [ ] Phase 1
- [ ] Phase 2

## Notes

- Note 1
- Note 2
```

## Writing Style

- Do not use emojis
- Use tables for structured data (issues, file changes, comparisons)
- Include code examples for API designs and implementations
- Use subsections liberally to organize long documents
- Keep background and context sections factual, not persuasive
- Write consequences objectively, including real drawbacks
- Update the "Current Progress" section as work completes
- Link to related ADRs when decisions build on each other
