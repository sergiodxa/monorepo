---
title: Build a search dialog
description: Open a search dialog from every page's header, show live results in a frame as the reader types, fall back to a plain results page, and announce what each search found.
section:
    title: Building Remix apps
    order: 4
order: 13
lastUpdated: 2026-10-25
outcomes:
    - "How to open a search dialog from every page's header and show live results in a frame"
    - "How to cache what the dialog asks for with `@sdxc/workers-cache`"
    - "How to fall back to a plain results page and announce what each search found"
---

[Full-text search over SQLite](/docs/data-and-background-work/full-text-search) builds the
search itself. This guide puts it in front of readers: a Search button in every page's header
opens a dialog that shows the top matches as the reader types, and Enter or "See all" leads to
a paged `/search` page. The form submits to `/search` with no script, and the live results are
an upgrade on top of it. [`@sdxc/ui`](/api/ui) supplies the dialog, field, live frame,
highlighting and pager, and [`@sdxc/u`](/api/u) styles what sits between them.

```bash
npm add @sdxc/pagination @sdxc/result @sdxc/u @sdxc/ui remix
```

## Declare two routes

The results page and the dialog's body are two addresses. `/search` is a page a reader can
bookmark or share. `/frames/search` answers a fragment, the box and a handful of matches, which
the dialog loads into a frame and reloads as the reader types:

```typescript {% title="routes/web.ts" %}
import { get, route } from "remix/routes";

export default route({
	search: get("/search"),
	searchFrame: get("/frames/search"),
});
```

Both parse `?q=` with the same `parseArticleQuery`, so the dialog and the page agree on what a
query finds.

## Open the dialog from the header

The header's Search button names the dialog with `commandfor` and asks it to `show-modal`, the
Command Invoker API, so the dialog opens with no script at all. The dialog holds a frame whose
`src` is the fragment route:

```tsx {% title="resources/components/site-header.tsx" %}
import type { Handle } from "remix/component";

import { Button, Keyboard, Modal } from "@sdxc/ui";
import { keyComboGlyphs } from "@sdxc/ui/utils";
import { Frame } from "remix/component";

import { SEARCH_DIALOG_ID, searchFrameSrc } from "~/resources/components/search-box";
import routes from "~/routes/web";

interface SiteHeaderProps {
	apple: boolean;
	searchQuery?: string;
}

export function SiteHeader(handle: Handle<SiteHeaderProps>) {
	return () => {
		let { apple, searchQuery = "" } = handle.props;

		return (
			<header>
				<Button
					type="button"
					variant="outline"
					commandfor={SEARCH_DIALOG_ID}
					command="show-modal"
					aria-keyshortcuts="Meta+K Control+K /"
				>
					Search
					<Keyboard aria-hidden="true">
						{keyComboGlyphs("mod+k", apple).join("")}
					</Keyboard>
				</Button>
				<Modal id={SEARCH_DIALOG_ID} aria-label="Search" closedby="any">
					<Frame
						name="search"
						src={searchFrameSrc(routes.searchFrame.href(), searchQuery)}
					/>
				</Modal>
			</header>
		);
	};
}
```

`Modal` is a native `<dialog>`: it traps focus, closes on Escape, and `closedby="any"` closes it
on a backdrop click. The frame has no `fallback`, so the server renders the box into the page and
opening the dialog costs no request. `apple` prints the hint as `⌘K` or `Ctrl K`, as
[Keyboard shortcuts](/docs/building-remix-apps/keyboard-shortcuts) shows.

## Answer the frame with a fragment

The fragment route parses `?q=` and renders the box and the top matches, with no layout around
them, since the page the frame sits in already has one:

