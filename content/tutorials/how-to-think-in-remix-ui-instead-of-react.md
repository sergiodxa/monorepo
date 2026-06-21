---
title: How to Approach UI Design in Remix UI
excerpt: Build a small gallery and learn Handle, render closures, context, and manual updates in Remix UI.
tech: remix@3.0.0-beta.4
---

If you come to `remix/ui` from React, the first big shift is that a component is not a function that runs again on every state change. In Remix UI, the component function runs once, sets up state and behavior, and returns a render closure that runs again when you call `handle.update()`.

That changes how you build interactive UI. Instead of hooks, you keep local variables in setup scope, read props from `handle.props`, share state with `handle.context`, and choose when the UI should update. `remix/ui` is still beta in `remix@3.0.0-beta.4`, but this model is already useful.

This example uses a small photo gallery island that can switch between grid and list views while also showing the selected photo in a preview panel.

## Render the Gallery Island

The server-rendered page only needs to pass serializable data into a client entry. The data is plain JSON, and the interactive behavior lives in the gallery component.

```tsx {% path="app/ui/home.tsx" %}
import { css } from "remix/ui";

import { GalleryDemo } from "../assets/gallery-demo";

let photos = [
	{
		id: 1,
		title: "Quiet Morning",
		location: "Kyoto",
		src: "https://images.example.com/quiet-morning.jpg",
	},
	{
		id: 2,
		title: "After Rain",
		location: "Porto",
		src: "https://images.example.com/after-rain.jpg",
	},
	{
		id: 3,
		title: "Soft Light",
		location: "Seoul",
		src: "https://images.example.com/soft-light.jpg",
	},
];

export function HomePage() {
	return () => (
		<main
			mix={css({
				maxWidth: "72rem",
				margin: "0 auto",
				padding: "3rem 1.5rem",
			})}
		>
			<h1>Remix UI Gallery</h1>
			<p>Pick a photo and switch layouts without reaching for React hooks.</p>
			<GalleryDemo photos={photos} />
		</main>
	);
}
```

This file stays simple. It renders HTML on the server and passes a `photos` array to the interactive island.

## Create the Render Closure

The gallery component is where this model becomes easier to see.

```tsx {% path="app/assets/gallery-demo.tsx" %}
import type { Handle } from "remix/ui";

import { clientEntry, css } from "remix/ui";

export interface Photo {
	id: number;
	title: string;
	location: string;
	src: string;
}

export interface GalleryDemoProps {
	photos: Photo[];
}

export let GalleryDemo = clientEntry(import.meta.url, function GalleryDemo(
	handle: Handle<GalleryDemoProps>,
) {
	return () => <GalleryScope photos={handle.props.photos} />;
});

function GalleryScope(handle: Handle<GalleryDemoProps>) {
	let selectedId = handle.props.photos[0]?.id ?? null;

	return () => (
		<section
			mix={css({
				display: "grid",
				gap: "1.5rem",
				marginBlockStart: "2rem",
			})}
		>
			<p>Selected photo: {selectedId ?? "none"}</p>
		</section>
	);
}
```

`GalleryDemo` is a `clientEntry`, so it renders on the server and hydrates in the browser. The key part is `GalleryScope`: the function runs once, sets `selectedId`, and returns a render closure.

That render closure reads from `handle.props` and any setup-scope variables you keep around. If one of those variables changes, nothing happens until you call `handle.update()`.

## Update Local UI Explicitly

Add a view toggle next. This is the part that usually breaks the React mental model.

```tsx {% path="app/assets/gallery-demo.tsx" %}
import type { Handle } from "remix/ui";

import { clientEntry, css, on } from "remix/ui";

// ... previous code

function GalleryScope(handle: Handle<GalleryDemoProps>) {
	let view: "grid" | "list" = "grid";
	let selectedId = handle.props.photos[0]?.id ?? null;

	return () => (
		<section
			mix={css({
				display: "grid",
				gap: "1.5rem",
				marginBlockStart: "2rem",
			})}
		>
			<button
				type="button"
				mix={on("click", () => {
					view = view === "grid" ? "list" : "grid";
					handle.update();
				})}
			>
				Switch to {view === "grid" ? "list" : "grid"} view
			</button>
			<p>Selected photo: {selectedId ?? "none"}</p>
		</section>
	);
}
```

`view` is just a local variable. The click handler mutates it, then `handle.update()` reruns the render closure so the button label can reflect the new value.

