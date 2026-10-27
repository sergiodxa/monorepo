# ADR-179: x402 for Agent Payments Across the Monorepo

## Status

**Proposed** - 2026-10-27

## Background

[x402](https://x402.org/) is an open payment standard that activates HTTP `402 Payment
Required` so a client — usually an AI agent — can pay for a resource in the same HTTP
exchange, with no account, API key or hosted checkout. Stablecoin settlement (often via a
facilitator) replaces signup. The Linux Foundation hosts the x402 Foundation; the protocol
is Apache-2.0 and already has TypeScript, Go and Python SDKs for Express, Hono, Next,
Fastify and others — not for Remix v3.

This monorepo already sells to humans through `@sdxc/billing` (Polar today) and already
exposes agent surfaces: the blog and `sdxc.dev` ship free public MCP endpoints, reader
gates MCP behind a paid Polar plan and a minted token, and uptime's API is API-key +
subscription. The question is how x402 fits technically, and what is actually worth
charging for without paywalling people who read HTML, follow feeds or lightly ask an agent
to look something up.

## Context

### What x402 does

1. Client requests a resource.
2. Server answers `402` with a Base64 `PAYMENT-REQUIRED` header (schemes, networks, price,
   destination).
3. Client signs a payment payload and retries with `PAYMENT-SIGNATURE`.
4. Server verifies and settles (locally or through a facilitator's `/verify` and
   `/settle`) and returns the resource with `PAYMENT-RESPONSE`.

Schemes include `exact` (fixed price), `upto` (cap then charge usage) and
`batch-settlement` (escrow + off-chain vouchers for high-volume calls). MCP tools can
advertise themselves in the x402 Bazaar so agents discover paid endpoints.

### What this monorepo already has

| Surface                | How agents reach it today                                                                                                            | How humans pay today                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| Blog (`sergiodxa.com`) | Free `POST /mcp` (`search_posts`, `list_posts`, `get_post`, glossary, bookmarks); every page has a `.md` twin; 60 req/min            | Free (Sponsors optional)               |
| sdxc-site (`sdxc.dev`) | Free `POST /mcp` (`search_docs`, `search_packages`, `list_packages`, `get_package`); guides and package READMEs as resources / `.md` | Free (Sponsors optional)               |
| Reader                 | `POST /mcp` behind a minted token; paid Polar plan                                                                                   | Polar Free / Paid / Premium            |
| Uptime                 | REST API v1 with API keys; entitlement from Polar; ad-hoc `POST /api/v1/ping` already answers `402` when unsubscribed (ADR-021)      | Polar `$5` + metered pings / flow runs |
| Books                  | No MCP; sample chapter behind email; checkout via Polar                                                                              | Polar one-shot                         |
| auth-saas / r3-auth    | OAuth / OIDC for people and apps                                                                                                     | Polar per tenant where applicable      |
| `@sdxc/*` packages     | npm install; docs on `sdxc.dev`                                                                                                      | Free (OSS)                             |

Human billing is accountful, recurring or checkout-shaped. Agent traffic is increasingly
MCP-shaped and wants to pay per call without signing up for Polar.

### Constraints that must hold

1. **People never hit a paywall on HTML, feeds, ActivityPub, EPUB or ordinary `.md`
   negotiation.** A browser reader is free even if an agent somewhere is paying.
2. **Light personal agent use of public writing stays free.** Charging Claude for
   `get_post` on a public tutorial would tax the person using the agent. Discovery tools
   (`search_*`, `list_*`) stay free everywhere they already are.
3. **x402 does not replace `@sdxc/billing`.** Polar keeps subscriptions, entitlements,
   portals and human checkout. x402 is a second rail for machine micropayments.
4. **Wallet payment is not identity.** A paid 402 proves funds moved; it does not prove
   who may read another person's private data. Reader MCP, uptime team APIs and any
   per-user store stay behind tokens / API keys / entitlements. x402 may _buy access_ or
   _buy a one-shot action_; it does not substitute authorization.
5. **Official `@x402/*` packages are the chain/protocol layer.** This repo wraps them for
   Remix v3, `@sdxc/result`, facilitators and MCP — it does not reimplement settlement.

## Decision

### 1. Channel policy

Every app that accepts x402 declares which channels are free and which may charge:

| Channel                                                                                                         | Policy                   |
| --------------------------------------------------------------------------------------------------------------- | ------------------------ |
| HTML document responses                                                                                         | Always free              |
| RSS / Atom / JSON Feed / ActivityPub / sitemap / robots                                                         | Always free              |
| `Accept: text/markdown` and `*.md` twins of public pages                                                        | Always free              |
| MCP `tools/list` and `resources/list`                                                                           | Always free (discovery)  |
| MCP `search_*` / `list_*` on already-public corpora                                                             | Free, rate-limited       |
| MCP `tools/call` / `resources/read` that perform **compute**, return a **premium pack**, or exceed a free quota | May answer `402`         |
| JSON/REST actions that are one-shot and accountless (probe, render, encode)                                     | May answer `402`         |
| Continuous / stateful products (monitors, feed subscriptions, tenant auth)                                      | Stay on Polar + identity |

Detection is by **route and product**, never by User-Agent sniffing. An agent that fetches
`/articles/foo` as HTML pays nothing; the same agent that calls a paid MCP tool may pay.

### 2. Package: `@sdxc/x402`

A new package owns the Remix-facing seller surface. Chain schemes and facilitator HTTP stay
in the upstream `@x402/*` dependencies (or thin adapters), wrapped so every failure is a
`Result` and every network call goes through `@sdxc/outbound` where applicable.

```typescript
/** Sketch — exact exports land with the package. */
import { paymentRequired, settleOrChallenge, x402 } from "@sdxc/x402/middleware";
import { HTTPFacilitatorClient } from "@x402/core/server";

let facilitator = new HTTPFacilitatorClient({ url: "https://x402.org/facilitator" });

/** Publishes a configured seller on `ctx.x402`. */
router.use(x402({ facilitator, payTo: { evm: RECEIVE_ADDRESS } }));

/** Route or MCP guard: free request continues; unpaid paid-route answers 402. */
router.map(routes.probe, {
	middleware: [
		paymentRequired({
			price: "$0.01",
			description: "One HTTP probe from a chosen region",
			accepts: [/* exact on Base USDC, … */],
		}),
	],
	handler: probe,
});
```

Responsibilities of `@sdxc/x402`:

- Build and parse V2 headers (`PAYMENT-REQUIRED`, `PAYMENT-SIGNATURE`, `PAYMENT-RESPONSE`).
- Remix middleware that publishes `ctx.x402` (receipt, payer, amount, network) after a
  successful settle, the same way `@sdxc/billing/middleware` publishes `ctx.billing`.
- A `paymentRequired({ … })` guard usable on HTTP routes and as MCP tool middleware.
- Facilitator client with timeouts, logging via `currentLog()`, and idempotency hooks
  (payment-identifier extension when we need safe retries).
- Test helpers: an in-memory facilitator double and fixtures that mint valid/invalid
  payloads without a chain (Workers tests still use real bindings elsewhere; this double is
  for the HTTP header contract only).

Buyer helpers (`wrapFetchWithPayment`) live under `@sdxc/x402/client` only if an app in
this repo becomes a paying client of someone else's x402 API. Seller ships first.

### 3. MCP integration

`@sdxc/mcp` stays protocol-shaped. Payment is a guard in front of a tool or resource
handler, not a fork of the MCP stack:

```typescript
mcp.tools.map(
	toolset.assembleBriefing,
	lazy(() => import("./tools/assemble-briefing.js")),
	[paymentRequired({ price: "$0.05", description: "Assemble a cited briefing" })],
);
```

On an unpaid `tools/call`, the Worker answers HTTP `402` with `PAYMENT-REQUIRED` (so an
x402-aware MCP client can pay and retry) rather than an MCP `ToolError` that hides the
payment challenge. Free tools on the same server keep answering `200`. Bazaar discovery
metadata is optional per paid tool once a facilitator we use indexes it.

### 4. Relationship to Polar

| Concern                                       | Rail                            |
| --------------------------------------------- | ------------------------------- |
| Monthly subscription, portal, invoices, tax   | `@sdxc/billing` → Polar         |
| Entitlement projection in D1 / Durable Object | Existing sync jobs              |
| One-shot agent call, no account               | x402                            |
| Human buys a book / plan in a browser         | Polar checkout                  |
| Agent buys the same book's Markdown once      | x402 (optional second SKU)      |
| Ad-hoc uptime ping for a subscribed team      | API key + Polar meter (ADR-021) |
| Ad-hoc uptime ping for an anonymous agent     | x402 (new SKU, no team row)     |

Optional later: record settled x402 payments as Polar orders or an internal ledger for
accounting. That is a reporting concern, not a prerequisite for accepting payment.

### 5. What is chargeable (product map)

Charge for **outcomes agents cannot get as cheaply from free HTML**, not for locking the
public web. Prefer: compute, assembly, freshness, volume, and accountless one-shots.

#### A. Value kinds (independent of app)

| Kind                               | Why an agent pays                                              | Examples                                                                                                                |
| ---------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Assembly**                       | One structured answer instead of N fetches + its own synthesis | "Brief me on Remix v3 routing from my posts + sdxc guides, with citations"                                              |
| **Compute**                        | The server did work the model cannot (or should not) redo      | Probe a URL from `wnam`, render Markdown→PDF, encode a QR, build an EPUB, highlight a large file, run a zone-file parse |
| **Freshness**                      | Training data and crawls lag                                   | "What did `@sdxc/*` release this week?", live catalogue diff since a date, uptime check _right now_                     |
| **Bulk / dump**                    | Rate limits make scraping painful; a pack is one payment       | Whole topic as one Markdown/JSON document; full `@sdxc/u`+`@sdxc/ui` catalogue export                                   |
| **Premium corpus**                 | Content written for agents that is not the free blog HTML      | Checklists, migration runbooks, executable recipes, book full text                                                      |
| **Day pass / quota top-up**        | Personal use free; commercial scrapers pay                     | Raise MCP rate from 60/min after a small payment; 24h elevated quota                                                    |
| **Guest access to a paid product** | Try without Polar signup                                       | One reader-search over _public_ feeds; one uptime probe; one book chapter set                                           |

#### B. By app

**Blog (`sergiodxa.com`)** — keep the public corpus free on HTML, feeds, `.md` and light
MCP. Charge only for new agent-facing work:

| Offer                  | Shape                | Notes                                                                               |
| ---------------------- | -------------------- | ----------------------------------------------------------------------------------- |
| `assemble_briefing`    | Paid MCP tool        | Input: topic / query; output: Markdown briefing with permalinks into free posts     |
| Topic pack             | Paid MCP resource    | e.g. every tutorial matching `tag:remix@3` as one document, regenerated on publish  |
| Weekly releases corpus | Paid or metered tool | Structured JSON of what shipped (already a post kind); agents want the machine form |
| Elevated MCP quota     | x402 day pass        | Free tier stays enough for a conversation                                           |

Do **not** put x402 on `get_post` for public articles/tutorials while those remain free at
`/articles/:slug` and `/articles/:slug.md` — agents would pay to avoid a free URL, or
bypass payment by fetching HTML. If a post is ever premium, publish it only on the paid
MCP/resource channel (no free HTML twin), and say so in the ADR that introduces it.

**sdxc-site (`sdxc.dev`)** — guides and package READMEs stay free (they _are_ the product
funnel for npm). Charge for agent convenience on top:

| Offer                | Shape         | Notes                                                                                                                                                  |
| -------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `recommend_packages` | Paid tool     | Natural-language need → ranked packages + install lines + guide links (search is free; recommendation/ranking is the product)                          |
| `upgrade_plan`       | Paid tool     | Agent sends `package.json` / lockfile excerpt; answer is which `@sdxc/*` moved and which guides/ADRs apply (pairs with `sdxc upgrade` / release notes) |
| Catalogue dump       | Paid resource | Full `@sdxc/u` / `@sdxc/ui` machine index as one JSON blob for design-system agents                                                                    |
| Recipe assembly      | Paid tool     | "Build an AI-facing app" as one ordered checklist pulled from the recipe + linked guides                                                               |

**Uptime** — Polar remains the product for continuous monitoring. x402 fits the
monitor-less one-shot ADR-021 already described, without a team:

| Offer                  | Shape                 | Notes                                                         |
| ---------------------- | --------------------- | ------------------------------------------------------------- |
| Anonymous `probe`      | Paid HTTP or MCP tool | URL + optional region; no monitor row; price ≈ infra + margin |
| Multi-region matrix    | Paid tool             | Same URL from N regions in one call (`upto` or `exact` × N)   |
| Public status snapshot | Keep free             | Status pages stay human-readable and free                     |

Subscribed teams keep using API keys and Polar meters. x402 is the guest / CI / agent lane
that should not require creating a team.

**Reader** — private queues stay token + Polar. x402 only for accountless public-adjacent
work, if any:

| Offer                                   | Shape          | Notes                                                                                            |
| --------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------ |
| Public-feed fetch+normalize             | Paid tool      | Agent pays to pull and normalize _one URL it supplies_; no access to another reader's DO         |
| Day pass for a reader's own agent token | Possible later | Still requires proving control of the account (SIWX or existing login); x402 alone is not enough |

**Books** — Polar checkout stays for humans. x402 is a second SKU for agents:

| Offer                        | Shape         | Notes                                                                         |
| ---------------------------- | ------------- | ----------------------------------------------------------------------------- |
| Full book as Markdown / EPUB | Paid resource | Sample stays free (email or free MCP excerpt); full text is the paid artifact |
| `quote` / `search_book`      | Metered tools | After purchase or per-call over the paid corpus                               |

**Package-backed micro-APIs** (strongest long-term fit) — many `@sdxc/*` packages are pure
functions agents repeatedly need. Hosting them as Workers with x402 turns the library into
a pay-per-call service without putting the npm package behind a paywall:

| Package capability                                        | Hosted action an agent pays for                           |
| --------------------------------------------------------- | --------------------------------------------------------- |
| `@sdxc/markdown`                                          | Parse / render / lint a Markdown document                 |
| `@sdxc/highlight`                                         | Tokenize a large source blob                              |
| `@sdxc/qr`                                                | Encode text/bytes to SVG/PNG                              |
| `@sdxc/pdf` / `@sdxc/epub` / `@sdxc/zip`                  | Build a file and return bytes                             |
| `@sdxc/zone-file`                                         | Parse/serialize DNS zone text                             |
| `@sdxc/feed` / `@sdxc/rss` / `@sdxc/atom`                 | Normalize a feed URL the agent supplies                   |
| `@sdxc/html`                                              | Extract title/description/main from a URL (outbound-safe) |
| `@sdxc/openapi`                                           | Validate a request against a supplied OpenAPI doc         |
| `@sdxc/semver` / `@sdxc/json-patch` / `@sdxc/merge-patch` | Transform payloads at volume                              |

OSS packages on npm stay free. The _hosted execution_ is what costs money (CPU, egress,
outbound fetches). That matches "do not block users" and still monetizes agent demand.

**auth-saas / r3-auth** — weak x402 fit for core auth. Possible edge: paid rate-limit
relief on public token endpoints for known payers; not a first target.

#### C. What not to charge for

- Anything a person reads in a browser on a URL that is public today.
- MCP discovery (`tools/list`, `resources/list`, search/list over public corpora).
- Sponsors / Polar entitlements that already unlock a feature for a logged-in human —
  do not double-charge the same feature via x402 for that human's session.
- Another user's private data, ever, merely because a wallet paid.

### 6. Security and operations

- Receive addresses and facilitator URLs are Worker secrets / config, declared with
  `bindings.secret()` where needed.
- Log settlement summaries through `currentLog()` (`x402.settled`, amount, network,
  tool/route name) — never log raw payment payloads or private keys.
- Idempotency: prefer the payment-identifier extension for paid MCP tools that are unsafe
  to double-fulfill.
- Free-tier abuse stays on `@sdxc/rate-limit` (and Web Bot Auth keys where we have them);
  x402 is for payment, not for replacing rate limits.
- Testnet facilitator first; mainnet only with a documented receive wallet and a runbook.

## Consequences

### Positive

- Agents can pay without Polar accounts; humans keep the existing billing UX.
- One Remix middleware pattern reusable on blog, sdxc-site, uptime, books and future
  micro-APIs.
- Monetization aligns with work we already do (MCP, probes, packages, releases) without
  inventing a paywalled blog.
- Clear rule for reviewers: free channel vs paid channel is a route/product decision.

### Negative

- New dependency surface (`@x402/*`, facilitator availability, chain/USDC ops).
- Two billing rails to reason about (Polar vs x402) and eventually to reconcile in
  accounting.
- MCP clients must be x402-aware (or sit behind a paying bridge) to use paid tools;
  unpaid clients still see free tools.
- Price and network choices will need iteration; wrong prices either earn nothing or
  chase agents off.

### Neutral

- Public HTML and feeds unchanged.
- Existing Polar subscriptions and reader/uptime entitlements unchanged.
- Content of the first paid SKU is deliberately undecided here; this ADR fixes _how_
  charging works and _what kinds_ of offers fit. A follow-up ADR or issue picks the first
  SKU to ship.

## Implementation Plan

### Phase 0: Package skeleton

1. Add `@sdxc/x402` with header codecs, facilitator client, Remix `x402()` +
   `paymentRequired()` middleware, Result-typed errors, and Vitest coverage of the HTTP
   header contract against a fake facilitator.
2. Document seller usage; add the package to the sdxc-site catalogue group when it
   publishes.

### Phase 1: First paid SKU (pick one)

Ship exactly one paid offer end-to-end (402 → pay → settle → body) on testnet, then
mainnet. Preferred candidates, in order of learning value:

1. **Uptime anonymous probe** — clearest "compute + infra cost", already conceptually
   priced, no content-pack debate.
2. **Blog `assemble_briefing`** — exercises MCP + payment without locking posts.
3. **Books full-text resource** — exercises digital-goods x402 beside Polar.

### Phase 2: Expand by demand

Add Bazaar metadata, day-pass quotas, and package micro-APIs only after Phase 1 has real
agent traffic and settlement logs.

## Alternatives Considered

### 1. Put x402 on all MCP `get_*` full-body tools

**Rejected** while the same bodies remain free as HTML/`.md`. Agents bypass payment or
people using agents get taxed. Paid full-body only when there is no free twin.

### 2. Replace Polar with x402 for uptime/reader

**Rejected.** Continuous monitoring and personal feed stores need identity, entitlements
and refunds/chargebacks humans expect. x402 is complementary.

### 3. Charge by sniffing bots / blocking scrapers

**Rejected.** Fragile, blocks legitimate agent users inconsistently, and fights the
goal of selling to agents. Rate limits stay; payment is opt-in for premium lanes.

### 4. Only wrap upstream `@x402/express` (or similar) without a package

**Rejected.** Apps here are Remix v3 on Workers. A thin `@sdxc/x402` keeps Result,
logging, middleware context and MCP guards consistent with `@sdxc/privacy-pass` and
`@sdxc/billing`.

### 5. Build a custom crypto checkout unrelated to x402

**Rejected.** x402 is becoming the agent-native rail (Foundation, facilitators, MCP
guides). Inventing a parallel header protocol forfeits client support.

## References

- [x402.org](https://x402.org/)
- [x402 documentation](https://docs.x402.org/)
- [MCP server with x402](https://docs.x402.org/guides/mcp-server-with-x402)
- [ADR-021: Ad-hoc ping API and ping metering](./uptime/ADR-021-ad-hoc-ping-api-and-ping-metering.md)
- Blog MCP: `apps/blog/app/mcp/`, `https://sergiodxa.com/mcp`
- sdxc-site MCP: `apps/sdxc-site/app/mcp/`, `https://sdxc.dev/mcp`
- Guide: [Build an app agents can use](https://sdxc.dev/docs/recipes/ai-facing-app)
- Guide: [Expose your app over MCP](https://sdxc.dev/docs/operations-and-testing/mcp-server)
- `@sdxc/billing`, `@sdxc/mcp`, `@sdxc/privacy-pass` (middleware precedents)
