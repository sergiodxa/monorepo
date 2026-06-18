---
title: How to Define Reusable Route Contracts with remix/routes
excerpt: Define one Remix route contract that powers links, redirects, and form actions without string URLs.
tech: remix@3.0.0-beta.4
---

Hard-coded URLs tend to spread fast. A link uses one string, a form action uses another, and a redirect rebuilds the same path again. Once route params enter the picture, those strings get harder to keep in sync.

`remix/routes` gives you one place for those URLs. The APIs are still beta in `remix@3.0.0-beta.4`, but they already make it easy to define a route once and reuse it for links, redirects, and method-aware actions.

## Define the Route Contract

The route contract should include every URL you want to share. This example uses a small gallery flow with an albums page, an album detail page, a POST route that jumps to an album, and a POST route that likes a photo.

```ts {% path="app/routes.ts" %}
import { route } from "remix/routes";

export const routes = route({
	home: "/",
	albums: "/albums",
	album: "/albums/:id",
	openAlbum: { method: "POST", pattern: "/albums/open" },
	likePhoto: {
		method: "POST",
		pattern: "/albums/:albumId/photos/:photoId/like",
	},
});
```

Each leaf becomes a route object with an `.href()` method. Routes with params need those params when you build the URL, and routes with a `method` keep that method when you register them with the router.

## Register the Contract Once

Next, register the route map with a router. This version also adds `renderWith(...)` from `remix/render-middleware`, which gives each controller action a `ctx.render(...)` method for HTML responses.

```tsx {% path="app/router.ts" %}
import type { RemixNode } from "remix/ui";

import { formData } from "remix/middleware/form-data";
import { renderWith } from "remix/render-middleware";
import { createController, createRouter } from "remix/router";
import { renderToString } from "remix/ui/server";

import { routes } from "./routes";

interface Album {
	id: number;
	title: string;
}

interface Photo {
	id: number;
	albumId: number;
	title: string;
}

let albums = [
	{ id: 1, title: "Morning Walk" },
	{ id: 2, title: "Studio Notes" },
	{ id: 3, title: "Weekend Drive" },
] satisfies Album[];

let photos = [
	{ id: 11, albumId: 1, title: "Bench" },
	{ id: 12, albumId: 1, title: "Trees" },
	{ id: 21, albumId: 2, title: "Camera" },
	{ id: 22, albumId: 2, title: "Desk" },
	{ id: 31, albumId: 3, title: "Road" },
] satisfies Photo[];

let likedPhotos = new Set<string>();

export let router = createRouter({
	middleware: [formData(), renderWith(createHtmlRenderer)],
});

function createHtmlRenderer() {
	return function render(node: RemixNode, init?: ResponseInit) {
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");

		return new Response(renderToString(node), { ...init, headers });
	};
}

function AlbumsPage(props: { albums: Album[] }) {
	return () => (
		<>
			<h1>Albums</h1>
			<form method="POST" action={routes.openAlbum.href()}>
				<label>
					Album ID
					<input name="albumId" type="number" min="1" max="3" value="1" />
				</label>
				<button type="submit">Open Album</button>
			</form>
			<ul>
				{props.albums.map((album) => (
					<li key={album.id}>
						<a href={routes.album.href({ id: String(album.id) })}>{album.title}</a>
					</li>
				))}
			</ul>
		</>
	);
}

function AlbumPage(props: { album: Album; photos: Photo[]; likedPhotos: Set<string> }) {
	return () => (
		<>
			<p>
				<a href={routes.albums.href()}>Back to albums</a>
			</p>
			<h1>{props.album.title}</h1>
			<ul>
				{props.photos.map((photo) => {
					let liked = props.likedPhotos.has(`${props.album.id}:${photo.id}`);

					return (
						<li key={photo.id}>
							<strong>{photo.title}</strong>
							<form
								method="POST"
								action={routes.likePhoto.href({
									albumId: String(props.album.id),
									photoId: String(photo.id),
								})}
							>
								<button type="submit">{liked ? "Liked" : "Like"}</button>
							</form>
						</li>
					);
				})}
			</ul>
		</>
	);
}

let galleryController = createController(routes, {
	actions: {
		home() {
			return Response.redirect(routes.albums.href(), 302);
		},

		albums(ctx) {
			return ctx.render(<AlbumsPage albums={albums} />);
		},

		album(ctx) {
			let params = ctx.params;
			let albumId = Number(params.id);
			let album = albums.find((item) => item.id === albumId);

			if (!album) {
				return new Response("Not Found", { status: 404 });
			}

			let albumPhotos = photos.filter((photo) => photo.albumId === album.id);

			return ctx.render(<AlbumPage album={album} photos={albumPhotos} likedPhotos={likedPhotos} />);
		},

		openAlbum(ctx) {
			let form = ctx.get(FormData);
			let albumId = String(form.get("albumId") ?? "1");
			return Response.redirect(routes.album.href({ id: albumId }), 303);
		},

		likePhoto(ctx) {
			let params = ctx.params;
			let key = `${params.albumId}:${params.photoId}`;
			likedPhotos.add(key);
			return Response.redirect(routes.album.href({ id: params.albumId }), 303);
		},
	},
});

router.map(routes, galleryController);
```

