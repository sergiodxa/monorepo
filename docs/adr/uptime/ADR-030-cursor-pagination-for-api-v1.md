# ADR-030: Every API v1 List Pages by Cursor

## Status

**Implemented** — 2026-09-05. Adopts [`@sdxc/pagination`](../../../packages/pagination),
designed in [the pagination-package ADR](../ADR-029-pagination-package.md), across `/api/v1`.

## Background

`/api/v1` paginated six endpoints and no others. Those six read `?limit=`/`?offset=` through
`parsePaginationQuery`, a twelve-line helper in `~/app/services/api-response`, and answered
with a `pagination: { limit, offset, hasMore }` object in the body. Four of the six accepted
only `limit`, so `offset` was parsed and discarded and there was no way to reach a second
page at all.

Every other list — monitors, DNS monitors, TCP monitors, flow monitors, alerts, cron jobs,
API keys, invites, status pages, maintenance windows, memberships, team domains, DNS records,
content checks — returned every row it found. A team with four hundred monitors received four
hundred monitors, and the response grew with the account.

The two halves failed differently. The unpaginated lists have no ceiling, so the largest
account decides the response size. The offset-paged ones walk `LIMIT n OFFSET m` over
`monitor_results`, where the offset deepens as the history grows and the rows skipped are
still read to be skipped.

`@sdxc/pagination` already existed, built for exactly this, and was used by nothing here.

## Decision

Every list in `/api/v1` pages by keyset, through `@sdxc/pagination`, reading `?perPage=` and
`?cursor=` and advertising the neighbouring pages in both the `Link` header and
`meta.pagination`. Twenty endpoints, up from six.

`parsePaginationQuery` is deleted. `?limit=`, `?offset=`, and the body's
`pagination: { limit, offset, hasMore }` are gone, with no aliases and no deprecation window.

### Keyset, not offset

Every one of these lists is append-only or nearly so, which is where a deepening offset costs
most and a cursor costs nothing: seeking `WHERE (created_at, id) < (?, ?)` reads the page and
stops, whatever page it is.

The package's own guidance is not to mix strategies across one API, and the reason is
client-visible: two endpoints that both say "paginated" would mean different things by it.
So the numbered pager the offset strategy offers is not available anywhere here, including on
the small collections where it would have been affordable. A client cannot jump to page 12.
That is the price of the consistency, and it is paid deliberately.

### One binding, one place

`~/app/services/pagination` holds the whole vocabulary: `PAGING`, a `createPaging()` factory
bound once at 50 rows per page and 200 at most; `newestFirst(column)`; and `apiPage()`.

Binding the parameter names once is what stops a route reading `?perPage=` while advertising
`?per_page=` in the `Link` it emits — the factory hands back both the parser and the header
writer with the same names already applied.

`newestFirst()` takes the timestamp column because the tables disagree about its name: most
stamp `created_at`, the TCP, DNS, and flow result tables stamp `checked_at`, and an alert
event stamps `sent_at`. Every one of them closes with `id`, which is a primary key on every
table the API pages, because a timestamp alone repeats or skips rows that share it — routine
when a minute's worth of checks lands together.

DNS records are the one list not ordered by time. They page alphabetically by name, type, and
value, which is the order the existing endpoint served and the order a zone is read in.

### `apiPage()`, so the header and the body cannot disagree

A paginated response says where the next page is twice: in `Link`, and in `meta.pagination`.
Building those separately in twenty handlers is twenty chances for them to drift.

`apiPage()` takes the payload and the one `KeysetPage` it came from, and derives both:

```ts
return apiPage({ results }, page.data, { url: ctx.url, perPage: params.data.perPage });
```

The controllers hold no `Link`-building code at all. A test asserts the two agree — that the
cursor in `meta.pagination.next` is the one embedded in the `Link` header — so a change that
separates them fails rather than ships.

### Totals on the collections, not on the histories

`meta.pagination.total` is present on the fourteen collections and absent on the six history
feeds.

A total is one `count()` on the query that was already composed, which works because
`remix/data-table` chaining returns new query values rather than mutating: the same query
both counts and pages, so every filter and every team predicate applies to both, and there is
no second predicate to keep in sync.

The split is a cost decision. D1 bills rows read, and a count reads every matching row to
return one number. On the collections that is tens of rows, bounded by a plan limit. On
`monitor_results` it is the whole retained history — seven days, so roughly ten thousand rows
for a one-minute monitor — read on every request, including for the polling client that never
looks at the number.

This does mean `meta.pagination` carries different fields on different endpoints, which is
the inconsistency the strategy choice above was careful to avoid. It is accepted here because
the alternative is a cost paid per request by clients that did not ask for it, and because
the direction is recoverable: adding `?withTotal=true` to the histories later is additive,
while removing an always-on total is not.

### Queries, not lists, in the model layer

`Pagination.byKeyset()` needs a composed query it can add its own ordering to, so each model
grew a `…Query` method returning `db.query(table).where(…)` with no `orderBy` and no `limit`.

These were **added alongside** the existing `listByTeam`/`listResults` methods rather than
replacing them. Those still have callers — dashboard controllers, digest emails, the notify
job — and rewriting them was not this change.

## Consequences

**Every existing integration breaks, and one way of breaking is silent.** A client sending
`?limit=` now gets the default page size instead of the size it asked for, and one reading
`body.pagination` finds nothing there. Those are visible. The quiet one is the ten
collections that previously returned everything: a client that iterates the array it receives
now iterates the first fifty rows and stops, with no error to notice.

**The keyset orderings are wire contracts now.** A cursor encodes the ordering it was minted
for and is refused when it does not match, so changing any `orderBy` in these handlers
invalidates every cursor already issued. Treat one like a schema change.

**Deep history is reachable again.** `GET /api/v1/monitors/:id/alert-events` and the DNS, TCP
and flow result endpoints accepted `limit` and ignored `offset`, so nothing past the first
page could be read at all. Following `next` now walks the whole retained history.

**`apiSuccess` grew a third argument** — `{ headers?, pagination? }` — which `apiPage()` is
the only caller to use with both. `meta.pagination` is omitted rather than sent as `null` on
the responses that are not pages, so nothing changed for the endpoints that are not lists.

## Notes

The audit behind this change compared every route in `routes/web.ts` against the reference
docs and found three endpoints that had never been documented at all:
`GET /api/v1/monitors/:monitorId/content-checks`,
`GET /api/v1/monitors/:monitorId/alert-events`, and `POST /api/v1/backfill-daily-stats`. The
first was also an unpaginated list, missed by the initial sweep because it neither used
`parsePaginationQuery` nor lived in a collection-index controller. All three are documented
now, and the content-checks list pages like every other.

The same audit found drift the docs carry independently of paging, left for its own change:
the non-list endpoints document bare payloads without the `data`/`meta` envelope, and
ISO-8601 strings where every timestamp column is an epoch-millisecond integer.
`DELETE /api/v1/team-domains` is documented as answering `{ "success": true }` and answers
`{ "deleted": true }`.
