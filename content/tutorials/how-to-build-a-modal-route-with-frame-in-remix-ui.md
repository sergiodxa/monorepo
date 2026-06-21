---
title: How to Build a Modal Route with Frame in Remix UI
excerpt: Build a photo modal route that keeps the grid visible while direct visits still render the standalone page.
tech: remix@3.0.0-beta.4
---

Modal routes are useful when a detail view should feel connected to a list. A photo gallery is the usual example. Clicking a photo should open it over the grid, but reloading that URL should still render the standalone photo page.

`Frame` fits this pattern well. The album route can keep the grid visible, while the photo route still exists as a real page on its own. `remix@3.0.0-beta.4` is still beta, so some details may change, but the idea is already clear.

## Define the Route Contracts

The route contract needs two URLs: one for the album page and one for the standalone photo page. The modal renders from the album route, while the address bar shows the photo route.

```ts {% path="app/routes.ts" %}
import { route } from "remix/routes";

export let routes = route({
	album: "/albums/:albumId",
	photo: "/photos/:photoId",
});
```

This gives you typed `href()` helpers for both URLs. `routes.album.href()` is for the real page behind the modal, and `routes.photo.href()` is for the masked URL and the `Frame` source.

## Create Some Shared Gallery Data

The album route needs the grid, and the photo route needs one selected photo. A tiny data module keeps the examples realistic without pulling in app-specific dependencies.

```ts {% path="app/data/gallery.ts" %}
export interface Album {
	id: string;
	title: string;
}

export interface Photo {
	id: string;
	albumId: string;
	title: string;
	thumbnailUrl: string;
	url: string;
}

let albums: Album[] = [{ id: "1", title: "Weekend in Lisbon" }];

let photos: Photo[] = [
	{
		id: "101",
		albumId: "1",
		title: "Streetcar",
		thumbnailUrl: "https://picsum.photos/id/1015/320/320",
		url: "https://picsum.photos/id/1015/1200/900",
	},
	{
		id: "102",
		albumId: "1",
		title: "Lookout",
		thumbnailUrl: "https://picsum.photos/id/1016/320/320",
		url: "https://picsum.photos/id/1016/1200/900",
	},
	{
		id: "103",
		albumId: "1",
		title: "Tile Wall",
		thumbnailUrl: "https://picsum.photos/id/1025/320/320",
		url: "https://picsum.photos/id/1025/1200/900",
	},
];

export function getAlbum(albumId: string) {
	return albums.find((album) => album.id === albumId) ?? null;
}

export function getAlbumPhotos(albumId: string) {
	return photos.filter((photo) => photo.albumId === albumId);
}

export function getPhoto(photoId: string) {
	return photos.find((photo) => photo.id === photoId) ?? null;
}
```

The key part is that both route modules read from the same data. The album route decides whether to show a modal, and the photo route decides whether it is rendering on its own or inside a `Frame`.

## Extract the Shared Photo Preview

The standalone route and the modal route should render the same photo card. Put that UI in one component so both modes stay in sync.

```tsx {% path="app/components/photo-preview.tsx" %}
import type { Handle, RemixNode } from "remix/ui";

import { css } from "remix/ui";

import type { Photo } from "../data/gallery";

export interface PhotoPreviewProps {
	actions?: RemixNode;
	photo: Photo;
}

export function PhotoPreview(handle: Handle<PhotoPreviewProps>) {
	return () => (
		<article
			mix={css({
				display: "grid",
				gap: "1rem",
				padding: "1rem",
				borderRadius: "1.5rem",
				background: "white",
				boxShadow: "0 1rem 3rem rgb(0 0 0 / 0.18)",
			})}
		>
			<img
				mix={css({ display: "block", width: "100%", height: "auto", borderRadius: "1rem" })}
				src={handle.props.photo.url}
				alt={handle.props.photo.title}
			/>
			<div>
				<p mix={css({ margin: 0, fontSize: "0.875rem", color: "#64748b" })}>
					Album {handle.props.photo.albumId}
				</p>
				<h2 mix={css({ margin: 0, fontSize: "2rem" })}>{handle.props.photo.title}</h2>
			</div>
			{handle.props.actions ?? null}
		</article>
	);
}
```

This component does not care where it renders. That is what keeps the modal route pattern simple. The route module decides the shell, and the shared preview decides the content.

## Open the Photo Over the Album

Now build the album route module. It keeps the grid visible, tracks the selected photo, and uses `history.pushState()` so the address bar shows the standalone photo URL.

