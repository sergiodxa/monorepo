---
title: Parcelo
headline: An API reference where every endpoint page reads the same way, and one request becomes three languages
summary: An HTTP API reference for an invented shipping-label API, with one page per endpoint and examples in cURL, JavaScript and Python.
tagline: An API reference in three languages
accent: "oklch(0.52 0.2 275)"
cover: create
shots:
  - id: create
    page: "shipments/create"
    alt: The Create a shipment page, with the sidebar of resources, the page header and the request parameters.
  - id: method
    page: "shipments/create"
    highlight: "[data-slot='typeset'] > p[data-not-typeset]"
    alt: A POST method pill beside the path /v1/shipments.
  - id: request
    page: "shipments/create"
    highlight: "[data-slot='props-table']"
    alt: The body parameters table, with from, to, parcel, purchase and metadata, each object's fields behind a Show child fields disclosure.
  - id: languages
    page: "shipments/create"
    click: "#example-request ~ form[data-slot='code-tabs'] [data-slot='code-tabs-list'] label:nth-child(3)"
    highlight: "#example-request ~ form[data-slot='code-tabs']"
    alt: The example request switched to its Python tab, a requests call with the JSON body written as a Python dict.
  - id: errors
    page: "shipments/create"
    highlight: "#errors + table"
    alt: The errors table for creating a shipment, with status, code and when each happens.
  - id: object
    page: "shipments/object"
    highlight: "[data-slot='props-table']"
    alt: The fields of the shipment object, from id and status to label_url and tracker_id, with from, to, parcel and rate behind disclosures.
  - id: signature
    page: "webhooks/events"
    highlight: "#verify-the-signature ~ figure[data-slot='code-block']"
    alt: A handler that checks the Parcelo-Signature HMAC against the raw body before parsing the event.
  - id: phone
    page: "shipments/create"
    viewport: phone
    alt: The Create a shipment page on a phone, with the method pill and path, and the parameters table restacked so each field is a block of name, type and required.
---

Parcelo is an invented HTTP API that quotes parcels, buys shipping labels and tracks them, and this is its API reference: three introduction pages (authentication, errors and pagination), the shipment object, endpoints to create, retrieve and list shipments, a tracker endpoint and the webhook events. The API, its test keys and its carriers are made up. The reference is a working site built from the `@sdxc/ui` docs kit, with search, a Markdown twin of every page and a feedback form.

Reference docs are a different job from prose docs. A reader arrives with a question about one field or one status code, often mid-integration, and needs every endpoint page to answer in the same place. Parcelo is worth reading for how it gets that consistency: each endpoint page is assembled from a handful of shared pieces in `parcelo/endpoint.tsx`, so the method line, the example request and the errors table cannot drift between pages.

It is set in a crisp, technical register: cool slate neutrals, one indigo accent, Inter for the body, coloured method pills over monospace paths.

## The brief

An API reference has to get a few things exactly right. Every endpoint shows its method and path before anything else. Parameters show their type, whether they are required, and the shape of nested objects. Examples come in the reader's language and paste as they are. Errors are listed per endpoint, not only on a global page. Webhooks explain how to prove a post is genuine. And the conventions every endpoint shares (authentication, the error object, pagination) are written once and linked.

Parcelo's tree follows that, with each endpoint's method drawn as a badge beside its name in the sidebar: an Introduction section first, then Shipments (the object and its endpoints), then Tracking, then Webhooks. The hub's start cards send a reader to a test key and a first request, to quoting and buying a label in one call, and to webhook events. Each endpoint page has the same five headings: Request, Example request, Response, Errors and next steps.

## One shape for every endpoint

An endpoint page opens with its header, then the `Endpoint` line: the HTTP method as a coloured pill and the path in the monospace face. Each method's colour is read from the theme, so the pill holds its contrast in light and dark. The path breaks at any character, so a long path wraps on a phone without pushing the page sideways.

![A POST method pill beside the path](/showcase/parcelo/method.webp "The method and path come first on every endpoint page, the method as a coloured pill.")

Request parameters follow as a [PropsTable](/api/ui/props-table) through the shared `Fields` block. On "Create a shipment" the body parameters are `from`, `to`, `parcel`, `purchase` and `metadata`; each object keeps its own fields behind a "Show child fields" disclosure, and required fields are flagged in their own column. The prose above it states the one rule a reader needs before sending: addresses are verified before any rate is quoted.

![The body parameters table](/showcase/parcelo/request.webp "Each object's fields wait behind a disclosure, so the top-level request reads in five rows.")

At the foot of each endpoint, an errors table lists the status, the error code and when it happens for that endpoint alone. Creating a shipment can answer `address_unverified` or `parcel_too_heavy` with 400, `balance_insufficient` with 402, and `carrier_unavailable` with 502.