```tsx {% title="app/http/controllers/search-frame.tsx" %}
import { Pagination } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { matchingArticles, parseArticleQuery } from "~/app/models/search/articles";
import { toHit } from "~/app/services/search/hits";
import { PUBLIC_PAGE, TAGS } from "~/app/services/edge-cache";
import { SearchSuggestions } from "~/resources/views/search-suggestions";
import routes from "~/routes/web";

const SUGGESTIONS = 6;

export default createAction(routes.searchFrame, async (ctx) => {
	let text = ctx.url.searchParams.get("q") ?? "";
	let init = { headers: { "X-Robots-Tag": "noindex" } };
	ctx.cache(PUBLIC_PAGE, TAGS.articleList());

	let parsed = parseArticleQuery(text);
	if (isFailure(parsed)) {
		let message = parsed.error.issues[0]?.message ?? "This search cannot run.";
		let view = (
			<SearchSuggestions state="invalid" query={text} message={message} />
		);
		return ctx.render(view, init);
	}
	if (parsed.data === null) {
		return ctx.render(<SearchSuggestions state="blank" />, init);
	}

	let query = parsed.data;
	let page = await Pagination.byOffset(matchingArticles(ctx.db, query), {
		page: 1,
		perPage: SUGGESTIONS,
	});
	if (isFailure(page)) {
		ctx.log.fail(page.error);
		ctx.cache("no-store");
		let message = "Search is unavailable right now.";
		let view = (
			<SearchSuggestions state="invalid" query={text} message={message} />
		);
		return ctx.render(view, init);
	}

	let hits = page.data.items.map((row) => toHit(row, query));
	let { total } = page.data.pagination;
	return ctx.render(
		<SearchSuggestions state="results" query={text} hits={hits} total={total} />,
		init,
	);
});
```

Every answer is a 200, a query that cannot run included, so the reason shows under the box and
the answer stays cacheable. `X-Robots-Tag: noindex` keeps the fragments out of search engines.
`ctx.cache` stores each answer at the edge under the article-listing tag, which saving an article
purges; `PUBLIC_PAGE` and `TAGS` come from
[Cache on Cloudflare Workers](/docs/data-and-background-work/cache-on-workers).

> [!NOTE]
> A later call to `ctx.cache` replaces the earlier policy, which is how a failed search answers
> with `no-store`. Keep that call on every failure path, so a passing database error is never
> served from the cache to every reader who types the same query.

## Render the box and the matches

The fragment's view is a `GET` form to `/search` around the box, then a results region: one
status line and the list of matches. Without script, typing and pressing Enter submits the form
and the reader lands on the full results page:

```tsx {% title="resources/views/search-suggestions.tsx" %}
import type { Handle } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { listStyle } from "@sdxc/u/general";
import { gap, grid } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Link, SearchField } from "@sdxc/ui";

import type { SearchHit } from "~/app/services/search/hits";

import { SEARCH_RESULTS_ID, SearchBox } from "~/resources/components/search-box";
import { SearchResult } from "~/resources/components/search-result";
import routes from "~/routes/web";

export type SearchSuggestionsProps =
	| { state: "blank" }
	| { state: "invalid"; query: string; message: string }
	| { state: "results"; query: string; hits: SearchHit[]; total: number };

function statusOf(props: SearchSuggestionsProps) {
	if (props.state === "blank") return "";
	if (props.state === "invalid") return props.message;
	if (props.total === 0) return `No articles match “${props.query}”.`;
	if (props.total === 1) return "1 result";
	if (props.total <= props.hits.length) return `${props.total} results`;
	return `Top ${props.hits.length} of ${props.total} results`;
}

export function SearchSuggestions(handle: Handle<SearchSuggestionsProps>) {
	return () => {
		let props = handle.props;
		let query = props.state === "blank" ? "" : props.query;
		let hits = props.state === "results" ? props.hits : [];
		let seeAll = `${routes.search.href()}?${new URLSearchParams({ q: query })}`;

		return (
			<div mix={[grid(), gap(3), p(4)]}>
				<form method="get" action={routes.search.href()}>
					<SearchField>
						<SearchBox
							id="search-dialog-q"
							query={query}
							frameSrc={routes.searchFrame.href()}
						/>
					</SearchField>
				</form>
				<div id={SEARCH_RESULTS_ID} mix={[grid(), gap(3)]}>
					<p
						role="status"
						mix={
							hits.length > 0 ? [visuallyHidden()] : [m(0), text("sm")]
						}
					>
						{statusOf(props)}
					</p>
					{hits.length > 0 ? (
						<ol
							aria-label="Top matches"
							mix={[m(0), p(0), listStyle("none"), grid(), gap(3)]}
						>
							{hits.map((hit) => (
								<SearchResult key={hit.href} hit={hit} />
							))}
						</ol>
					) : null}
					{props.state === "results" && props.total > hits.length ? (
						<Link href={seeAll}>See all {props.total} results</Link>
					) : null}
				</div>
			</div>
		);
	};
}
```

