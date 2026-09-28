# ADR-097: Ask — A Hosted AMA Platform

## Status

**Proposed** - 2026-09-28

## Background

While designing a demo app for the jam.remix.run talk, one candidate was a public question
board: an audience asks, the owner answers, and everything the board needs — a public form,
a captcha, a rate limit, markdown answers, an email when a question is answered, and an MCP
surface an agent can read — falls out of the shape rather than being bolted on to justify a
package.

That candidate lost to a job board for the talk, because a demo must not depend on audience
participation. The idea is worth keeping on its own terms: it is a small product whose
requirements happen to exercise most of this repository's packages, and there is no obvious
hosted version of it that treats the answers as a durable, addressable, machine-readable
archive rather than as a stream.

This ADR records the shape it would take at `ask.sergiodxa.com` and parks the questions that
have to be answered before any of it is built.

## Context

### What it is

A hosted AMA. Anyone creates a board, publishes its URL, and collects questions. The owner
answers in Markdown. Every board is public by default and indexable, and every board exposes
the same MCP surface its owner does.

The single-tenant version is small enough to be uninteresting. The reason to write an ADR is
that it is multi-tenant: each owner gets their own board, isolated from every other.

### What already exists

The platform half is not new work. This repository has built it twice, in `apps/auth-saas`
and `apps/blog-saas`:

| Piece                                     | Prior art                          |
| ----------------------------------------- | ---------------------------------- |
| Tenant Durable Object, one per customer   | `apps/blog-saas`, `apps/auth-saas` |
| Control-plane D1 for accounts and tenants | `apps/blog-saas`                   |
| Custom hostnames over Cloudflare for SaaS | `@sdxc/hostname`                   |
| Per-tenant SQL inside the Durable Object  | `@sdxc/data-table-sqlstorage`      |
| Billing behind a vendor-neutral contract  | `@sdxc/billing`                    |

The product half is also mostly assembled: `@sdxc/captcha`, `@sdxc/rate-limit`,
`@sdxc/get-client-ip`, `@sdxc/markdown`, `@sdxc/mail`, `@sdxc/jobs`, `@sdxc/i18n`,
`@sdxc/mcp`, `@sdxc/logger`, `@sdxc/seo`, `@sdxc/sitemap`.

What is genuinely new is the domain model — a board, a question, an answer — and the
decisions parked below.

### Why a Durable Object per board

A board is a natural consistency boundary. Its questions are read constantly and written
rarely, the write path has to be ordered (a question is answered once), and no query ever
spans two boards. That produces an isolation guarantee worth having: one tenant's data
cannot leak into another's, because it is not in the same database.

## Decision

Build `ask.sergiodxa.com` as a single application, `apps/ask`, holding:

1. **The board application itself** — public page, owner console, schema, migrations. It
   reaches a database only through `remix/data-table`'s `Database` contract, so the same
   code runs against Durable Object SQL in production and against SQLite in a test.
2. **The tenant Durable Object**, one per board, holding that board's questions and answers
   in its own SQL storage.
3. **The control plane** — a D1 database with accounts, boards and domains, plus the owner
   dashboard and custom hostnames through `@sdxc/hostname`.

The board code lives in the app. It is not extracted into a package, and nothing here should
be read as a step toward one.

A board resolves by hostname: a custom domain carries the board id in `cf.hostMetadata`, and
the default `{slug}.ask.sergiodxa.com` subdomain resolves the slug through a KV cache with a
D1 fallback.

### MCP is not an add-on

Every board publishes `/mcp` on its own hostname, with a tool to search its questions and a
resource per answer. This is the differentiator, not a feature: an AMA is a body of
questions someone already answered, which is exactly the shape an agent wants to read. It
follows that the MCP surface is mapped onto the same router as every other route, rather
than standing up a service of its own.

## Open Questions

These are the reason this ADR is Proposed rather than Accepted. None of them are settled.

### 1. Does it charge, and for what?

A board costs almost nothing to run until it is popular, so per-seat pricing fits badly. The
candidate axes are custom domain, board count, question volume, and history retention. No
decision.

### 2. Is this the first app with ads?

Boards are public and their traffic is organic search, which is the one traffic shape where
ads are not absurd. Nothing in this repository has ever carried an ad, so this would be a
first — and it would be the first time a reader of a page is not the customer, which is a
product decision before it is a technical one. `@sdxc/flags` would gate the experiment.

Deciding this shapes the schema: an ad slot per board, per question, or none at all, is not
a change that is cheap to make later.

### 3. Who moderates, and with what?

A public, anonymous form on someone else's domain invites more than spam. A captcha and a
rate limit stop volume, not content. Options are owner-only moderation with questions held
until approved, publish-then-remove, or a classifier in a background job. This is the
question most likely to sink the product if it is answered late.

### 4. Are askers anonymous, and can they be notified?

The two pull against each other. An anonymous question needs no account and gets more
submissions; a question that emails you when it is answered needs an address. An optional
address is the obvious compromise and it doubles the schema's privacy surface, since it
means storing contact details for people who never created an account.

### 5. What is the retention contract?

Answers are the archive and should be permanent. Unanswered questions are not obviously
worth keeping forever, and anonymous submissions with an email attached carry an erasure
obligation. The retention policy belongs in the schema before there are users, not after.

## Consequences

### Positive

- The platform half is a third application of a pattern this repository has already shipped
  twice, so the risk sits in the product, not the architecture.
- Per-board isolation is structural rather than enforced by a query filter.
- It exercises the same packages the talk is about, on a real product, which keeps them
  honest.

### Negative

- A fourth deployed multi-tenant platform is a fourth control plane to operate, and none of
  the existing three share one.
- Public user-submitted content is an ongoing moderation obligation, unlike every other app
  in this repository, all of which hold only their owner's data.
- Ads, if chosen, introduce a revenue model with no prior art here and a reader whose
  interests differ from the customer's.

## Alternatives Considered

**A single shared database with a `board_id` column.** Simpler to query across boards and
cheaper per board. **Rejected because** isolation becomes a predicate every query has to
remember, and the one query that forgets it is a cross-tenant leak — the failure a Durable
Object per board makes structurally impossible.

**Single-tenant only, just for sergiodxa.com.** Far less work, and it would still produce
the archive and the MCP surface. **Rejected because** the interesting half is that other
people get one, and retrofitting tenancy into an application that assumed one owner is the
expensive direction to discover late.

**Folding it into `apps/blog-saas` as a blog feature.** A Q&A is close to a comment thread.
**Rejected because** the domain model differs where it matters — a question has one answer
and an answered state, and the board's value is the archive rather than the post it hangs
off.

## References

- [ADR-006](./ADR-006-auth-saas-platform.md) — the first multi-tenant platform here
- [ADR-009](./ADR-009-blog-saas-platform.md) — the tenant Durable Object and control plane
  shape this follows
