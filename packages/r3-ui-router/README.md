# @pkg/r3-ui-router

Client-side routing for Remix UI components using route contracts from `remix/routes`.

## Overview

`@pkg/r3-ui-router` experiments with the `remix/router` shape on the client. It maps route actions to Remix UI renderers and browser-side submissions while preserving `Request`, URL, params, and method context.

The package reuses `remix/routes` as the source of truth for URL patterns and `remix/route-pattern` for matching. Rendering is delegated to `remix/ui` through `createRoot`, so route handlers can return normal Remix UI JSX.

Route actions may be async. This lets a handler load the data needed to render the page before returning Remix UI. Mounted routers use the browser Navigation API when available, with a History API and same-origin link interception fallback for older browsers.

## Usage

### Basic Example

```tsx
import type { Handle } from "remix/ui";
import { route } from "remix/routes";

import { createAction, createRouter } from "@pkg/r3-ui-router";

const routes = route({
	home: "/",
	post: "/posts/:id",
});

function HomePage() {
	return () => <h1>Home</h1>;
}

interface Post {
	id: string;
	title: string;
}

function PostPage(handle: Handle<{ post: Post }>) {
	return () => <article>{handle.props.post.title}</article>;
}

const router = createRouter();

router.map(
	routes.home,
	createAction(routes.home, () => <HomePage />),
);
router.map(
	routes.post,
	createAction(routes.post, async (ctx) => {
		let post = await fetchPost(ctx.params.id);
		return <PostPage post={post} />;
	}),
);

const mounted = router.mount(document.body);
```

### Route Map Example

```tsx
import { route } from "remix/routes";

import { createController, createRouter } from "@pkg/r3-ui-router";

const routes = route({
	posts: {
		index: "/posts",
		show: "/posts/:id",
	},
});

const router = createRouter();

router.map(
	routes.posts,
	createController(routes.posts, {
		actions: {
			index() {
				return <h1>Posts</h1>;
			},

			show(ctx) {
				return <h1>Post {ctx.params.id}</h1>;
			},
		},
	}),
);
```

### Mutations and Fetchers

```tsx
import type { Handle } from "remix/ui";

import { addEventListeners, on } from "remix/ui";
import { form, route } from "remix/routes";

import {
	RouterProvider,
	createContextKey,
	createController,
	createRouter,
} from "@pkg/r3-ui-router";

const routes = route({
	contact: form("contact"),
});

interface ContactResult {
	ok: boolean;
	message?: string;
}

function ContactPage(handle: Handle) {
	let router = handle.context.get(RouterProvider);
	let fetcher = router.getFetcher<ContactResult>("contact");

	addEventListeners(fetcher, handle.signal, {
		change() {
			handle.update();
		},
	});

	return () => (
		<form method="POST" action={routes.contact.action.href()} mix={fetcher.form()}>
			<textarea name="message" />
			<button disabled={fetcher.state !== "idle"}>Send</button>
			{fetcher.data?.message ? <p>{fetcher.data.message}</p> : null}
		</form>
	);
}

const router = createRouter();

router.map(
	routes.contact,
	createController(routes.contact, {
		actions: {
			index() {
				return <ContactPage />;
			},

			async action(ctx) {
				let formData = await ctx.request.formData();

				return {
					ok: true,
					message: `You said ${formData.get("message")}`,
				} satisfies ContactResult;
			},
		},
	}),
);
```

### Middleware

Middleware can run globally on the router, on every direct action in a controller, or on a single action object. Middleware receives the same mutable context as actions and can either return a result to short-circuit or call `next()`.

```tsx
import { createAction, createContextKey, createController, createRouter } from "@pkg/r3-ui-router";

const CurrentUser = createContextKey<{ id: string }>();

const router = createRouter({
	middleware: [
		async (ctx, next) => {
			ctx.set(CurrentUser, { id: "user-1" });
			return next();
		},
	],
});

router.map(
	routes.admin,
	createController(routes.admin, {
		middleware: [
			(ctx, next) => {
				if (!ctx.get(CurrentUser)) return <ForbiddenPage />;
				return next();
			},
		],
		actions: {
			dashboard: createAction(routes.admin.dashboard, {
				middleware: [requireAdmin()],
				handler(ctx) {
					return <DashboardPage user={ctx.get(CurrentUser)!} />;
				},
			}),
		},
	}),
);
```

### Programmatic Navigation

