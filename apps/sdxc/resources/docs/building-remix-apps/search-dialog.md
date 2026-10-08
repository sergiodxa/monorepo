---
title: Build a search dialog
description: Open a search dialog from every page's header, show live results in a frame as the reader types, fall back to a plain results page, and announce what each search found.
section:
    title: Building Remix apps
    order: 3
order: 13
lastUpdated: 2026-10-08
---

[Full-text search over SQLite](/docs/data-and-background-work/full-text-search) builds the
search itself: the index, the parse, the ranking and the highlighted hits. This guide puts it
in front of readers. Every page's header gets a Search button that opens a dialog, the dialog
shows the top matches as the reader types, and Enter or "See all" leads to a `/search` page
with every match, paged. Each layer starts as plain HTML: a form that submits to `/search`
works in a browser running no script, and the live results are an upgrade on top of it.

[`@sdxc/ui`](/api/ui) supplies the dialog, the search field, the highlighted text, the field
error and the pager, and [`@sdxc/u`](/api/u) styles what sits between them. The server side
comes from [`@sdxc/search`](/api/search) and [`@sdxc/pagination`](/api/pagination), as the
search guide set them up, and [`@sdxc/workers-cache`](/api/workers-cache) caches the dialog's
answers at the edge.

```bash
npm add @sdxc/ui @sdxc/u @sdxc/search @sdxc/pagination @sdxc/workers-cache remix
```

## Two routes

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

Both read the same `?q=`, parse it with the same `parseArticleQuery`, and draw the same hits, so
the dialog and the page always agree on what a query finds.

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

`Modal` is a native `<dialog>`, so `showModal()` traps focus inside it, Escape closes it, and
`closedby="any"` closes it on a click on the backdrop as well. The frame has no `fallback`, so
the server resolves it while it renders the page: the dialog arrives with its box already in it,
and opening it costs no request. `searchQuery` is the text the dialog opens holding, blank on
every page but `/search`, which passes its own query so the dialog continues that search.
`apple` prints the hint as `⌘K` or `Ctrl K`, read from the request as
[Keyboard shortcuts](/docs/building-remix-apps/keyboard-shortcuts) shows, and
`aria-keyshortcuts` names the keys for a screen reader while the `<kbd>` stays decoration.

## Answer the frame with a fragment

The fragment route parses `?q=` and renders the box and the top matches, with no layout around
them, since the page the frame sits in already has one:

```tsx {% title="app/http/controllers/search-frame.tsx" %}
import { Pagination } from "@sdxc/pagination";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { matchingArticles, parseArticleQuery } from "~/app/search/articles";
import { toHit } from "~/app/search/hits";
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

Every answer is a 200, a query that cannot run included. The fragment lands inside a dialog on
whatever page the reader is on, so the reason shows under the box, where the reader is looking,
and the answer stays cacheable. `X-Robots-Tag: noindex` keeps the fragments out of search
engines: each one is a view of articles the sitemap already lists.

## Cache what the dialog asks for

Every page's dialog asks for the same blank `/frames/search`, and readers type the same few
queries, so `ctx.cache` stores each answer at the edge under the tag every article listing
carries. The action that saves an article purges that tag, and the next request for any query
is answered fresh. A failed search replaces the policy with `no-store`, since a later call to
`ctx.cache` replaces the earlier policy, so a passing database error is never served from the
cache. `PUBLIC_PAGE` and `TAGS` are the policy and tags
[Cache data and pages on Workers](/docs/data-and-background-work/cache-on-workers) declares.

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

import type { SearchHit } from "~/app/search/hits";

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

`SearchField` is the `<search>` landmark, so a screen reader lists the region among the page's
landmarks. The status line is in the fragment in every state, the blank one included, so the
live region already exists when the first results arrive and its change is what gets announced.
While matches are on screen the line is visually hidden, because the list shows them, and a
screen reader still hears "Top 6 of 40 results". A query with no matches, or one that cannot
run, shows the line as well.

Each match is a row the page and the dialog share:

```tsx {% title="resources/components/search-result.tsx" %}
import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { gap, grid } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Highlight, Link } from "@sdxc/ui";

import type { SearchHit } from "~/app/search/hits";

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

`Highlight` renders each matched segment as a native `<mark>` and every other segment as text,
so the title and excerpt are escaped by construction, and a match inside the link still reads
as the link. `color` picks the tint: the brand color in the title, a quieter neutral in the
excerpt.

## Reload the frame as the reader types

`SearchBox` is the one client entry. It renders the box, and once script runs it points the
frame at the fragment for the text so far and reloads it, once typing pauses:

