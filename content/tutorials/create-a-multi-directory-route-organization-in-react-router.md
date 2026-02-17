---
title: How to Create a Multi-Directory Route Organization in React Router
excerpt: Organize routes into sub-folders while keeping flat routes inside each folder.
tech: react-router@7.3.0 @react-router/fs-routes@7.3.0
---

As your application grows, a single `routes/` folder can become overwhelming. You might have public marketing pages, authenticated app routes, API endpoints, and [action routes](/tutorials/use-action-routes-in-react-router) all mixed together. Splitting routes into logical directories helps teams work independently and makes the codebase easier to navigate.

The key insight is that you can call `flatRoutes()` multiple times, once per directory, and combine the results. Each directory maintains flat route conventions internally while the overall structure stays organized. For even more control over route organization, see [how to split your routes config](/tutorials/split-routes-config-in-react-router).

## Set Up the Directory Structure

```txt
app/
├── routes/
│   ├── public/
│   │   ├── _index.tsx
│   │   ├── about.tsx
│   │   └── pricing.tsx
│   ├── app/
│   │   ├── _layout.tsx
│   │   ├── dashboard.tsx
│   │   └── settings.tsx
│   ├── api/
│   │   ├── users.ts
│   │   └── posts.ts
│   └── actions/
│       ├── user-update.ts
│       └── post-create.ts
└── routes.ts
```

Each sub-folder contains routes using the flat routes convention. The `public/` folder handles marketing pages, `app/` contains authenticated routes, `api/` exposes REST endpoints, and `actions/` centralizes form handlers.

## Configure Multiple Route Sources

```ts {% path="app/routes.ts" %}
import type { RouteConfig } from "@react-router/dev/routes";
import { prefix } from "@react-router/dev/routes";
import { flatRoutes } from "@react-router/fs-routes";

let [publicRoutes, appRoutes, apiRoutes, actionRoutes] = await Promise.all([
	flatRoutes({ rootDirectory: "./routes/public" }),
	flatRoutes({ rootDirectory: "./routes/app" }),
	flatRoutes({ rootDirectory: "./routes/api" }),
	flatRoutes({ rootDirectory: "./routes/actions" }),
]);

export default [
	...publicRoutes,
	...prefix("/app", appRoutes),
	...prefix("/api", apiRoutes),
	...prefix("/actions", actionRoutes),
] satisfies RouteConfig;
```

The `flatRoutes()` function scans each directory independently, so `app/dashboard.tsx` becomes `/app/dashboard` after the prefix is applied. Public routes have no prefix since they live at the root.

Using `Promise.all()` loads all directories in parallel, keeping startup time fast even with many route folders.

## Add Shared Layouts per Section

```tsx {% path="app/routes/app/_layout.tsx" %}
import { Outlet } from "react-router";

export default function AppLayout() {
	return (
		<div className="flex min-h-screen">
			<aside className="w-64 border-r">
				<nav>{/* App navigation */}</nav>
			</aside>
			<main className="flex-1 p-8">
				<Outlet />
			</main>
		</div>
	);
}
```

The `_layout.tsx` file creates a pathless layout route that wraps all routes in that directory. Routes in `app/` share this sidebar layout, while `public/` routes can have their own marketing layout.

## Apply Middleware to Route Groups

```ts {% path="app/routes.ts" %}
import type { RouteConfig } from "@react-router/dev/routes";
import { layout, prefix } from "@react-router/dev/routes";
import { flatRoutes } from "@react-router/fs-routes";

let [publicRoutes, appRoutes, apiRoutes, actionRoutes] = await Promise.all([
	flatRoutes({ rootDirectory: "./routes/public" }),
	flatRoutes({ rootDirectory: "./routes/app" }),
	flatRoutes({ rootDirectory: "./routes/api" }),
	flatRoutes({ rootDirectory: "./routes/actions" }),
]);

export default [
	...publicRoutes,
	layout("./middleware/auth.tsx", prefix("/app", appRoutes)),
	layout("./middleware/api.tsx", prefix("/api", apiRoutes)),
	...prefix("/actions", actionRoutes),
] satisfies RouteConfig;
```

The `layout()` function wraps route groups with a parent route. The `auth.tsx` middleware can check authentication for all `/app/*` routes, while `api.tsx` might handle API-specific concerns like rate limiting or JSON responses. If you're new to middleware, start with [the middleware basics](/tutorials/use-middleware-in-react-router).

## Handle Cross-Directory Dependencies

```tsx {% path="app/routes/app/posts.tsx" %}
import { useFetcher } from "react-router";

export default function Posts({ loaderData }: Route.ComponentProps) {
	let fetcher = useFetcher();

	return (
		<div>
			<h1>Posts</h1>
			<fetcher.Form method="post" action="/actions/post-create">
				<input name="title" placeholder="Post title" />
				<button type="submit">Create Post</button>
			</fetcher.Form>
		</div>
	);
}
```

Routes in one directory can reference routes in another using absolute paths. The form submits to `/actions/post-create`, which lives in the `actions/` directory. This keeps the action logic centralized while allowing any route to trigger it.

## Scale to Team Boundaries

For larger teams, you might organize by feature or team ownership:

```txt
app/
├── routes/
│   ├── marketing/      # Marketing team
│   ├── dashboard/      # Product team
│   ├── admin/          # Platform team
│   ├── api/            # API team
│   └── actions/        # Shared actions
└── routes.ts
```

Each team owns their directory and can add routes without merge conflicts. The `routes.ts` file acts as the central registry, making it clear which prefixes map to which directories.

This pattern scales well because adding a new section means adding one `flatRoutes()` call and one spread in the export, no restructuring of existing routes required.