That is the main habit to build in Remix UI. Mutation is allowed, but rendering is still manual.

## Share State Through Context

The gallery needs more than one interactive child, so passing props through every layer would get noisy fast. Use `handle.context` to let child components read and change shared state.

```tsx {% path="app/assets/gallery-demo.tsx" %}
import type { Handle } from "remix/ui";

import { clientEntry, css, on } from "remix/ui";

export interface Photo {
	id: number;
	title: string;
	location: string;
	src: string;
}

export interface GalleryDemoProps {
	photos: Photo[];
}

interface GalleryContextValue {
	readonly view: "grid" | "list";
	readonly selectedId: number | null;
	select(id: number): void;
	toggleView(): void;
}

export let GalleryDemo = clientEntry(import.meta.url, function GalleryDemo(
	handle: Handle<GalleryDemoProps>,
) {
	return () => <GalleryScope photos={handle.props.photos} />;
});

function GalleryScope(handle: Handle<GalleryDemoProps, GalleryContextValue>) {
	let view: "grid" | "list" = "grid";
	let selectedId = handle.props.photos[0]?.id ?? null;

	let gallery: GalleryContextValue = {
		get view() {
			return view;
		},
		get selectedId() {
			return selectedId;
		},
		select(id) {
			selectedId = id;
			handle.context.set(gallery);
			handle.update();
		},
		toggleView() {
			view = view === "grid" ? "list" : "grid";
			handle.context.set(gallery);
			handle.update();
		},
	};

	handle.context.set(gallery);

	return () => (
		<section
			mix={css({
				display: "grid",
				gap: "1.5rem",
				marginBlockStart: "2rem",
			})}
		>
			<GalleryToolbar count={handle.props.photos.length} />
			<div
				mix={css({
					display: "grid",
					gridTemplateColumns: "minmax(0, 2fr) minmax(18rem, 1fr)",
					gap: "1.5rem",
					alignItems: "start",
					"@media (max-width: 900px)": {
						gridTemplateColumns: "1fr",
					},
				})}
			>
				<PhotoList photos={handle.props.photos} />
				<SelectedPhoto photos={handle.props.photos} />
			</div>
		</section>
	);
}

interface GalleryToolbarProps {
	count: number;
}

function GalleryToolbar(handle: Handle<GalleryToolbarProps>) {
	let gallery = handle.context.get(GalleryScope);

	return () => (
		<header
			mix={css({
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				gap: "1rem",
				flexWrap: "wrap",
			})}
		>
			<p mix={css({ margin: 0 })}>
				{handle.props.count} photos, {gallery.view} view
			</p>
			<button type="button" mix={on("click", () => gallery.toggleView())}>
				Switch to {gallery.view === "grid" ? "list" : "grid"} view
			</button>
		</header>
	);
}
```

Two details matter here.

Child components call `handle.context.get(GalleryScope)`, not `get("gallery")` or some string key. Context is keyed by component identity, so the provider is the component itself.

Second, `handle.context.set()` only stores the value. It does not rerender anything by itself. That is why `select()` and `toggleView()` both end with `handle.update()`.

## Read Shared State From Child Components

Add the list and preview panel now. These components read shared state from context and combine it with their own props.

