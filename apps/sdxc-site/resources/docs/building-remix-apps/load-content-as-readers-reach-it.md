---
title: Load content as readers reach it
description: Defer a list's next page until the reader scrolls near it and a dialog's content until it opens, keep the address bar on the page being read, and keep plain links for browsers running no script.
section:
    title: Building Remix apps
    order: 4
order: 10
lastUpdated: 2026-10-25
outcomes:
    - "How to load a list's next page as the reader scrolls with `@sdxc/lazy-frame`"
    - "How to load a dialog's content only when it opens"
    - "How to keep plain links working for browsers running no script"
---

This guide builds a job board. The list of postings continues as the reader scrolls, and the
address bar follows them so a reload lands on the page they were reading.
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
bare specifier `@sdxc/lazy-frame/ui` into the page. An `import.meta.glob` over the app's own
directories cannot reach into `node_modules`, so give a package's islands an explicit map keyed
by that specifier, in a module a test can read:

```typescript {% title="config/client-modules.ts" %}
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

import { CLIENT_MODULES, PACKAGE_MODULES } from "~/config/client-modules";

run({
	async loadModule(moduleUrl, exportName) {
		let pathname = new URL(moduleUrl, location.origin).pathname;
		let load = PACKAGE_MODULES[moduleUrl] ?? CLIENT_MODULES[`..${pathname}`];
		if (!load) throw new Error(`Unknown client entry module: ${moduleUrl}`);
		return Reflect.get((await load()) as object, exportName);
	},
});
```

> [!WARNING]
> Miss this step and nothing fails loudly: the page renders, the island never mounts, and every
> reader gets the plain links. The last test in [Test it](#test-it) is the one that catches it.

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

While the request is in the air, `fallback` stands in, and it defaults to the children, so the
link stays put until the postings replace it. A frame asks for `src` once and keeps its content.

## Answer the frame with a fragment

The route answers `src` with the piece that goes inside the frame: no doctype, no `<html>`, no
layout. Mark a frame's address with a parameter of its own, `frame` here, so the page and its
fragment are two URLs and a cache keyed by URL never serves one in place of the other:

```typescript {% title="app/services/frame.ts" %}
export const FRAME_PARAM = "frame";

export function isFrameRequest(url: URL) {
	return url.searchParams.has(FRAME_PARAM);
}

export function frameOf(href: string) {
	return `${href}${href.includes("?") ? "&" : "?"}${FRAME_PARAM}`;
}
```

The list's action renders the whole page for a visit and only the rows for a frame:

```tsx {% title="app/http/controllers/jobs/index.tsx" %}
import { createAction } from "remix/router";

import Jobs from "~/app/models/job";
import { isFrameRequest } from "~/app/services/frame";
import { JobList, JobsPage } from "~/resources/views/jobs";
import routes from "~/routes/web";

export default createAction(routes.jobs.index, async (ctx) => {
	let page = await Jobs.page(ctx.db, ctx.url);

	if (isFrameRequest(ctx.url)) return ctx.render(<JobList page={page} />);

	return ctx.render(<JobsPage page={page} />);
});
```

`Jobs.page` is your own model. It reads the page from the query, as
[Paginate lists](/docs/http-apis/paginate-lists) shows, and answers the rows with the address
of this page and of the pages either side of it:

```typescript {% title="app/models/job.ts" %}
export interface JobPage {
	url: string;
	newer: string | null;
	older: string | null;
	rows: { id: string; title: string; company: string }[];
}
```

A fragment can hold islands of its own, `LazyFrame` among them, which is what lets the list
below go on for as many pages as there are.

## Load the next page as the reader scrolls

`loadOn` defaults to `"approach"`: the frame loads once it nears the viewport. Put one after
the rows, and since the fragment it fetches ends with a frame of its own, the list continues
page after page:

```tsx {% title="resources/views/jobs.tsx" %}
import type { Handle } from "remix/component";

import { LazyFrame } from "@sdxc/lazy-frame/ui";

import type { JobPage } from "~/app/models/job";

import { frameOf } from "~/app/services/frame";

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
`IntersectionObserver` syntax, and defaults to `"320px 0px"`. Widen it for rows that are slow to
answer.

## Keep the address bar on the page being read

A reader twenty pages down who reloads expects to land where they were, not back at the top.
Give a frame `url`, the address of the page it holds, and `parentUrl`, the address of the
page it sits in, and it keeps the address bar on whichever the reader is in:

```tsx {% title="resources/views/jobs.tsx" %}
<LazyFrame src={frameOf(page.older)} url={page.older} parentUrl={page.url}>
	<a href={page.older}>Older postings</a>
</LazyFrame>
```

The address bar moves to `url` once the frame's top passes the top of the viewport, and back to
`parentUrl` when the reader scrolls above it. The entry is replaced, so Back leaves the list in
one step.

## Load a dialog's content when it opens

A posting's full text is long, and most readers open few of them. With `loadOn="open"`, a frame
loads the first time the closest `<dialog>`, `<details>` or `[popover]` around it opens:

```tsx {% title="resources/views/job-row.tsx" %}
import type { Handle } from "remix/component";

import { LazyFrame } from "@sdxc/lazy-frame/ui";

import { frameOf } from "~/app/services/frame";

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

`opener` is the `id` of a link to the posting's own page. Once script runs, clicking it opens
the dialog and the reader stays on the list; without script the link navigates to `/jobs/:id`.
The posting's route answers the frame the same way the list does, with
`isFrameRequest(ctx.url)` choosing the fragment over the page.

## Test it

A route test asks for the frame's address and checks that what comes back is a piece and not a
page, and that the page names an island the browser entry can load:

```tsx {% title="app/http/controllers/jobs/index.test.tsx" %}
import { expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";
import { CLIENT_MODULES, PACKAGE_MODULES } from "~/config/client-modules";

let router = createWebRouter();

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

The last test is the one that catches a missing map entry: every other assertion still passes
when the browser cannot load the island, because the server writes the same HTML either way.

## Where to go next

- [Build the interface with remix/component](/docs/building-remix-apps/interface-with-remix-ui)
  — dialogs, invoker commands and the islands this one sits beside.
- [Paginate lists](/docs/http-apis/paginate-lists) — the page parameters and the older and
  newer addresses each frame is given.
- [`@sdxc/lazy-frame`](/api/lazy-frame) — every prop and its default.