```tsx {% title="resources/components/search-box.tsx" %}
import type { Handle } from "remix/component";

import { SearchField } from "@sdxc/ui";
import { bindKeymap } from "@sdxc/ui/mixins";
import { clientEntry, on } from "remix/component";

export const SEARCH_DIALOG_ID = "site-search";
export const SEARCH_RESULTS_ID = "site-search-results";
const DEBOUNCE_MS = 200;

export function searchFrameSrc(frameSrc: string, text: string) {
	let query = text.trim();
	if (query === "") return frameSrc;
	return `${frameSrc}?${new URLSearchParams({ q: query })}`;
}

function searchDialog() {
	let dialog = document.getElementById(SEARCH_DIALOG_ID);
	return dialog instanceof HTMLDialogElement ? dialog : null;
}

function markBusy(busy: boolean) {
	let results = document.getElementById(SEARCH_RESULTS_ID);
	if (busy) results?.setAttribute("aria-busy", "true");
	else results?.removeAttribute("aria-busy");
}

type SearchBoxProps = { id: string; query: string; frameSrc: string };

export const SearchBox = clientEntry(
	"/resources/components/search-box.tsx#SearchBox",
	function SearchBox(handle: Handle<SearchBoxProps>) {
		let debounce: ReturnType<typeof setTimeout> | undefined;
		let latest = 0;
		let initialQuery = handle.props.query;
		handle.signal.addEventListener("abort", () => clearTimeout(debounce));

		async function load(src: string, keystroke: number) {
			if (src !== handle.frame.src) {
				handle.frame.src = src;
				await handle.frame.reload().catch(() => undefined);
			}
			if (keystroke === latest) markBusy(false);
		}

		function search(text: string) {
			let keystroke = ++latest;
			clearTimeout(debounce);
			markBusy(true);
			debounce = setTimeout(() => {
				void load(searchFrameSrc(handle.props.frameSrc, text), keystroke);
			}, DEBOUNCE_MS);
		}

		function reset() {
			let box = document.getElementById(handle.props.id);
			if (box instanceof HTMLInputElement) box.value = initialQuery;
			clearTimeout(debounce);
			void load(searchFrameSrc(handle.props.frameSrc, initialQuery), ++latest);
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
				mix={[
					on<HTMLInputElement, "input">("input", (event) => {
						search(event.currentTarget.value);
					}),
				]}
			/>
		);
	},
);
```

`handle.frame` is the frame the island was rendered in. Setting its `src` and calling
`reload()` fetches the fragment for the new text and diffs it into the dialog: the matches
change, and the box, being the same island, keeps its focus, its caret and what the reader has
typed since. `latest` counts keystrokes, so only the newest reload clears `aria-busy` from the
results region, and an answer to an older query never marks the newer one done. A blank box
loads the bare `/frames/search`, the same cached answer the page started with.

Closing the dialog runs `reset`, which puts the box and the frame back to the query the page
rendered with, so the dialog reopens where every reader starts. `autofocus` puts the caret in
the box each time `showModal()` opens the dialog.

The shortcuts are `bindKeymap` from `@sdxc/ui/mixins`: `⌘K` or `Ctrl+K` opens the dialog from
anywhere on the page, and `/` does too. Both stand down for a keystroke typed into a field, so
a `/` typed into a comment box stays a `/`. Escape needs no binding, since the dialog closes on
it natively. The browser entry has to know this module, which the
`import.meta.glob` over `resources/` in
[Load content as readers reach it](/docs/building-remix-apps/load-content-as-readers-reach-it)
already covers.

## The full results page

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
import { tabularNums, text } from "@sdxc/u/typography";
import { FieldError, Heading, Label, SearchField } from "@sdxc/ui";

import type { SearchHit } from "~/app/search/hits";

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
							<p mix={[m(0), text("sm"), tabularNums()]}>
								{props.pagination.from}–{props.pagination.to} of{" "}
								{props.pagination.total} results
							</p>
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

`Layout` is your document layout, rendering `SiteHeader` with the `searchQuery` it is given.
`Pager` is the numbered pager from [Paginate lists](/docs/http-apis/paginate-lists): every page
is a plain link that keeps `q`, the current page carries `aria-current="page"`, and a single page
of results draws no pager.

A query that cannot run answers 400 with its text still in the box. `aria-invalid` marks the
field, and `aria-describedby` points at the `FieldError`, so a screen reader reads the reason
right after the field's label. The box submits `q` alone, so a new query starts on its first
page. `autofocus` only on a blank page puts the caret in the box for a reader who came to search,
and leaves it alone on a results page, where the reader came to read.

## Accessibility at a glance

- The trigger is a `<button>` named "Search", with its keys in `aria-keyshortcuts`. It opens a
  modal `<dialog>` named by `aria-label`, which traps focus and returns it to the button when it
  closes.
- The box has an accessible name in the dialog and a visible `Label` on the page. Both sit in a
  `<search>` landmark.
- One `role="status"` line per fragment announces the count, or the reason a query cannot run,
  each time the frame reloads, and `aria-busy` on the results region marks newer results on
  their way.
- Every match is a link in an ordered list, reached with `Tab` in the dialog and on the page.
- Matched words are `<mark>` elements, which a screen reader can report and Windows High
  Contrast draws in its own highlight colors.

## Where to go next

- [Full-text search over SQLite](/docs/data-and-background-work/full-text-search): the index,
  the query syntax, ranking and highlighting behind both routes.
- [Keyboard shortcuts](/docs/building-remix-apps/keyboard-shortcuts): printing the hint in the
  reader's key caps, and the rules a keymap stands down by.
- [Build the interface with remix/component](/docs/building-remix-apps/interface-with-remix-ui):
  dialogs, invoker commands and islands.
- [`@sdxc/ui`](/api/ui): `Modal`, `SearchField`, `Highlight`, `FieldError` and `Pagination`.
