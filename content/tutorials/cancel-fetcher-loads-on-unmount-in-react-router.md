---
title: How to Cancel `useFetcher().load()` on Unmount in React Router
excerpt: Abort stale `useFetcher().load()` requests on unmount so loaders and upstream fetches stop early.
tech: react-router@7.13.0 react@19.0.0
---

`useFetcher().load()` is a good fit for search panels, popovers, and live previews that should not navigate. The tricky part shows up when the component that owns the fetcher unmounts while the request is still in flight. In React Router v7, the UI cleans up, but the fetcher can persist long enough for the HTTP request to keep running.

That becomes expensive when your loader acts as a backend for frontend and forwards the request to another upstream service. Let's see how you could propagate `request.signal` through your loader and eagerly cancel the fetcher with `fetcher.reset()` during unmount.

## Create the Upstream Request

```ts {% path="app/lib/catalog.server.ts" %}
const CATALOG_API_URL = "https://catalog.internal/products/search";

interface Product {
	id: string;
	name: string;
}

interface SearchResponse {
	products: Array<Product>;
}

export async function searchProducts(query: string, signal: AbortSignal) {
	let url = new URL(CATALOG_API_URL);
	url.searchParams.set("q", query);

	let response = await fetch(url, { signal });

	let payload = (await response.json()) as SearchResponse;

	return payload.products;
}
```

Passing the `signal` into `fetch()` is the important part. If you skip that, canceling the fetcher only cleans up React Router state, while the upstream HTTP request keeps running.

## Create the Loader Route

```ts {% path="app/routes/resources.product-search-preview.ts" %}
import { data } from "react-router";

import type { Route } from "./+types/resources.product-search-preview";
import { searchProducts } from "~/lib/catalog.server";

export async function loader({ request }: Route.LoaderArgs) {
	let url = new URL(request.url);
	let query = url.searchParams.get("q") ?? "";

	if (query.length < 2) return data({ products: [] });

	let products = await searchProducts(query, request.signal);
	return data({ products });
}
```

The loader does not need any custom abort logic. It just forwards `request.signal` to the upstream fetch, which keeps cancellation inside the standard Fetch API flow that React Router already uses.

## Load the Route with a Fetcher

```tsx {% path="app/routes/product-search.tsx" %}
import { useState, type ChangeEvent } from "react";
import { useFetcher } from "react-router";

interface Product {
	id: string;
	name: string;
}

interface SearchData {
	products: Array<Product>;
}

interface SearchPreviewProps {
	onClose(): void;
}

export default function ProductSearchRoute() {
	let [isOpen, setIsOpen] = useState(false);

	return (
		<main>
			<button type="button" onClick={() => setIsOpen(true)}>
				Search Products
			</button>

			{isOpen ? <SearchPreview onClose={() => setIsOpen(false)} /> : null}
		</main>
	);
}

function SearchPreview({ onClose }: SearchPreviewProps) {
	let [query, setQuery] = useState("");
	let fetcher = useFetcher<SearchData>();

	function handleChange(event: ChangeEvent<HTMLInputElement>) {
		let nextQuery = event.currentTarget.value;
		let searchParams = new URLSearchParams({ q: nextQuery });

		setQuery(nextQuery);

		if (nextQuery.length < 2) fetcher.reset();
		else fetcher.load(`/resources/product-search-preview?${searchParams}`);
	}

	return (
		<section>
			<label>
				Search
				<input name="query" value={query} onChange={handleChange} />
			</label>

			<button type="button" onClick={onClose}>
				Close
			</button>

			{fetcher.state === "loading" ? <p>Loading...</p> : null}

			<ul>
				{fetcher.data?.products.map((product) => (
					<li key={product.id}>{product.name}</li>
				))}
			</ul>
		</section>
	);
}
```

This route module uses `fetcher.load()` for every qualifying query without causing a navigation. Closing the panel unmounts `SearchPreview`, but the request can still stay alive because fetchers persist in v7.

## Reset the Fetcher on Unmount

```tsx {% path="app/routes/product-search.tsx" %}
import { useEffect, useState, type ChangeEvent } from "react";
import { useFetcher } from "react-router";

// ... previous code

function SearchPreview({ onClose }: SearchPreviewProps) {
	let [query, setQuery] = useState("");
	let fetcher = useFetcher<SearchData>();
	let { reset } = fetcher;

	useEffect(() => {
		return () => reset();
	}, [reset]);

	function handleChange(event: ChangeEvent<HTMLInputElement>) {
		let nextQuery = event.currentTarget.value;
		let searchParams = new URLSearchParams({ q: nextQuery });

		setQuery(nextQuery);

		if (nextQuery.length < 2) {
			reset();
			return;
		}

		fetcher.load(`/resources/product-search-preview?${searchParams}`);
	}

	return (
		<section>
			<label>
				Search
				<input name="query" value={query} onChange={handleChange} />
			</label>

			<button type="button" onClick={onClose}>
				Close
			</button>

			{fetcher.state === "loading" ? <p>Loading...</p> : null}

			<ul>
				{fetcher.data?.products.map((product) => (
					<li key={product.id}>{product.name}</li>
				))}
			</ul>
		</section>
	);
}
```

This cleanup is the missing piece. React Router intentionally keeps fetchers around after unmount in v7, a behavior that previously lived behind `future.v7_fetcherPersist`, so eager server side cancellation is not the default behavior for `fetcher.load()`.

Calling `reset()` in the cleanup is a reasonable workaround when you want the request to stop as soon as the hosting component disappears. The important detail is that the `useFetcher()` return value is not stable, but `reset` is, so the cleanup should depend on `reset` instead of the whole fetcher object.

## Final Thoughts

If you need eager cancellation for `fetcher.load()`, calling `fetcher.reset()` during unmount is the right fix. The trade-off is that fetcher persistence preserves state across remounts, but it also means you need explicit cleanup when stale requests should stop immediately. This only works end to end if your loader forwards `request.signal` into its own upstream fetches.