![The errors table for creating a shipment](/showcase/parcelo/errors.webp "Each endpoint lists its own errors, with the code a client branches on.")

## One request, three languages

The example request is a `RequestExample` that takes the method, the path and the body once and writes it three ways: a cURL command, a `fetch` call and a Python `requests` call. The Python version rewrites JSON literals (`true`, `false`, `null`) as Python's, so it pastes into a script as is. Every example uses a test key, which the authentication page says outright, so a reader can run them unchanged.

```tsx
<LanguageTabs
	syncKey="parcelo-language"
	aria-label="Language"
	tabs={[
		{ label: "cURL", value: "curl", language: "sh", title: "Terminal", code: curl },
		{ label: "JavaScript", value: "javascript", language: "js", code: javascript },
		{ label: "Python", value: "python", language: "py", code: python },
	]}
/>
```

The three versions sit in [CodeTabs](/api/ui/code-tabs) that share the sync key `parcelo-language` with local persistence. Before script loads, the tabs are radio inputs and switch with CSS. Once it has loaded, choosing Python switches every example on the page and the browser remembers the choice for the rest of the reference, so a reader who picks Python once reads every endpoint in Python.

![The example request in Python](/showcase/parcelo/languages.webp "One request object, written three ways, with the reader's language remembered across endpoints.")

Because the snippets are generated from the same body object, the cURL, JavaScript and Python versions of an endpoint always send the same request.

## Objects as nested fields

"The shipment object" page lists every field of a shipment in one [PropsTable](/api/ui/props-table), with the two addresses, the parcel and the rate each opening into child rows, then a full JSON example, then a Lifecycle section: a shipment starts `created` when quoted, becomes `purchased` when a rate is bought, follows the carrier through `in_transit` to `delivered`, and ends `voided` when a label is voided within 24 hours and refunded.

![The fields of the shipment object](/showcase/parcelo/object.webp "The object page is the one place every shipment field is defined, nested rows included.")

Endpoint pages link to this object page for their responses, and the introduction pages carry the conventions: keys that start `sk_test_` or `sk_live_` sent as a bearer token, test-mode labels marked `VOID`, the error object every failure shares, retrying a `429` or `5xx` safely with an `Idempotency-Key`, and cursor pagination that never repeats or skips an object created while a reader pages.

## Webhooks with verification

"Webhook events" lists the event types, the event object, how to verify a post and the retry policy. The verification section shows a handler that reads the raw body, computes an HMAC-SHA256 with the webhook secret, compares it to the `Parcelo-Signature` header with a timing-safe comparison, and only then parses the event; the two lines that compute and compare the signature are highlighted in the block. A warning points out that parsing and re-serializing the body before checking makes every signature fail.

![A handler that checks the Parcelo-Signature HMAC](/showcase/parcelo/signature.webp "The signature check runs on the raw body, before the event is parsed.")

The retry section completes the contract: any answer other than `2xx`, or none within ten seconds, is retried with backoff for three days, and events can arrive more than once and out of order, so a handler keys on the event's `id`.

## The shared frame, on a phone too

Around the article sits the shell every docs demo shares: [DocsLayout](/api/ui/docs-layout), a [DocsNav](/api/ui/docs-nav) with a page filter, a [DocsPageHeader](/api/ui/docs-page-header), [PageActions](/api/ui/page-actions) with a Markdown twin per page, [NextSteps](/api/ui/next-steps), a [DocsPager](/api/ui/docs-pager) that stays inside a section, search at `search?q=` and a [DocsFeedback](/api/ui/docs-feedback) form in its own frame. On a phone the sidebar becomes a menu, the rail becomes a bar naming the section in view, and the props table restacks each parameter as a block (name, then type, then whether it is required) so no column is squeezed.

![The Create a shipment page on a phone](/showcase/parcelo/phone.webp "On a phone the parameters table restacks each field into a block, and the rail folds into a bar.")

## Takes after

- [Stripe API reference](https://docs.stripe.com/api) — one page per endpoint with nested parameters and a language choice that holds across the reference.
- [EasyPost](https://docs.easypost.com) — the domain: shipments, rates, labels and trackers as the resources a shipping API exposes.
- [Shippo](https://docs.goshippo.com) — webhook events for each tracking scan, with the shipment object at the centre.

## Where to start reading

- [`resources/views/demo-docs/parcelo/endpoint.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-docs/parcelo/endpoint.tsx) — the method line, the three-language example and the errors table every endpoint shares.
- [`resources/views/demo-docs/parcelo/shipments.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-docs/parcelo/shipments.tsx) — the shipment object and its endpoints.
- [`resources/views/demo-docs/parcelo/tracking.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-docs/parcelo/tracking.tsx) — tracking and webhook verification.