```tsx {% path="app/routes/album.tsx" %}
import type { Handle } from "remix/ui";

import { Frame, css, on } from "remix/ui";

import type { Album, Photo } from "../data/gallery";

import { routes } from "../routes";

export interface AlbumRouteProps {
	album: Album;
	photos: Photo[];
	initialPhotoId?: string | null;
}

interface MaskState {
	actualUrl: string;
}

export function AlbumRoute(handle: Handle<AlbumRouteProps>) {
	let selectedPhotoId = handle.props.initialPhotoId ?? null;
	let albumUrl = routes.album.href({ albumId: handle.props.album.id });

	handle.queueTask((signal) => {
		history.replaceState(
			{ actualUrl: window.location.href } satisfies MaskState,
			"",
			window.location.href,
		);

		function syncFromHistory() {
			let state = history.state as MaskState | null;
			let actualUrl = state?.actualUrl ?? window.location.href;
			let url = new URL(actualUrl, window.location.origin);
			selectedPhotoId = url.searchParams.get("photoId");
			handle.update();
		}

		window.addEventListener("popstate", syncFromHistory, { signal });
		syncFromHistory();
	});

	function openPhoto(photoId: string) {
		let actualUrl = new URL(albumUrl, window.location.origin);
		actualUrl.searchParams.set("photoId", photoId);

		history.pushState(
			{ actualUrl: actualUrl.href } satisfies MaskState,
			"",
			routes.photo.href({ photoId }),
		);

		selectedPhotoId = photoId;
		handle.update();
	}

	function closePhoto() {
		history.back();
	}

	return () => {
		let selectedPhoto = handle.props.photos.find((photo) => photo.id === selectedPhotoId) ?? null;

		return (
			<main mix={css({ padding: "2rem", display: "grid", gap: "1.5rem" })}>
				<header>
					<p mix={css({ margin: 0, color: "#64748b" })}>Album {handle.props.album.id}</p>
					<h1 mix={css({ margin: 0, fontSize: "2.5rem" })}>{handle.props.album.title}</h1>
				</header>

				<section
					aria-label={`Photos in ${handle.props.album.title}`}
					mix={css({
						display: "grid",
						gridTemplateColumns: "repeat(auto-fill, minmax(12rem, 1fr))",
						gap: "1rem",
					})}
				>
					{handle.props.photos.map((photo) => (
						<a
							key={photo.id}
							href={routes.photo.href({ photoId: photo.id })}
							mix={[
								css({
									display: "grid",
									gap: "0.75rem",
									color: "inherit",
									textDecoration: "none",
								}),
								on<HTMLAnchorElement, "click">("click", (event) => {
									event.preventDefault();
									openPhoto(photo.id);
								}),
							]}
						>
							<img
								mix={css({ display: "block", width: "100%", height: "auto", borderRadius: "1rem" })}
								src={photo.thumbnailUrl}
								alt={photo.title}
							/>
							<span>{photo.title}</span>
						</a>
					))}
				</section>

				{selectedPhoto ? (
					<div
						role="presentation"
						mix={[
							css({
								position: "fixed",
								inset: 0,
								display: "grid",
								placeItems: "center",
								padding: "1rem",
								background: "rgb(15 23 42 / 0.72)",
								backdropFilter: "blur(12px)",
							}),
							on<HTMLDivElement, "click">("click", (event) => {
								if (event.target === event.currentTarget) closePhoto();
							}),
						]}
					>
						<div
							role="dialog"
							aria-modal="true"
							aria-label={selectedPhoto.title}
							mix={css({ width: "min(100%, 64rem)", position: "relative" })}
						>
							<Frame
								name="selected-photo"
								src={routes.photo.href({ photoId: selectedPhoto.id })}
								fallback={
									<div mix={css({ padding: "2rem", color: "white" })}>Loading photo...</div>
								}
							/>

							<button
								type="button"
								mix={[
									css({
										position: "absolute",
										top: "1rem",
										right: "1rem",
										padding: "0.75rem 1rem",
										border: 0,
										borderRadius: "999rem",
										background: "rgb(255 255 255 / 0.92)",
										cursor: "pointer",
									}),
									on<HTMLButtonElement, "click">("click", () => closePhoto()),
								]}
							>
								Close
							</button>
						</div>
					</div>
				) : null}
			</main>
		);
	};
}
```

There are two important ideas here.

First, the album route does not navigate away. It keeps rendering the grid and stores the real album URL in `history.state.actualUrl`. Second, the modal content comes from `<Frame src="/photos/:photoId" />`, so the detail view still has its own route module and data loading boundary.

## Render the Photo Route in Two Modes

The photo route module should render one layout when visited directly and a lighter layout when it is rendered inside the album modal.