```tsx {% path="app/assets/gallery-demo.tsx" %}
// ... previous code

interface PhotoListProps {
	photos: Photo[];
}

function PhotoList(handle: Handle<PhotoListProps>) {
	let gallery = handle.context.get(GalleryScope);

	return () => (
		<ul
			mix={css({
				display: "grid",
				gridTemplateColumns:
					gallery.view === "grid"
						? "repeat(auto-fit, minmax(min(100%, 14rem), 1fr))"
						: "1fr",
				gap: "1rem",
				margin: 0,
				padding: 0,
				listStyle: "none",
			})}
		>
			{handle.props.photos.map((photo) => (
				<li key={photo.id}>
					<PhotoCard photo={photo} />
				</li>
			))}
		</ul>
	);
}

interface PhotoCardProps {
	photo: Photo;
}

function PhotoCard(handle: Handle<PhotoCardProps>) {
	let gallery = handle.context.get(GalleryScope);

	return () => {
		let isSelected = gallery.selectedId === handle.props.photo.id;

		return (
			<button
				type="button"
				mix={[
					css({
						display: "grid",
						gap: "0.75rem",
						width: "100%",
						padding: "1rem",
						border: isSelected ? "2px solid #2563eb" : "1px solid #cbd5e1",
						borderRadius: "1rem",
						background: isSelected ? "#eff6ff" : "#ffffff",
						textAlign: "left",
						cursor: "pointer",
						font: "inherit",
					}),
					on("click", () => gallery.select(handle.props.photo.id)),
				]}
			>
				<img
					mix={css({
						display: "block",
						width: "100%",
						aspectRatio: "4 / 3",
						objectFit: "cover",
						borderRadius: "0.75rem",
					})}
					src={handle.props.photo.src}
					alt={handle.props.photo.title}
				/>
				<span>{handle.props.photo.title}</span>
				<small>{handle.props.photo.location}</small>
			</button>
		);
	};
}

interface SelectedPhotoProps {
	photos: Photo[];
}

function SelectedPhoto(handle: Handle<SelectedPhotoProps>) {
	let gallery = handle.context.get(GalleryScope);

	return () => {
		let photo =
			handle.props.photos.find((photo) => photo.id === gallery.selectedId) ?? null;

		if (!photo) {
			return <aside>No photo selected.</aside>;
		}

		return (
			<aside
				mix={css({
					padding: "1rem",
					border: "1px solid #cbd5e1",
					borderRadius: "1rem",
					background: "#f8fafc",
				})}
			>
				<p mix={css({ margin: "0 0 0.5rem" })}>Selected photo</p>
				<h2 mix={css({ margin: 0 })}>{photo.title}</h2>
				<p>{photo.location}</p>
				<img
					mix={css({
						display: "block",
						width: "100%",
						borderRadius: "0.75rem",
					})}
					src={photo.src}
					alt={photo.title}
				/>
			</aside>
		);
	};
}
```

This is where `handle.props` becomes more useful than destructured values. `PhotoCard` always reads the latest `handle.props.photo`, and `SelectedPhoto` combines current props with current context in the render closure.

In React, you would usually think in terms of state setters and re-rendered function bodies. In Remix UI, you think in terms of setup state plus a render closure that reads the latest values when you ask it to.

## Hydrate the Client Entry

The component will not become interactive until you boot the browser runtime. Add a small entry file that hydrates every `clientEntry` on the page.

```ts {% path="app/assets/entry.ts" %}
import { run } from "remix/ui";

await run({
	async loadModule(moduleUrl, exportName) {
		let mod = await import(moduleUrl);
		return mod[exportName];
	},
});
```

If your app already uses `run`, you only need to make sure this new component is exported through `clientEntry`. The server HTML still works without JavaScript, and the island becomes interactive after hydration.

## Put the Full Example Together

Here is the complete gallery file in one place.