The status line is in the fragment in every state, the blank one included, so the live region
already exists when the first results arrive and its change is what gets announced. While
matches are on screen it is visually hidden, and a screen reader still hears "Top 6 of 40
results".

Each match is a row the page and the dialog share:

```tsx {% title="resources/components/search-result.tsx" %}
import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { gap, grid } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Highlight, Link } from "@sdxc/ui";

import type { SearchHit } from "~/app/services/search/hits";

export function SearchResult(handle: Handle<{ hit: SearchHit }>) {
	return () => {
		let { hit } = handle.props;
		let { segments, truncatedStart, truncatedEnd } = hit.excerpt;

		return (
			<li mix={[grid(), gap(1)]}>
				<Link href={hit.href}>
					<Highlight segments={hit.title} />
				</Link>
				<p mix={[m(0), text("sm"), fg("neutral.muted")]}>
					{truncatedStart ? "… " : null}
					<Highlight segments={segments} color="neutral" />
					{truncatedEnd ? " …" : null}
				</p>
			</li>
		);
	};
}
```

`Highlight` renders each matched segment as a `<mark>` and the rest as text, so the title and
excerpt are escaped by construction.

## Reload the frame as the reader types

`SearchBox` is the one client entry. It renders the box, and once script runs the `liveFrame`
mixin from `@sdxc/ui/mixins` points the frame at the fragment for the text so far and reloads
it, once typing pauses:

```tsx {% title="resources/components/search-box.tsx" %}
import type { Handle } from "remix/component";

import { SearchField } from "@sdxc/ui";
import { bindKeymap, LIVE_FRAME_RELOAD_EVENT, liveFrame } from "@sdxc/ui/mixins";
import { clientEntry } from "remix/component";

export const SEARCH_DIALOG_ID = "site-search";
export const SEARCH_RESULTS_ID = "site-search-results";

export function searchFrameSrc(frameSrc: string, text: string) {
	let query = text.trim();
	if (query === "") return frameSrc;
	return `${frameSrc}?${new URLSearchParams({ q: query })}`;
}

function searchDialog() {
	let dialog = document.getElementById(SEARCH_DIALOG_ID);
	return dialog instanceof HTMLDialogElement ? dialog : null;
}

interface SearchBoxProps {
	id: string;
	query: string;
	frameSrc: string;
}

export const SearchBox = clientEntry(
	"/resources/components/search-box.tsx#SearchBox",
	function SearchBox(handle: Handle<SearchBoxProps>) {
		let initialQuery = handle.props.query;

		function reset() {
			let box = document.getElementById(handle.props.id);
			if (!(box instanceof HTMLInputElement)) return;
			box.value = initialQuery;
			box.dispatchEvent(new Event(LIVE_FRAME_RELOAD_EVENT));
		}

		handle.queueTask(() => {
			let dialog = searchDialog();
			let open = () => {
				if (dialog && !dialog.open) dialog.showModal();
			};
			bindKeymap(
				document,
				{ "mod+k": open, "/": open },
				{ signal: handle.signal, scope: dialog },
			);
			dialog?.addEventListener("close", reset, { signal: handle.signal });
		});

		return () => (
			<SearchField.Input
				id={handle.props.id}
				name="q"
				defaultValue={handle.props.query}
				aria-label="Search the help center"
				aria-controls={SEARCH_RESULTS_ID}
				placeholder="Search the help center"
				autocomplete="off"
				enterkeyhint="search"
				autofocus
				mix={liveFrame({
					src: (text) => searchFrameSrc(handle.props.frameSrc, text),
				})}
			/>
		);
	},
);
```

`liveFrame` reloads the frame 200 milliseconds after the last keystroke. The reload diffs the
fragment into the dialog, so the matches change while the box keeps its focus and caret.

Closing the dialog runs `reset`, which restores the page's query and reloads the frame at once,
so the dialog reopens where every reader starts. `bindKeymap` opens it on `⌘K`, `Ctrl+K` or `/`,
and stands down for keys typed into a field.

