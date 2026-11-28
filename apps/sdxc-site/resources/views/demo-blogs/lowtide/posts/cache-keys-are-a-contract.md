---
title: Cache keys are a contract
description: Every cache answers one question, "have I seen this request before?", and the key is how it decides. Most cache bugs are a key that promised too much or too little.
kind: articles
date: "2026-11-12"
tags: [caching, http, edge]
featured: true
---

Every cache in front of a website answers one question for every request it sees: _have I seen this before?_ The [cache key](/showcase/lowtide/demo/glossary/cache-key) is how it decides. Two requests with the same key get the same stored response; two requests with different keys never share one.

That makes the key a contract between you and everyone who will ever read a cached page. It promises that whatever is left out of the key cannot change the response. Break that promise and the cache hands one visitor's page to another. Keep the key too strict and the cache stores a thousand copies of the same bytes and serves almost none of them.

After six years of running caches in front of other people's applications, I think most cache bugs are one of those two failures. This is how I reason about keys now.

## What goes into a key

A CDN's default key is usually the method, the host, the path and the query string. Nothing else. Not the cookies, not the `Accept-Language` header, not the device.

```text {% title="The default key, roughly" %}
GET  shop.example  /products/kettle  ?color=green
```

That default is a bet that your origin returns the same bytes for the same URL. For a static site, the bet always pays. For an application, it pays until the day someone adds a currency switcher that reads a cookie.

> [!WARNING]
> A response that varies on something outside the key is a leak waiting for traffic. It will look fine in staging, where you are the only visitor.

## The two ways a key goes wrong

### Too loose: the leak

A key is too loose when it leaves out something the response depends on. The classic case is personalisation: the page greets you by name, the cache stores it, and the next visitor is greeted by your name.

Less obvious cases are everywhere. A page that renders prices in the currency from a cookie. An API that returns a different shape for a different `Accept` header. A redirect that reads the visitor's country. Each one is correct at the origin and wrong at the edge.

### Too strict: the miss

A key is too strict when it includes something the response does not depend on. The usual culprit is the query string. Marketing links arrive with `utm_source`, `utm_campaign`, `fbclid` and a dozen others, and every combination becomes its own key.

I once measured a news site whose home page had over four thousand distinct keys in a day, all for the same HTML. Its hit ratio on the busiest page was under ten percent, and the origin was paying for it.

## Make the key say exactly what the page reads

The fix for both failures is the same discipline: the key should name exactly the inputs the response reads, and nothing else.

Start by stripping the query parameters your application never reads. Most edge platforms let you rewrite the key before the lookup:

```ts {% title="worker.ts" highlight={[3, 4, 5]} %}
export function cacheKey(request: Request): Request {
	let url = new URL(request.url);
	for (let name of [...url.searchParams.keys()]) {
		if (name.startsWith("utm_") || name === "fbclid") url.searchParams.delete(name);
	}
	url.searchParams.sort();
	return new Request(url, { method: "GET" });
}
```

Sorting the remaining parameters matters as much as removing the noise: `?a=1&b=2` and `?b=2&a=1` are the same page, and should be the same key.

Then add the inputs the page does read. If the currency comes from a cookie, the currency belongs in the key, but only the currency, never the whole cookie header:

```ts {% title="worker.ts" %}
let currency = readCookie(request, "currency") ?? "EUR";
url.searchParams.set("__currency", currency);
```

> [!TIP]
> Normalise before you add. A currency of `eur`, `EUR` and ` EUR` should land on one key. Map every input to a small, known set of values, and send anything unknown to the default.

## Vary is a key you hand to someone else

`Vary` is the origin's way of telling every cache downstream which request headers belong in the key. `Vary: Accept-Encoding` says a gzip response and a brotli response are different entries. That one is fine; caches handle it well.

Trouble starts with headers that have thousands of values. `Vary: User-Agent` turns one entry into one per browser build. `Vary: Cookie` turns it into one per visitor, which is a cache that never hits. And `Vary: *` tells every cache not to reuse the response at all, which I wrote [a short note about](/showcase/lowtide/demo/notes/vary-star).

My rule: only vary on headers whose values you have normalised to a handful of options. If you need to vary on something messier, normalise it at the edge into a header of your own and vary on that.

## Test the contract, not the cache

The bugs above are hard to see because a cache only misbehaves with two visitors. So test with two visitors. For every page that reads a cookie or a header, I keep a check that requests it twice with different values and asserts the responses differ, and once more with an irrelevant change and asserts they match.

```bash
curl -s -H 'Cookie: currency=USD' https://shop.example/products/kettle | grep -o '\$[0-9.]*'
curl -s -H 'Cookie: currency=EUR' https://shop.example/products/kettle | grep -o '€[0-9.]*'
```

It takes ten minutes to write and it has caught more leaks than any dashboard I have built.

## The short version

- A cache key is a promise that nothing outside it changes the response.
- Too loose leaks one visitor's page to another; too strict stores copies nobody reads.
- Strip and sort the query string, then add exactly the inputs the page reads, normalised.
- Vary only on headers with a handful of values.
- Test with two visitors, because that is when caches break.

The next time a cache surprises you, write down its key and ask what the response actually read. The answer is almost always sitting in the gap between the two.