```tsx {% path="app/assets/gallery-demo.tsx" %}
import type { Handle } from "remix/ui";

import { clientEntry, css, on } from "remix/ui";

export interface Photo {
	id: number;
	title: string;
	location: string;
	src: string;
}

export interface GalleryDemoProps {
	photos: Photo[];
}

interface GalleryContextValue {
	readonly view: "grid" | "list";
	readonly selectedId: number | null;
	select(id: number): void;
	toggleView(): void;
}

export let GalleryDemo = clientEntry(import.meta.url, function GalleryDemo(
	handle: Handle<GalleryDemoProps>,
) {
	return () => <GalleryScope photos={handle.props.photos} />;
});

function GalleryScope(handle: Handle<GalleryDemoProps, GalleryContextValue>) {
	let view: "grid" | "list" = "grid";
	let selectedId = handle.props.photos[0]?.id ?? null;

	let gallery: GalleryContextValue = {
		get view() {
			return view;
		},
		get selectedId() {
			return selectedId;
		},
		select(id) {
			selectedId = id;
			handle.context.set(gallery);
			handle.update();
		},
		toggleView() {
			view = view === "grid" ? "list" : "grid";
			handle.context.set(gallery);
			handle.update();
		},
	};

	handle.context.set(gallery);

	return () => (
		<section
			mix={css({
				display: "grid",
				gap: "1.5rem",
				marginBlockStart: "2rem",
			})}
		>
			<GalleryToolbar count={handle.props.photos.length} />
			<div
				mix={css({
					display: "grid",
					gridTemplateColumns: "minmax(0, 2fr) minmax(18rem, 1fr)",
					gap: "1.5rem",
					alignItems: "start",
					"@media (max-width: 900px)": {
						gridTemplateColumns: "1fr",
					},
				})}
			>
				<PhotoList photos={handle.props.photos} />
				<SelectedPhoto photos={handle.props.photos} />
			</div>
		</section>
	);
}

interface GalleryToolbarProps {
	count: number;
}

function GalleryToolbar(handle: Handle<GalleryToolbarProps>) {
	let gallery = handle.context.get(GalleryScope);

	return () => (
		<header
			mix={css({
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				gap: "1rem",
				flexWrap: "wrap",
			})}
		>
			<p mix={css({ margin: 0 })}>
				{handle.props.count} photos, {gallery.view} view
			</p>
			<button
				type="button"
				mix={[
					css({
						padding: "0.75rem 1rem",
						border: "1px solid #cbd5e1",
						borderRadius: "999rem",
						background: "#ffffff",
						cursor: "pointer",
						font: "inherit",
					}),
					on("click", () => gallery.toggleView()),
				]}
			>
				Switch to {gallery.view === "grid" ? "list" : "grid"} view
			</button>
		</header>
	);
}

interface PhotoListProps {
	photos: Photo[];
}

function PhotoList(handle: Handle<PhotoListProps>) {
	let gallery = handle.context.get(GalleryScope);

	return () => (
		<ul
			mix={css({
				display: "grid",
				gridTemplateColumns:
					gallery.view === "grid"
						? "repeat(auto-fit, minmax(min(100%, 14rem), 1fr))"
						: "1fr",
				gap: "1rem",
				margin: 0,
				padding: 0,
				listStyle: "none",
			})}
		>
			{handle.props.photos.map((photo) => (
				<li key={photo.id}>
					<PhotoCard photo={photo} />
				</li>
			))}
		</ul>
	);
}

interface PhotoCardProps {
	photo: Photo;
}

function PhotoCard(handle: Handle<PhotoCardProps>) {
	let gallery = handle.context.get(GalleryScope);

	return () => {
		let isSelected = gallery.selectedId === handle.props.photo.id;

		return (
			<button
				type="button"
				mix={[
					css({
						display: "grid",
						gap: "0.75rem",
						width: "100%",
						padding: "1rem",
						border: isSelected ? "2px solid #2563eb" : "1px solid #cbd5e1",
						borderRadius: "1rem",
						background: isSelected ? "#eff6ff" : "#ffffff",
						textAlign: "left",
						cursor: "pointer",
						font: "inherit",
					}),
					on("click", () => gallery.select(handle.props.photo.id)),
				]}
			>
				<img
					mix={css({
						display: "block",
						width: "100%",
						aspectRatio: "4 / 3",
						objectFit: "cover",
						borderRadius: "0.75rem",
					})}
					src={handle.props.photo.src}
					alt={handle.props.photo.title}
				/>
				<span>{handle.props.photo.title}</span>
				<small>{handle.props.photo.location}</small>
			</button>
		);
	};
}

interface SelectedPhotoProps {
	photos: Photo[];
}

function SelectedPhoto(handle: Handle<SelectedPhotoProps>) {
	let gallery = handle.context.get(GalleryScope);

	return () => {
		let photo =
			handle.props.photos.find((photo) => photo.id === gallery.selectedId) ?? null;

		if (!photo) {
			return <aside>No photo selected.</aside>;
		}

		return (
			<aside
				mix={css({
					padding: "1rem",
					border: "1px solid #cbd5e1",
					borderRadius: "1rem",
					background: "#f8fafc",
				})}
			>
				<p mix={css({ margin: "0 0 0.5rem" })}>Selected photo</p>
				<h2 mix={css({ margin: 0 })}>{photo.title}</h2>
				<p>{photo.location}</p>
				<img
					mix={css({
						display: "block",
						width: "100%",
						borderRadius: "0.75rem",
					})}
					src={photo.src}
					alt={photo.title}
				/>
			</aside>
		);
	};
}
```

This file shows the Remix UI mental model in one place. `Handle` is the component API, setup-scope variables hold local state, `handle.props` gives you the latest serializable inputs, `handle.context` lets child components share state without too much prop passing, and `handle.update()` is the moment you ask Remix UI to rerender.

## Final Thoughts

Thinking in Remix UI means splitting setup from rendering. Once that clicks, patterns like the gallery above feel direct because the state lives in plain variables, shared behavior lives in context, and updates happen when you ask for them.

This model gives you more control than React hooks, but it also asks you to do more by hand. That trade-off is usually worth it when you want server rendering first and only hydrate the parts that need it.
