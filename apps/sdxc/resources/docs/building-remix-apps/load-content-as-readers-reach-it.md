---
title: Load content as readers reach it
description: Defer a list's next page until the reader scrolls near it and a dialog's content until it opens, keep the address bar on the page being read, and keep plain links for browsers running no script.
section:
    title: Building Remix apps
    order: 3
order: 10
lastUpdated: 2026-10-08
---

This guide builds a job board. The list of postings continues as the reader scrolls, in both
directions, and the address bar follows them so a reload lands on the page they were reading.
Each posting's "Read more" opens a dialog whose content is fetched the first time it opens.
Every one of those pieces starts as a plain link, and a browser running no script follows the
links instead.

[`@sdxc/lazy-frame`](/api/lazy-frame) ships one `remix/component` client entry,
`LazyFrame`. On the server it renders its `children`. In the browser it keeps them until the
reader reaches it, by scrolling near it or by opening the dialog around it, and then mounts a
Remix `Frame` for its `src`.

```bash
npm add @sdxc/lazy-frame remix
```

## Register the client entry

`LazyFrame` is a client entry named `@sdxc/lazy-frame/ui#LazyFrame`, so the server writes the
bare specifier `@sdxc/lazy-frame/ui` into the page, and the browser entry's `loadModule` has
to resolve it. An `import.meta.glob` over the app's own directories cannot reach into
`node_modules`, so a package's islands get an explicit map keyed by that specifier. Keep the
map in a module of its own, so a test can read it without starting the runtime:

```typescript {% title="bootstrap/client-modules.ts" %}
export const PACKAGE_MODULES: Record<string, () => Promise<unknown>> = {
	"@sdxc/lazy-frame/ui": () => import("@sdxc/lazy-frame/ui"),
};

export const CLIENT_MODULES = import.meta.glob([
	"!../**/*.server.*",
	"!../**/*.test.*",
	"../resources/**/*.{ts,tsx}",
]);
```

```typescript {% title="bootstrap/browser.ts" %}
import { run } from "remix/component";

import { CLIENT_MODULES, PACKAGE_MODULES } from "./client-modules";

run({
	async loadModule(moduleUrl, exportName) {
		let pathname = new URL(moduleUrl, location.origin).pathname;
		let load = PACKAGE_MODULES[moduleUrl] ?? CLIENT_MODULES[`..${pathname}`];
		if (!load) throw new Error(`Unknown client entry module: ${moduleUrl}`);
		return Reflect.get((await load()) as object, exportName);
	},
});
```

The package map is checked first, because a bare specifier resolved as a URL turns into a
path the glob has no key for. Miss this step and nothing fails loudly: the page renders, the
island never mounts, and every reader gets the plain links.

## Start from a link

A `LazyFrame` takes the address to fetch as `src` and the markup to keep until then as
`children`. Make the children the link that reaches the same content as a page of its own,
because a browser running no script keeps them for good:

```tsx {% title="resources/views/jobs.tsx" %}
import { LazyFrame } from "@sdxc/lazy-frame/ui";

<LazyFrame src="/jobs?page=2&frame">
	<a href="/jobs?page=2">Older postings</a>
</LazyFrame>;
```

The component renders a `<div>` around its content, holding the children until the reader
arrives and then a `Frame` for `src`. While the request is in the air, `fallback` stands in,
and it defaults to the children, so the link stays put until the postings replace it.
`children` and `fallback` each take one element, text, a number, a boolean or `null`, the
values a client entry's props can carry to the browser.

The swap latches. A frame that has loaded keeps its content when it scrolls out of view or
its dialog closes, and asks for `src` once.

## Answer the frame with a fragment

`src` points at a route like any link, and the route answers it with the piece that goes
inside the frame: no doctype, no `<html>`, no layout, since the document it lands in already
has those. Mark a frame's address with a parameter of its own, `frame` here, so the route can
tell the two requests apart. The address is the one thing only the frame's request carries.

