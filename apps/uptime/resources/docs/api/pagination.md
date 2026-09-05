---
title: Pagination
description: Walk long lists with cursors. Follow the Link header to page through results reliably, without missing or repeating rows.
section:
  title: API Reference
  order: 4
order: 5
lastUpdated: 2026-09-05
---

Every endpoint that returns a list is paginated. A response carries one page of results, and both the `Link` header and the response's own `meta.pagination` say where the neighbouring pages are.

## Query Parameters

| Parameter | Type    | Required | Description                               |
| --------- | ------- | -------- | ----------------------------------------- |
| `perPage` | integer | No       | Results per page, 1-200 (default: 50)     |
| `cursor`  | string  | No       | Page to fetch, taken from a `Link` header |

A request without a `cursor` returns the first page.

A `perPage` outside 1-200 is refused with `400 BAD_REQUEST` rather than reduced to the nearest allowed value.

## Cursors in the Response Body

Every paginated response carries its cursors in `meta.pagination`, so a client that cannot read response headers can still page:

| Field                     | Type           | Description                                        |
| ------------------------- | -------------- | -------------------------------------------------- |
| `meta.pagination.next`    | string \| null | Cursor for the following page, `null` on the last  |
| `meta.pagination.prev`    | string \| null | Cursor for the preceding page, `null` on the first |
| `meta.pagination.perPage` | integer        | Results this page was built with                   |
| `meta.pagination.total`   | integer        | Rows matching, on the collections only             |

Send `next` back as `?cursor=` to advance. It is the same cursor the `Link` header carries, so pick whichever suits your client and stay with it.

## Following the Link Header

Responses include a [`Link`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Link) header holding the pages next to this one:

```
Link: <https://uptime.sergiodxa.com/api/v1/monitors/mon_abc123/results?perPage=50&cursor=eyJkIjoiYWZ0ZXIi>; rel="next",
      <https://uptime.sergiodxa.com/api/v1/monitors/mon_abc123/results?perPage=50&cursor=eyJkIjoiYmVmb3Jl>; rel="prev"
```

Request the `rel="next"` URL as it is given to you, and keep going until a response arrives without one — `meta.pagination.next` is `null` on that same page. That last page is the end of the list.

Every other query parameter you sent is preserved in these URLs, so filters survive paging.

## Walking a List

```bash
# The first page.
curl -i "https://uptime.sergiodxa.com/api/v1/monitors/mon_abc123/results?perPage=100" \
  -H "Authorization: Bearer uptime_your_api_key"

# The next page, using the URL from the response's Link header.
curl -i "https://uptime.sergiodxa.com/api/v1/monitors/mon_abc123/results?perPage=100&cursor=eyJkIjoiYWZ0ZXIi" \
  -H "Authorization: Bearer uptime_your_api_key"
```

The body holds the results themselves:

```json
{
	"data": {
		"results": [
			{
				"id": "8e03978e-40d5-43e8-bc93-6894a57f9324:29387451",
				"responseStatus": 200,
				"responseTimeMs": 245,
				"completedAt": 1771070400000,
				"createdAt": 1771070400000
			}
		]
	},
	"meta": {
		"requestId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
		"timestamp": "2026-02-14T12:00:00.000Z",
		"pagination": {
			"next": "eyJkIjoiYWZ0ZXIi",
			"prev": null,
			"perPage": 100
		}
	}
}
```

## Cursors

A cursor marks your position in a list. It is an opaque string: read it from a `Link` header and send it back unchanged. Its contents may change, so parsing one or building one yourself will break.

A cursor records the ordering it was issued for. One that has been edited, truncated, or taken from a list ordered differently is refused:

- **HTTP Status**: `400 Bad Request`
- **Error Code**: `BAD_REQUEST`

```json
{
	"error": {
		"code": "BAD_REQUEST",
		"message": "The cursor is not valid for this ordering"
	}
}
```

Cursors stay valid across requests, so you can store one and resume a walk later.

## Ordering

Lists are ordered newest first, so the first page holds the most recent results. DNS records are the exception: they read alphabetically by name.

Ordering is stable, so a cursor resumes exactly where the previous page stopped. Rows added while you are paging appear on the pages you have yet to fetch.

## Totals

A collection reports how many rows match, as `meta.pagination.total`:

```json
"pagination": {
	"next": "eyJkIjoiYWZ0ZXIi",
	"prev": null,
	"perPage": 50,
	"total": 128
}
```

These lists report a total: monitors, DNS records, alerts, cron jobs, maintenance windows, status pages, members, domains, invites, and API keys.

Check results and alert events do not. To size one of those, page to the end and count what arrives.

A total says how many rows there are, not where they are. Paging is still cursor by cursor, and there is no page number to jump to.

## Best Practices

1. **Follow `Link` rather than building URLs** - the next-page URL already carries your filters, your page size, and the cursor. Constructing one yourself is how pages get skipped.

2. **Treat cursors as opaque** - store and resend them verbatim. Do not decode, parse, or generate them.

3. **Ask for larger pages when you want the whole list** - `perPage=200` fetches an export in a quarter of the requests that the default does, against the same rate limit.

4. **Stop when there is no next cursor** - a missing `rel="next"`, or a `null` `meta.pagination.next`, is the end of the list. An empty page is not required to arrive first.

5. **Page from newest to oldest for histories** - results arrive newest first, so a job syncing recent checks can stop as soon as it reaches a result it already has.