The key detail is `router.map(routes, galleryController)`. That one call connects the route map to the handlers, and `renderWith(...)` makes `ctx.render(...)` available anywhere a controller needs to return HTML.

## Render Links with `.href()`

The simplest win is link generation. Use `.href()` anywhere you would otherwise hand-write a path string.

```tsx {% path="app/router.ts" %}
// ... previous code

		albums(ctx) {
			return ctx.render(<AlbumsPage albums={albums} />);
		},
```

If you rename `/albums/:id` later, this updates in one place. TypeScript also makes you pass `id`, which removes a common cause of broken links.

## Redirect with the Same Contract

The same route map also works after a POST. Here, the albums page submits an album ID to `openAlbum`, and the action redirects to the main album URL.

```tsx {% path="app/router.ts" %}
// ... previous code

		albums(ctx) {
			return ctx.render(<AlbumsPage albums={albums} />);
		},

		openAlbum(ctx) {
			let form = ctx.get(FormData);
			let albumId = String(form.get("albumId") ?? "1");
			return Response.redirect(routes.album.href({ id: albumId }), 303);
		},
```

This keeps the POST endpoint and the target page separate. The form submits to `routes.openAlbum.href()`, and the redirect uses `routes.album.href(...)`, so each URL is still defined in one place.

The `303` status creates a normal POST, redirect, GET flow. That is usually what you want for form submissions because the browser lands on the GET route after the mutation or lookup finishes.

## Add a Parameterized Action Route

Now add a POST route with its own params. This is the part that usually turns string URLs into a maintenance problem, especially when forms are rendered inside lists.

```tsx {% path="app/router.ts" %}
// ... previous code

		album(ctx) {
			let params = ctx.params;
			let albumId = Number(params.id);
			let album = albums.find((item) => item.id === albumId);

			if (!album) {
				return new Response("Not Found", { status: 404 });
			}

			let albumPhotos = photos.filter((photo) => photo.albumId === album.id);

			return ctx.render(<AlbumPage album={album} photos={albumPhotos} likedPhotos={likedPhotos} />);
		},

		likePhoto(ctx) {
			let params = ctx.params;
			let key = `${params.albumId}:${params.photoId}`;
			likedPhotos.add(key);
			return Response.redirect(routes.album.href({ id: params.albumId }), 303);
		},
```

The form action now depends on both `albumId` and `photoId`, and `.href()` makes that clear. If you change the route pattern later, every call site still has to pass the new params, so mistakes show up early instead of turning into quiet runtime bugs.

This works well with the [action routes pattern](/tutorials/use-action-routes-in-react-router) too. The route map gives you one clear way to reference those action endpoints from anywhere in the app.

## Keep the Contract Close to the Surface Area

One trade-off is that a large app can end up with a very large route map. I usually keep route maps close to the part of the app that owns them, then combine them only when some shared part of the app really needs that.

```ts {% path="app/routes.ts" %}
import { route } from "remix/routes";

export const routes = route({
	home: "/",
	gallery: route("albums", {
		index: "/",
		show: "/:id",
		open: { method: "POST", pattern: "/open" },
		likePhoto: {
			method: "POST",
			pattern: "/:albumId/photos/:photoId/like",
		},
	}),
});
```

This version groups the gallery URLs under one key and keeps the same benefits. Use the flat or nested shape based on how often those routes change together.

## Final Thoughts

`remix/routes` is most useful when the same URL shows up in more than one place. A shared route map removes repeated strings, gives you typed params through `.href()`, and keeps GET pages and POST actions lined up.

The API is still beta in `remix@3.0.0-beta.4`, so some details may change. The main idea is already solid though: define the route once, and reuse it everywhere the app needs that path.