```tsx {% title="app/http/fragment.tsx" %}
import type { RemixNode } from "remix/component";

import { HTML } from "@sdxc/http/content-type";
import { renderToStream } from "remix/component/server";

export const FRAME_PARAM = "frame";

export function isFrameRequest(url: URL) {
	return url.searchParams.has(FRAME_PARAM);
}

export function frameOf(href: string) {
	return `${href}${href.includes("?") ? "&" : "?"}${FRAME_PARAM}`;
}

export function fragment(node: RemixNode, init?: ResponseInit) {
	let headers = new Headers(init?.headers);
	headers.set("Content-Type", `${HTML}; charset=utf-8`);
	return new Response(renderToStream(node), { ...init, headers });
}
```

The list's action renders the whole page for a visit and only the rows for a frame:

```tsx {% title="app/http/controllers/jobs/index.tsx" %}
import { createAction } from "remix/router";

import Jobs from "~/app/data/job";
import { fragment, isFrameRequest } from "~/app/http/fragment";
import { JobList, JobsPage } from "~/resources/views/jobs";
import routes from "~/routes/web";

export default createAction(routes.jobs.index, async (ctx) => {
	let page = await Jobs.page(ctx.db, ctx.url);

	if (isFrameRequest(ctx.url)) return fragment(<JobList page={page} />);

	return ctx.render(<JobsPage page={page} />);
});
```

`Jobs.page` is your own model. It reads the page from the query, as
[Paginate lists](/docs/http-apis/paginate-lists) shows, and answers the rows with the address
of this page and of the pages either side of it:

```typescript {% title="app/data/job.ts" %}
export interface JobPage {
	url: string;
	newer: string | null;
	older: string | null;
	rows: { id: string; title: string; company: string }[];
}
```

A fragment can hold islands of its own, `LazyFrame` among them. The runtime hydrates what a
frame brings in the same way it hydrates the document, which is what lets the list below go on
for as many pages as there are.

## Load the next page as the reader scrolls

`loadOn` defaults to `"approach"`: the frame loads once it nears the viewport. Put one after
the rows, and since the fragment it fetches ends with a frame of its own, the list continues
page after page:

```tsx {% title="resources/views/jobs.tsx" %}
import type { Handle } from "remix/component";

import { LazyFrame } from "@sdxc/lazy-frame/ui";

import type { JobPage } from "~/app/data/job";

import { frameOf } from "~/app/http/fragment";

export function JobList(handle: Handle<{ page: JobPage }>) {
	return () => {
		let { page } = handle.props;
		return (
			<div>
				<ol>
					{page.rows.map((job) => (
						<li key={job.id}>
							<a href={`/jobs/${job.id}`}>{job.title}</a> at{" "}
							{job.company}
						</li>
					))}
				</ol>

				{page.older && (
					<LazyFrame src={frameOf(page.older)} rootMargin="600px 0px">
						<a href={page.older}>Older postings</a>
					</LazyFrame>
				)}
			</div>
		);
	};
}
```

`rootMargin` is how far around the viewport the frame starts its fetch, in
`IntersectionObserver` `rootMargin` syntax, and defaults to `"320px 0px"`: 320 pixels below
the viewport, so the next page is usually there before the reader gets to it. Widen it for
rows that are slow to answer, or pass a percentage such as `"100% 0px"` to stay one screen
ahead whatever the device. Every frame asking for the same margin shares one observer, so a
list read twenty pages deep watches with one, and nothing runs on scroll.

## Keep the address bar on the page being read

A reader twenty pages down who reloads expects to land where they were, not back at the top.
Give a frame `url`, the address of the page it holds, and `parentUrl`, the address of the
page it sits in, and it keeps the address bar on whichever the reader is in:

```tsx {% title="resources/views/jobs.tsx" %}
<LazyFrame src={frameOf(page.older)} url={page.older} parentUrl={page.url}>
	<a href={page.older}>Older postings</a>
</LazyFrame>
```

The frame reaches from the first row of its page to the end of the list, so the address bar
moves to `url` once the frame's top passes the top tenth of the viewport, and back to
`parentUrl` when the reader scrolls above it. Nested frames settle among themselves on the
deepest one the reader has reached. The entry is replaced rather than pushed, so Back leaves
the list in one step instead of walking every page the reader scrolled through. A frame given
only one of the two addresses leaves the address bar alone.

## Walk the list back up