```tsx
import { on } from "remix/ui";

router.map(routes.post, (ctx) => {
	return <button mix={on("click", () => ctx.navigate(routes.home.href()))}>Go home</button>;
});

router.navigate(routes.post.href({ id: "hello" }));
```

### Router Context

Every rendered route is wrapped in `RouterProvider`, a Remix UI component that exposes the router and the current route context to descendants.

```tsx
import type { Handle } from "remix/ui";

import { RouterProvider } from "@pkg/r3-ui-router";

function BackButton(handle: Handle) {
	let router = handle.context.get(RouterProvider);

	return () => <button mix={on("click", () => router.navigate("/"))}>Go home</button>;
}
```

The value returned by `handle.context.get(RouterProvider)` includes every router method plus `context`, `match`, `url`, `params`, and `route` for the current render.

### Frames

Mounted routers configure Remix UI's `<Frame>` resolver automatically. A frame `src` renders through the same route action pipeline as `router.render`, so middleware, request context, params, and route actions all work inside embedded routes. Components inside frames can call `handle.frame.reload()` or reload named frames with `handle.frames.get(name)?.reload()`.

```tsx
import { Frame, on, type Handle } from "remix/ui";

function Dashboard() {
	return () => (
		<section>
			<h1>Dashboard</h1>
			<Frame name="sidebar" src="/sidebar" fallback={<p>Loading sidebar...</p>} />
		</section>
	);
}

function Sidebar(handle: Handle) {
	return () => <button mix={on("click", () => handle.frame.reload())}>Reload sidebar</button>;
}
```

If `rootOptions.frameInit.resolveFrame` is provided, the router preserves that custom resolver instead of replacing it.

## API

### `createRouter(options?: RouterOptions): UIRouter`

Creates a client-side router that can map Remix route definitions to view handlers.

**Parameters:**

- `options.baseURL`: Base URL used when matching relative URLs outside a browser.
- `options.defaultElement`: Optional renderer used when no route matches.
- `options.createRoot`: Optional `remix/ui` root factory, useful for tests.
- `options.rootOptions`: Options forwarded to `remix/ui` `createRoot`.
- `options.getLocation`: Optional location reader for non-browser tests.
- `options.window`: Optional browser window adapter.
- `options.interceptLinks`: Whether `mount` should intercept same-origin links. Defaults to `true`.
- `options.middleware`: Global middleware that runs before matched route actions and default renders.

**Returns:**

- A `UIRouter` with `map`, `match`, `render`, `navigate`, `submit`, `getFetcher`, `revalidate`, `form`, and `mount` methods.

**Example:**

```tsx
const router = createRouter({
	defaultElement(ctx) {
		return <h1>Not found: {ctx.url.pathname}</h1>;
	},
});
```

### `router.map(route, handler): UIRouter`

Maps a single route definition to a view handler.

**Parameters:**

- `route`: A `Route` produced by `remix/routes`.
- `handler`: Function receiving `Context` and returning an action result. GET render actions should return a `RemixNode` or `Promise<RemixNode>`.

**Returns:**

- The same router, so calls can be chained.

**Example:**

```tsx
router.map(routes.post, async (ctx) => {
	let post = await fetchPost(ctx.params.id);
	return <PostPage post={post} />;
});
```

### `router.map(routeMap, controller): UIRouter`

Maps the direct route leaves in a route map to view handlers.

**Parameters:**

- `routeMap`: A branch from a `remix/routes` route map.
- `controller`: Object with an `actions` object for each direct leaf route. A bare action object is also accepted for small apps and existing call sites.
- `controller.middleware`: Optional middleware that runs for every direct action in the controller.

**Returns:**

- The same router, so calls can be chained.

**Example:**

```tsx
router.map(routes.posts, {
	actions: {
		index: () => <PostsPage />,
		show: (ctx) => <PostPage id={ctx.params.id} />,
	},
});
```

### `createAction(route, handler): ViewHandler`

Defines a route handler or action object while inferring `ctx.params` from the given route target. It returns the same value, so it is useful when route actions live in separate files before they are passed to `router.map`.

**Parameters:**

- `route`: A `Route` produced by `remix/routes`.
- `handler`: Function or action object receiving route-specific `Context` and returning an action result.

**Returns:**

- The same handler function.

**Example:**

```tsx
export const renderPost = createAction(routes.post, async (ctx) => {
	let post = await fetchPost(ctx.params.id);
	return <PostPage post={post} />;
});
```

Action objects can attach middleware to one route action:

```tsx
export const renderAdmin = createAction(routes.admin, {
	middleware: [requireAdmin()],
	handler(ctx) {
		return <AdminPage />;
	},
});
```

### `createController(routeMap, controller): UIController`

Defines direct route-map handlers while inferring `ctx.params` for each direct route leaf. It returns the same controller object.

**Parameters:**

- `routeMap`: A branch from a `remix/routes` route map.
- `controller`: Object with handlers for each direct leaf route.

**Returns:**

- The same controller object.

**Example:**

```tsx
export const postsController = createController(routes.posts, {
	actions: {
		index: () => <PostsPage />,
		show: (ctx) => <PostPage id={ctx.params.id} />,
	},
});
```

### `router.submit(target, options?): Promise<data | undefined>`

Submits data through an internal `Fetcher`, then navigates like a normal form submission. Redirect `Response` results navigate to their `Location`; other results navigate to the submitted route URL or revalidate when already on that URL.

### `router.getFetcher<data = unknown>(name?): Fetcher<data>`

Returns a fetcher for background route submissions. Named fetchers are shared by key; unnamed fetchers receive a unique key per call.

### `router.revalidate(): Promise<void>`

Re-runs the current route action for all mounted roots. Fetcher non-GET submissions call this after storing their result unless `revalidate: false` is passed.

### `router.form(options?): MixinDescriptor<HTMLFormElement>`

Returns a form mixin that intercepts same-page form submissions and submits through `router.submit`.

### `fetcher.submit(target, options?): Promise<void>`

Runs the matching route action without changing the current URL unless the action returns a redirect `Response`. The fetcher stores the result in `fetcher.data` and dispatches `change` events during state transitions.

### `fetcher.form(options?): MixinDescriptor<HTMLFormElement>`

Returns a form mixin that submits through the fetcher. This is the Remix UI equivalent of React Router's `fetcher.Form`.

### `router.match(input?: RouterInput): RouteMatch | null`

Finds the most specific mapped route for a URL without rendering it.

**Parameters:**

- `input`: URL string, `URL`, or object with a `url` property. Defaults to the current location.

**Returns:**

- A route match with `url`, `route`, and decoded `params`, or `null`.

**Example:**

```typescript
const match = router.match("/posts/hello");
match?.params.id; // "hello"
```

### `router.render(input?: RouterInput): Promise<RemixNode>`

Renders the matched handler for a URL without mounting it into the DOM. The returned node is wrapped in `RouterProvider`.

**Parameters:**

- `input`: URL string, `URL`, or object with a `url` property. Defaults to the current location.

**Returns:**

- A promise resolving to the provider-wrapped `RemixNode` returned by the matching handler, the default element, or `null`.

**Example:**

```typescript
const node = await router.render("/posts/hello");
```

### `router.navigate(to: RouterInput, options?: NavigateOptions): Promise<void>`

Updates the browser through the Navigation API when available and re-renders mounted roots from intercepted navigation events. Older browsers fall back to `history.pushState`/`replaceState` and explicit root refreshes. When `options.mask` is provided, the router renders `to` while showing `mask` in the address bar.

**Parameters:**

- `to`: Destination URL.
- `options.mask`: Optional visible URL to store in browser history while rendering `to`.
- `options.replace`: Use `history.replaceState` instead of `history.pushState`.
- `options.state`: Optional history state.

**Example:**

```typescript
await router.navigate(routes.post.href({ id: "hello" }));
await router.navigate(routes.home.href(), { replace: true });
await router.navigate("/album/1?photoId=7", { mask: "/photo/7" });
```

### `router.mount(container: HTMLElement): MountedRouter`

Mounts the router into a DOM element and renders the current location. Mounted routers listen for same-origin Navigation API events when available; otherwise they listen for `popstate` and intercept same-origin anchor clicks. Mounted roots also configure `rootOptions.frameInit.resolveFrame` so Remix UI frames can render and reload route content through this router.

**Parameters:**

- `container`: Element passed to `remix/ui` `createRoot`.

**Returns:**

- A mounted router controller with `render`, `navigate`, `flush`, and `dispose` methods.

**Example:**

```typescript
const mounted = router.mount(document.body);
await mounted.render(routes.post.href({ id: "hello" }));
mounted.dispose();
```

### Types

#### `RouterInput`

Accepts `string`, `URL`, or an object with a `url` property. The router resolves every input against `options.baseURL` or the current browser location.

#### `Awaitable<value>`