> [!NOTE]
> The browser entry has to know this module, or the box never hydrates and the dialog stays a
> plain form. The `import.meta.glob` over `resources/` in
> [Load content as readers reach it](/docs/building-remix-apps/load-content-as-readers-reach-it#register-the-client-entry)
> already covers it.

## Render the full results page

`/search` is the page the form submits to and "See all" links to. It renders the field with its
error, the count, the matches and a numbered pager, all as server HTML, from the props the
[search guide's controller](/docs/data-and-background-work/full-text-search#search-filter-and-page)
passes:

```tsx {% title="resources/views/search.tsx" %}
import type { Pagination } from "@sdxc/pagination";
import type { Handle } from "remix/component";

import { listStyle } from "@sdxc/u/general";
import { gap, grid } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { FieldError, Heading, Label, SearchField } from "@sdxc/ui";

import type { SearchHit } from "~/app/services/search/hits";

import { SearchResult } from "~/resources/components/search-result";
import { Layout } from "~/resources/layouts/site";
import { Pager } from "~/resources/views/pager";
import routes from "~/routes/web";

export type SearchPageProps =
	| { state: "blank" }
	| { state: "invalid"; query: string; message: string }
	| {
			state: "results";
			query: string;
			hits: SearchHit[];
			pagination: Pagination;
			url: URL;
	  };

export function SearchPage(handle: Handle<SearchPageProps>) {
	return () => {
		let props = handle.props;
		let query = props.state === "blank" ? "" : props.query;
		let message = props.state === "invalid" ? props.message : undefined;

		return (
			<Layout title={query ? `Search: ${query}` : "Search"} searchQuery={query}>
				<main mix={[grid(), gap(4)]}>
					<Heading level={1}>Search</Heading>
					<form method="get" action={routes.search.href()}>
						<SearchField>
							<Label htmlFor="search-q">Search the help center</Label>
							<SearchField.Input
								id="search-q"
								name="q"
								defaultValue={query}
								enterkeyhint="search"
								autofocus={query === ""}
								aria-invalid={message ? "true" : undefined}
								aria-describedby={
									message ? "search-q-error" : undefined
								}
							/>
							{message ? (
								<FieldError id="search-q-error">{message}</FieldError>
							) : null}
						</SearchField>
					</form>

					{props.state === "results" && props.hits.length === 0 ? (
						<p mix={[m(0)]}>No articles match “{props.query}”.</p>
					) : null}

					{props.state === "results" && props.hits.length > 0 ? (
						<section aria-label="Search results" mix={[grid(), gap(3)]}>
							<ol mix={[m(0), p(0), listStyle("none"), grid(), gap(4)]}>
								{props.hits.map((hit) => (
									<SearchResult key={hit.href} hit={hit} />
								))}
							</ol>
							<Pager
								label="Search result pages"
								url={props.url}
								pagination={props.pagination}
							/>
						</section>
					) : null}
				</main>
			</Layout>
		);
	};
}
```

`Layout` is your document layout, rendering `SiteHeader` with `searchQuery` so the dialog
continues this search. `Pager` is the numbered pager from
[Paginate lists](/docs/http-apis/paginate-lists). A query that cannot run answers 400 with its
text still in the box, and `aria-describedby` points the field at its `FieldError`.

## Test the fragment

The fragment is an ordinary response, so a route test asks for the frame's address through the
router. `migrate()` prepares the in-memory database, as
[Test Workers apps](/docs/operations-and-testing/testing#drive-the-real-router) sets up:

```typescript {% title="app/http/controllers/search-frame.test.ts" %}
import { beforeAll, expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";
import { migrate } from "~/app/test/database";
import routes from "~/routes/web";

beforeAll(migrate);

function frame(query: string) {
	let url = new URL(routes.searchFrame.href(), "https://example.com");
	if (query) url.searchParams.set("q", query);
	return createWebRouter().fetch(new Request(url));
}

test("answers the blank box as a fragment kept out of search engines", async () => {
	let response = await frame("");

	expect(response.status).toBe(200);
	expect(response.headers.get("X-Robots-Tag")).toBe("noindex");
	expect(await response.text()).not.toContain("<html");
});

test("says so when nothing matches", async () => {
	let body = await (await frame("nothing-matches-this")).text();

	expect(body).toContain('role="status"');
	expect(body).toContain("No articles match");
});
```

## Where to go next

- [Full-text search over SQLite](/docs/data-and-background-work/full-text-search) — the index,
  the query syntax, ranking and highlighting behind both routes.
- [Keyboard shortcuts](/docs/building-remix-apps/keyboard-shortcuts) — printing the hint in the
  reader's key caps, and the rules a keymap stands down by.
- [`@sdxc/ui`](/api/ui) — `Modal`, `SearchField`, `liveFrame`, `Highlight`, `FieldError` and
  `Pagination`.