A reload, or a shared link, can open the board on page 7. The newer postings then sit above
the rows the reader is looking at, and loading them should neither jump the page nor fire
before anybody asked. `sitsAbove` marks a frame placed above content the reader already sees:

```tsx {% title="resources/views/jobs.tsx" %}
export function JobList(handle: Handle<{ page: JobPage }>) {
	return () => {
		let { page } = handle.props;
		return (
			<div>
				{page.newer && (
					<LazyFrame
						src={frameOf(page.newer)}
						url={page.newer}
						parentUrl={page.url}
						sitsAbove
					>
						<a href={page.newer}>Newer postings</a>
					</LazyFrame>
				)}

				<ol>
					{page.rows.map((job) => (
						<li key={job.id}>
							<a href={`/jobs/${job.id}`}>{job.title}</a> at{" "}
							{job.company}
						</li>
					))}
				</ol>

				{page.older && (
					<LazyFrame
						src={frameOf(page.older)}
						url={page.older}
						parentUrl={page.url}
					>
						<a href={page.older}>Older postings</a>
					</LazyFrame>
				)}
			</div>
		);
	};
}
```

A frame above the content is already within reach when the page opens, so it loads only once
the reader has scrolled past it and come back. When the newer page lands, the frame scrolls the
window by exactly the height it grew, in the same paint, so the posting under the reader's eyes
stays where it was. It keeps doing so for its whole life, which also covers content that
settles late, such as an image that finishes loading. Frames above the content nest like the
ones below, and only the outermost one scrolls, since it has grown by everything that arrived
inside it.

This layout is the same component at every depth: each page renders its rows between a frame
for the newer page and a frame for the older one, and each fetched page brings its own pair.

## Load a dialog's content when it opens

A posting's full text is long, and most readers open few of them. With `loadOn="open"`, a frame
loads the first time the closest `<dialog>`, `<details>` or `[popover]` around it opens:

```tsx {% title="resources/views/job-row.tsx" %}
import type { Handle } from "remix/component";

import { LazyFrame } from "@sdxc/lazy-frame/ui";

import { frameOf } from "~/app/http/fragment";

interface Props {
	job: { id: string; title: string };
}

export function JobRow(handle: Handle<Props>) {
	return () => {
		let { job } = handle.props;
		let opener = `job-${job.id}`;
		let dialog = `${opener}-dialog`;
		let href = `/jobs/${job.id}`;

		return (
			<li>
				<a id={opener} href={href}>
					{job.title}
				</a>

				<dialog id={dialog} aria-label={job.title}>
					<LazyFrame
						src={frameOf(href)}
						loadOn="open"
						opener={opener}
						fallback="Loading the posting…"
					>
						<a href={href}>Read the full posting</a>
					</LazyFrame>
					<button type="button" commandfor={dialog} command="close">
						Close
					</button>
				</dialog>
			</li>
		);
	};
}
```

`opener` is the `id` of a link that leads to the same content as a page of its own. Once
script runs, clicking it opens the frame's container (`showModal()` for a dialog, `open` for a
disclosure, `showPopover()` for a popover) and the reader stays on the list. Without script the
link navigates to `/jobs/:id`, and the dialog is never shown. A click another handler has
already cancelled is left alone.

The frame watches the container's `toggle` event, so it loads however the container opened: a
button with `commandfor`, a `popovertarget`, a `<summary>` click, or a script. A container that
is already open, such as `<details open>`, loads at once, and a frame with no container around
it keeps its children for good. `fallback` here replaces the link while the posting is in the
air, because inside an open dialog a "Read the full posting" link reads as the content itself.

The posting's route answers the frame the same way the list does, with
`isFrameRequest(ctx.url)` choosing the fragment over the page.

## Test it

The fragment is an ordinary response, so a route test asks for the frame's address and checks
that what comes back is a piece and not a page, and that the page names the island:

```tsx {% title="app/http/controllers/jobs/index.test.tsx" %}
import { expect, test } from "vitest";

import { router } from "~/app/router";
import { CLIENT_MODULES, PACKAGE_MODULES } from "~/bootstrap/client-modules";

function get(path: string) {
	return router.fetch(new Request(new URL(path, "https://app.com")));
}

test("defers the older page behind the link a scriptless browser follows", async () => {
	let body = await (await get("/jobs")).text();

	expect(body).toContain('<a href="/jobs?page=2">Older postings</a>');
	expect(body).toContain('"moduleUrl":"@sdxc/lazy-frame/ui"');
	expect(body).toContain('"src":"/jobs?page=2&frame"');
});

test("answers a frame with the rows alone", async () => {
	let response = await get("/jobs?page=2&frame");
	let body = await response.text();

	expect(response.headers.get("Content-Type")).toContain("text/html");
	expect(body).not.toContain("<!DOCTYPE");
	expect(body).not.toContain("<html");
	expect(body).toContain("<ol");
});

test("names every island by a module the browser entry can load", async () => {
	let body = await (await get("/jobs")).text();
	let islands = body.matchAll(/"exportName":"([^"]+)","moduleUrl":"([^"]+)"/g);

	for (let [, exportName = "", moduleUrl = ""] of islands) {
		let load = PACKAGE_MODULES[moduleUrl] ?? CLIENT_MODULES[`..${moduleUrl}`];
		expect(load, `nothing loads ${moduleUrl}`).toBeDefined();
		expect(Reflect.get((await load!()) as object, exportName)).toBeTypeOf(
			"function",
		);
	}
});
```

`router` is the app's router, built the way your other route tests build it. The last test
is the one that catches a missing map entry. Every other assertion still passes when the
browser cannot load the island, because the server writes the same HTML either way.

To test a component of your own that wraps `LazyFrame`, mount it in a DOM with
`remix/component/test` and answer its frames with `frameInit.resolveFrame`. The DOM has no
layout engine, so stand in for `IntersectionObserver` with one that reports the crossings the
test announces:

```tsx {% title="resources/views/jobs.test.tsx" %}
// @vitest-environment happy-dom

import { render } from "remix/component/test";
import { beforeAll, expect, test, vi } from "vitest";

import { JobList } from "./jobs";

let observed: { callback: IntersectionObserverCallback; targets: Set<Element> }[] =
	[];

class AnnouncedObserver {
	targets = new Set<Element>();
	constructor(callback: IntersectionObserverCallback) {
		observed.push({ callback, targets: this.targets });
	}
	observe(target: Element) {
		this.targets.add(target);
	}
	unobserve(target: Element) {
		this.targets.delete(target);
	}
	disconnect() {
		this.targets.clear();
	}
}

function approach(node: Element) {
	let entry = { target: node, isIntersecting: true } as IntersectionObserverEntry;
	for (let { callback, targets } of observed) {
		if (targets.has(node)) callback([entry], {} as IntersectionObserver);
	}
}

beforeAll(() => {
	vi.stubGlobal("IntersectionObserver", AnnouncedObserver);
	vi.spyOn(CSSStyleSheet.prototype, "insertRule").mockImplementation(() => 0);
});

test("loads the older page once the reader nears it", async () => {
	let page = { url: "/jobs", newer: null, older: "/jobs?page=2", rows: [] };
	let result = render(<JobList page={page} />, {
		frameInit: { resolveFrame: async (src) => `<p data-loaded>${src}</p>` },
	});

	let link = result.$('a[href="/jobs?page=2"]');
	expect(link?.textContent).toBe("Older postings");

	approach(link!.parentElement!);

	await vi.waitFor(() => expect(result.$("[data-loaded]")).not.toBeNull());
	expect(result.$("[data-loaded]")?.textContent).toBe("/jobs?page=2&frame");
});
```

The observers are matched by target, which is the frame's `<div>`. The `insertRule` stub is
there because happy-dom's stylesheet parser rejects the cascade layers `remix/component`
mixins write into, and no assertion here reads a style. Announcing a crossing on a
node the observer stopped watching does nothing, the same as a browser. A `loadOn="open"` frame
needs no observer at all: open the dialog with `showModal()` and dispatch a `toggle` event on
it.

## Where to go next

- [Build the interface with remix/component](/docs/building-remix-apps/interface-with-remix-ui)
  — dialogs, invoker commands and the islands this one sits beside.
- [Paginate lists](/docs/http-apis/paginate-lists) — the page parameters and the older and
  newer addresses each frame is given.
- [`@sdxc/lazy-frame`](/api/lazy-frame) — every prop and its default.