Accepts a direct value or a promise for that value. Route handlers and default elements use this so they can be sync or async.

#### `RouteTarget<pattern>`

Accepts a `Route` from `remix/routes` or a raw route-pattern string. Prefer `Route` values so params stay tied to the shared route contract.

#### `RoutePatternSource<route>`

Extracts the route-pattern string from a `RouteTarget`. This powers handler param inference.

#### `Context<params, route>`

Context passed to mapped route actions and middleware. It includes `request`, `url`, `method`, decoded `params`, the matched `route`, an abort `signal`, router helpers such as `navigate`, `submit`, `revalidate`, and `getFetcher`, plus `get`, `set`, and `has` for middleware-provided values.

#### `createContextKey(defaultValue?)`

Creates a key used by middleware and actions to store request-scoped values on `ctx`.

#### `Middleware`

Function that receives `(ctx, next)`. Return a value to short-circuit the chain, return `next()` to continue explicitly, or return `undefined` to continue automatically.

#### `ActionObject<route>`

Object form for one route action with optional `middleware` and a final `handler`.

#### `NotFoundContext`

Context passed to `options.defaultElement` when no mapped route matches. It includes `url`, `signal`, and `navigate`.

#### `ViewHandler<route>`

Function type for route actions. It receives `Context` with params inferred from the mapped route and can return UI, data, or a `Response`.

#### `Fetcher<data>`

Typed EventTarget used for background submissions. It exposes `state`, `data`, `formData`, `request`, `load`, `submit`, `form`, and `dispose`.

#### `SubmitOptions`

Options accepted by router and fetcher submissions. Use `action`, `method`, `encType`, `submitter`, and `revalidate` to control how a submission request is created.

#### `RouterProviderValue`

Value exposed by `RouterProvider` through Remix UI context. It includes all `UIRouter` methods plus `context`, `match`, `url`, `params`, and `route` for the current render.

#### `RouterProviderProps`

Props accepted by `RouterProvider`. This is mostly internal, but exported so the provider component has a complete public contract.

#### `RouterProvider`

Remix UI component that stores `RouterProviderValue` in component context. Descendants can read it with `handle.context.get(RouterProvider)`.

#### `UIController<routes>`

Object type for mapping direct route-map leaves. Each direct leaf route gets a handler with route-specific params.

#### `RouteMatch<route>`

Result returned by `router.match`. It includes `url`, `route`, and decoded `params`.

#### `RouterNavigation`

Small browser Navigation API adapter used by `mount` and `navigate`. Override it in tests when you need to simulate `navigation.navigate` and `navigate` events.

#### `RouterNavigationOptions`

Options forwarded to `navigation.navigate`, including `history` and `state`.

#### `RouterNavigationResult`

Result returned by `navigation.navigate`. The router awaits `finished` so intercepted route rendering completes before `router.navigate` resolves.

#### `RouterWindow`

Small browser window adapter used by `mount` and `navigate`. Override it in tests when you need to simulate `location`, `navigation`, `history`, and `popstate`.

#### `RouterOptions`

Options accepted by `createRouter` for URL resolution, default rendering, root creation, browser integration, and link interception.

#### `NavigateOptions`

Options accepted by `navigate`. Use `mask` for modal-style routes, `replace` to replace history, and `state` to store browser history state.

#### `MountedRouter`

Controller returned by `mount`. It can re-render one mounted root, navigate through the parent router, flush queued updates, and dispose listeners.

#### `UIRouter`

Router returned by `createRouter`. It exposes the public `map`, `match`, `render`, `navigate`, and `mount` methods.

## Pattern: Route Contracts First

Keep routes in one module and share them between server controllers and the client UI router:

```typescript
import { route } from "remix/routes";

export const routes = route({
	home: "/",
	post: "/posts/:id",
});
```

Server code can still use `remix/router` to return `Response` objects, while browser-only entry points can use `@pkg/r3-ui-router` to render Remix UI components for the same URL patterns.

## Tips

1. **Define routes once** - Use `remix/routes` as the shared contract and avoid hard-coded path strings in view handlers.
2. **Map direct leaves** - Route-map controllers only map direct leaf routes; nested route maps should be mapped explicitly.
3. **Keep handlers pure** - Prefer returning UI from `ctx` and move browser effects into component event handlers.
4. **Prefer platform navigation** - Mounted routers use `window.navigation` when available, so browser-driven navigations and programmatic router navigations share the same rendering path.