```tsx {% path="app/routes/photo.tsx" %}
import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type { Photo } from "../data/gallery";

import { PhotoPreview } from "../components/photo-preview";

export interface PhotoRouteProps {
	photo: Photo;
}

export function PhotoRoute(handle: Handle<PhotoRouteProps>) {
	return () => {
		let currentPath = new URL(handle.frame.src, "https://example.com").pathname;
		let topPath = new URL(handle.frames.top.src, "https://example.com").pathname;
		let isStandalone = currentPath === topPath;

		if (isStandalone) {
			return (
				<main mix={css({ padding: "2rem" })}>
					<header mix={css({ marginBlockEnd: "1.5rem" })}>
						<p mix={css({ margin: 0, color: "#64748b" })}>Standalone Photo Route</p>
						<h1 mix={css({ margin: 0, fontSize: "2.5rem" })}>{handle.props.photo.title}</h1>
					</header>
					<PhotoPreview photo={handle.props.photo} />
				</main>
			);
		}

		return <PhotoPreview photo={handle.props.photo} />;
	};
}
```

This is what makes reloads work. When the browser requests `/photos/101` directly, the top frame is the photo route, so the route renders as a full page. When the album route embeds `/photos/101` inside `Frame`, the top frame is still the album URL, so the photo route renders only the inner card.

## Resolve Frames on the Server

`Frame` needs a server renderer that knows how to resolve its `src`. If you already use `renderToStream()`, the change is small. Pass `frameSrc`, keep `topFrameSrc`, and return the nested route HTML from `resolveFrame()`.

```tsx {% path="app/entry.server.tsx" %}
import type { RemixNode } from "remix/ui";

import { renderToStream } from "remix/ui/server";

interface RenderOptions {
	frameSrc?: string;
	topFrameSrc?: string;
}

export async function renderRouteResponse(
	request: Request,
	node: RemixNode,
	resolveRoute: (url: URL) => Promise<RemixNode>,
	options: RenderOptions = {},
) {
	async function renderNode(url: URL, topFrameSrc: string) {
		let nextNode = await resolveRoute(url);

		return renderToStream(nextNode, {
			frameSrc: url.href,
			topFrameSrc,
			signal: request.signal,
			async resolveFrame(src, _target, context) {
				let frameUrl = new URL(src, context?.currentFrameSrc ?? request.url);
				return renderNode(frameUrl, context?.topFrameSrc ?? topFrameSrc);
			},
		});
	}

	let stream = renderToStream(node, {
		frameSrc: options.frameSrc ?? request.url,
		topFrameSrc: options.topFrameSrc ?? request.url,
		signal: request.signal,
		async resolveFrame(src, _target, context) {
			let frameUrl = new URL(src, context?.currentFrameSrc ?? request.url);
			return renderNode(frameUrl, context?.topFrameSrc ?? request.url);
		},
	});

	return new Response(stream, {
		headers: { "Content-Type": "text/html; charset=utf-8" },
	});
}
```

The key detail is `topFrameSrc`. The photo route needs it to know whether it is the main document or framed content. If you drop that value while resolving nested frames, `handle.frames.top.src` will stop reflecting the outer document.

## Load the Right Route Module

Your route handlers only need to fetch data and choose which Remix UI route module to render. The album route can optionally read `photoId` from the real URL, which is useful if you ever navigate to `/albums/1?photoId=101` without masking.

```tsx {% path="app/server/routes.tsx" %}
import { getAlbum, getAlbumPhotos, getPhoto } from "../data/gallery";
import { AlbumRoute } from "../routes/album";
import { PhotoRoute } from "../routes/photo";

export async function resolveRoute(url: URL) {
	if (url.pathname.startsWith("/albums/")) {
		let albumId = url.pathname.split("/").at(-1) ?? "";
		let album = getAlbum(albumId);

		if (!album) {
			throw new Response("Album not found", { status: 404 });
		}

		return (
			<AlbumRoute
				album={album}
				photos={getAlbumPhotos(albumId)}
				initialPhotoId={url.searchParams.get("photoId")}
			/>
		);
	}

	if (url.pathname.startsWith("/photos/")) {
		let photoId = url.pathname.split("/").at(-1) ?? "";
		let photo = getPhoto(photoId);

		if (!photo) {
			throw new Response("Photo not found", { status: 404 });
		}

		return <PhotoRoute photo={photo} />;
	}

	throw new Response("Not found", { status: 404 });
}
```

This keeps the route decision on the server and the modal decision in the UI. That split is what makes direct visits and reloads behave correctly without special cases.

## Final Thoughts

`Frame` gives you a clean split between the background route and the focused route. The album stays mounted, the photo keeps its own route module, and reloads still work because the visible URL is the real photo route.

This pattern does add some history work on the client. The trade-off is worth it when the detail view should feel tied to the list, but still needs a real URL that can work on its own.
