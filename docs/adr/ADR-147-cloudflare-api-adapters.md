# ADR-147: Cloudflare API Adapters

## Status

**Proposed** - 2026-10-15

## Background

Code in a Cloudflare app reaches D1, Queues and email sending through Workers bindings, objects
that exist only inside a Worker. `@sdxc/data-table-d1` takes a `D1Database`, `@sdxc/jobs/cloudflare`
takes a `Queue`, and `@sdxc/mail/cloudflare`'s `CloudflareTransport` takes a `SendEmailBinding`.
The same code is useful outside a Worker: an app's command line (ADR-145, section 8) running a
backfill against production, a script in CI, a Node service sharing a D1 database with a Worker.
Cloudflare exposes each of those services through its REST API as well. This ADR proposes
adapters that give code outside a Worker binding objects backed by that API.

## Context

### What Cloudflare's REST API covers

| Binding            | REST endpoint                                           | Status                    |
| ------------------ | ------------------------------------------------------- | ------------------------- |
| `D1Database`       | `/accounts/<account>/d1/database/<id>/query`            | general availability      |
| `Queue`            | `/accounts/<account>/queues/<id>/messages` (and batch)  | general availability      |
| `SendEmailBinding` | `/accounts/<account>/email/sending/send`                | public beta, Workers Paid |
| `KVNamespace`      | `/accounts/<account>/storage/kv/namespaces/<id>/values` | general availability      |
| `R2Bucket`         | R2's S3-compatible API                                  | general availability      |

Every call authenticates with an API token scoped to the account and the service. Durable Objects,
service bindings and the other bindings without a public API have no equivalent.

### Where the API differs from the binding

- **Email Service** answers delivery status per recipient over REST, where the binding answers one
  message id, and reports errors as numeric API codes where the binding throws string codes such as
  `E_SENDER_NOT_VERIFIED`.
- **D1**'s `batch()` runs its statements as one transaction inside a Worker; whether the REST API
  gives the same guarantee for several statements is not documented.
- **Queues** over REST accept JSON, text and bytes, so a message the binding would send as a
  structured-clone value has to be one of those.

## Decision

Add `packages/cloudflare-api`, published as `@sdxc/cloudflare-api`: the Workers binding interfaces
`@cloudflare/workers-types` declares, implemented over Cloudflare's REST API.

```typescript
import { d1, emailSender, queue } from "@sdxc/cloudflare-api";

let account = {
	accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
	token: process.env.CLOUDFLARE_API_TOKEN,
};

let db = new Database(createD1DatabaseAdapter(d1(account, { databaseId }))); // @sdxc/data-table-d1
let jobs = jobQueue(() => queue(account, { queueId })); // @sdxc/jobs/cloudflare's queue()
let mail = new CloudflareTransport(emailSender(account)); // @sdxc/mail/cloudflare
```

- **Each adapter is the binding's interface.** Code written against a binding takes the adapter
  with no change, and a failed call rejects as the binding's does, so callers handle errors the
  same way in and out of a Worker.
- **Differences are the adapter's documented contract.** Where the REST API answers less than the
  binding (Email Service's message id, D1's batch atomicity), the adapter's JSDoc and README say
  exactly what a caller receives, and the adapter never claims a guarantee the API does not give.
- **Configuration is explicit.** An adapter takes the account id, the token and the resource id
  as arguments; it reads no environment variable or configuration file of its own, so the app
  decides where they come from.
- **Platform-agnostic consumers stay that way.** Nothing outside a Cloudflare app depends on this
  package: `@sdxc/cli` and the middleware entries of ADR-146 take whatever service the app passes.
- **Order follows need.** `d1`, `queue` and `emailSender` first; `kv` and `r2` when code outside a
  Worker needs them.

## Consequences

### Positive

- **Binding code runs anywhere.** A model, a job enqueuer or a mailer written for a Worker runs
  from a command line, a script or a Node service against the same production resources.
- **No Worker in the path.** A call goes straight to Cloudflare's API, with no proxy Worker to
  deploy or keep running.

### Negative

- **A second implementation of each binding** to keep in step with Cloudflare's, over APIs some of
  which (Email Service) are still in beta.
- **Code outside a Worker holds an API token** with write access to the account's data; the app
  keeps it out of the repo and scopes it to the services it uses.
- **REST is slower than a binding,** one HTTPS round trip per call, which suits commands and
  scripts and not a request path.

### Neutral

- Local development needs no adapter: the local dev server's SQLite files, an in-memory queue and
  a printing mail transport stand in, and are the app's choice.

## Alternatives Considered

### 1. Wrangler's platform proxy for remote bindings

Wrangler can hand a Node process binding objects that proxy to their remote resources, covering
every binding type with one mechanism.

**Rejected because**: it ties every consumer to Wrangler and a proxy Worker it deploys, where the
repo runs Workers through its own `cf` CLI, and its behaviour is Wrangler's rather than a
documented API's. Revisit if code outside a Worker needs a binding with no REST API.

### 2. Cloudflare's official SDK

The `cloudflare` npm package wraps the whole REST API.

**Rejected because**: it answers the REST API's shapes, not the bindings' interfaces, so every
consumer written for a binding would need its own translation; an adapter would still sit on top
of it, and a thin `fetch` per endpoint is smaller than the SDK.

### 3. Run the `cf` CLI for each call

`cf` (ADR-100) is generated over the same REST API: `cf d1 query`, `cf queues messages push` and
`cf email-sending send` map one to one onto the endpoints above (`cf schema d1 query` prints
`POST /accounts/{account_id}/d1/database/{database_id}/query`), and it signs in through the
developer's own `cf auth login` profile, so no API token would need handling.

**Rejected because**: `cf` 1.0.0-beta.5's package entry exports only its command runner, with no
typed client, so an adapter would spawn a process per call; that costs about 0.6 s each, and a
data-table query is many calls. Its `--local` flag does not cover `d1 query` ("This command has
no local equivalent"). Revisit when `cf` exposes a programmatic client, or a way to read the
signed-in profile's credentials, which would let the adapters skip API tokens.

## Implementation Plan

### Phase 1: D1

1. A spike against a real database: statements, `batch()`, errors and their shapes.
2. `d1`, its tests against MSW-mocked responses recorded from the spike, README, `LICENSE.md`,
   root README row and docs-site group; bootstrap on npm with its trusted publisher.

### Phase 2: Queues and email

1. `queue` with `send` and `sendBatch`.
2. `emailSender`, typed with the Email Service's response.

### Phase 3: Storage, when needed

1. `kv`, then `r2` over the S3-compatible API.

## References

- [ADR-145: `@sdxc/cli` Package](./ADR-145-cli-package.md)
- [ADR-146: Command-Line Entry Points for Middleware Packages](./ADR-146-cli-middleware-entry-points.md)
- [Cloudflare Queues: publish via HTTP](https://developers.cloudflare.com/queues/examples/publish-to-a-queue-via-http/)
- [Cloudflare Queues messages API](https://developers.cloudflare.com/api/resources/queues/subresources/messages/)
- [Cloudflare Email Service REST API](https://developers.cloudflare.com/email-service/api/send-emails/rest-api/)

## Current Progress

- [ ] Phase 1: D1
- [ ] Phase 2: Queues and email
- [ ] Phase 3: Storage, when needed
