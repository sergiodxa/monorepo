# @sdxc/lazy-frame

A `remix/component` frame that loads its page once the reader reaches it, by scrolling near it or by opening the dialog around it.

## Installation

```sh
npm add @sdxc/lazy-frame
```

It renders through [`remix`](https://www.npmjs.com/package/remix) 3, which the app installs alongside it.

## Usage

### Load a page as the reader scrolls near it

`LazyFrame` renders its `children` on the server and keeps them until the frame nears the viewport; then it mounts a `Frame` for `src`. A browser running no script keeps the children, so make them the plain link to the same content.

```tsx
import { LazyFrame } from "@sdxc/lazy-frame/ui";

<LazyFrame src="/posts?page=2&frame">
	<a href="/posts?page=2">Older posts</a>
</LazyFrame>;
```

### Load a page when its dialog opens

With `loadOn="open"`, the frame loads the first time the closest `<dialog>`, `<details>` or `[popover]` around it opens. `opener` turns the link to the same content into that dialog's control once script runs.

```tsx
import { LazyFrame } from "@sdxc/lazy-frame/ui";

<a id="job-1" href="/jobs/1">
	Read more
</a>

<dialog>
	<LazyFrame src="/jobs/1?frame" loadOn="open" opener="job-1" fallback="Loading…">
		<a href="/jobs/1">Read the full posting</a>
	</LazyFrame>
</dialog>;
```

### Register the client entry

`LazyFrame` is a client entry named `@sdxc/lazy-frame/ui#LazyFrame`, so the browser entry's `loadModule` resolves that specifier:

```typescript
import { run } from "remix/component";

let modules: Record<string, () => Promise<unknown>> = {
	"@sdxc/lazy-frame/ui": () => import("@sdxc/lazy-frame/ui"),
};

run({
	async loadModule(moduleUrl, exportName) {
		let load = modules[moduleUrl];
		if (!load) throw new Error(`Unknown client entry module: ${moduleUrl}`);
		return Reflect.get((await load()) as object, exportName);
	},
});
```

## API

### `<LazyFrame src loadOn? rootMargin? fallback? url? parentUrl? sitsAbove? opener?>`

From `@sdxc/lazy-frame/ui`, also its default export. Renders `children` inside a `<div>` until the reader reaches it, then a `Frame` for `src` with `fallback` (or `children`) covering the request. A loaded frame keeps its content when it scrolls away or its container closes.

- `src`: where the content is fetched from.
- `loadOn`: `"approach"` (the default) loads once the frame nears the viewport, through an [`IntersectionObserver`](https://developer.mozilla.org/docs/Web/API/IntersectionObserver); `"open"` loads the first time the closest `<dialog>`, `<details>` or `[popover]` around it opens, or at once when it is already open.
- `rootMargin`: how far around the viewport an approaching frame starts its fetch, in `rootMargin` syntax. Defaults to `"320px 0px"`.
- `fallback`: what stands in while the request is in the air. Defaults to `children`.
- `url` and `parentUrl`: the address of the page the frame holds, and of the page it sits in. Given both, the address bar's entry is replaced with `url` once the frame's top passes the top tenth of the viewport, and with `parentUrl` when the reader scrolls back above it, so a reload resumes where they had read to. Nested frames settle on the deepest one reached.
- `sitsAbove`: marks a frame placed above content the reader already sees. It loads once the reader has scrolled past it and come back, and scrolls the page by what it adds so the content under their eyes stays put.
- `opener`: with `loadOn="open"`, the `id` of a link that, once script runs, opens the frame's container and stays on the page.

### Types

#### `LazyFrameProps`

The props above, declared as a `type` so they satisfy the serializable props a client entry is checked against.

#### `LazyFrameContent`

What `children` and `fallback` accept: one element, text, a number, a boolean, or `null`.

## Pattern: A list that pages in both directions

Each page renders its rows between two frames: one above for the newer page, one below for the older. Frames nest, since each fetched page carries its own pair, and the address bar follows the reader through them.

```tsx
import { LazyFrame } from "@sdxc/lazy-frame/ui";

interface Page {
	url: string;
	newer: string | null;
	older: string | null;
	rows: { id: string; title: string }[];
}

function frameOf(url: string) {
	return `${url}${url.includes("?") ? "&" : "?"}frame`;
}

function PostsPage() {
	return ({ page }: { page: Page }) => (
		<div>
			{page.newer && (
				<LazyFrame src={frameOf(page.newer)} url={page.newer} parentUrl={page.url} sitsAbove>
					<a href={page.newer}>Newer posts</a>
				</LazyFrame>
			)}

			<ol>
				{page.rows.map((row) => (
					<li key={row.id}>{row.title}</li>
				))}
			</ol>

			{page.older && (
				<LazyFrame src={frameOf(page.older)} url={page.older} parentUrl={page.url}>
					<a href={page.older}>Older posts</a>
				</LazyFrame>
			)}
		</div>
	);
}
```

## Pattern: Details behind a disclosure or popover

A `<details>` or a `[popover]` loads its body the first time it opens, so a page of collapsed sections fetches only the ones the reader expands. The `fallback` covers the request; the `children` stay the scriptless link.

```tsx
import { LazyFrame } from "@sdxc/lazy-frame/ui";

<details>
	<summary>Changelog</summary>
	<LazyFrame src="/changelog?frame" loadOn="open" fallback="Loading changelog…">
		<a href="/changelog">Read the changelog</a>
	</LazyFrame>
</details>

<button popovertarget="profile">Profile</button>
<div id="profile" popover>
	<LazyFrame src="/users/1/card?frame" loadOn="open" fallback="Loading…">
		<a href="/users/1">View profile</a>
	</LazyFrame>
</div>;
```

## Pattern: Below-the-fold sections fetched early

A long page renders its first screen on the server and leaves heavier sections to frames. A wider `rootMargin` starts each fetch further ahead, so the content is in place by the time the reader scrolls to it.

```tsx
import { LazyFrame } from "@sdxc/lazy-frame/ui";

function ProductPage() {
	return ({ id }: { id: string }) => (
		<main>
			<h1>Product</h1>

			<LazyFrame src={`/products/${id}/reviews?frame`} rootMargin="800px 0px">
				<a href={`/products/${id}/reviews`}>Read the reviews</a>
			</LazyFrame>

			<LazyFrame src={`/products/${id}/related?frame`} rootMargin="800px 0px">
				<a href={`/products/${id}/related`}>See related products</a>
			</LazyFrame>
		</main>
	);
}
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/lazy-frame": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
