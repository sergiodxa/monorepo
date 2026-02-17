---
title: How to Access Request Context Anywhere with AsyncLocalStorage
excerpt: Use AsyncLocalStorage to access the request and context from anywhere in your app.
technologies: react-router@7.6.0 remix-utils@9.0.0
---

Imagine calling `getUser()` from anywhere in your application without passing `context` as a parameter. No prop drilling through five layers of functions, no verbose signatures cluttered with context arguments. Just call the function and get the current user.

AsyncLocalStorage makes this possible by storing values in a request-scoped storage that any function can access during that request's lifecycle. Combined with [React Router middleware](/tutorials/use-middleware-in-react-router), you can set up the context once and retrieve it anywhere: in loaders, actions, helper functions, or deep utility modules.

## Set Up the Context Storage Middleware

Create a middleware file that uses `createContextStorageMiddleware` from Remix Utils. This function returns a tuple with the middleware and two getter functions:

```ts {% path="app/middleware/context-storage.ts" %}
import { createContextStorageMiddleware } from "remix-utils/middleware/context-storage";

export const [contextStorageMiddleware, getContext, getRequest] = createContextStorageMiddleware();
```

The `contextStorageMiddleware` stores the `context` and `request` in AsyncLocalStorage when a request comes in. The `getContext` and `getRequest` functions retrieve them from anywhere in your code during that request.

## Add the Middleware to Your Root Route

Add the context storage middleware to your root route. It should be one of the first middlewares in the chain so other middlewares can use the getter functions:

```tsx {% path="app/root.tsx" %}
import { contextStorageMiddleware } from "~/middleware/context-storage";
import { loggerMiddleware } from "~/middleware/logger";
import { sessionMiddleware } from "~/middleware/session";
import { databaseMiddleware } from "~/middleware/database";

export const middleware = [
	contextStorageMiddleware,
	loggerMiddleware,
	sessionMiddleware,
	databaseMiddleware,
];
```

The order matters: `contextStorageMiddleware` must run before any middleware that calls `getContext()` or `getRequest()`.

## Create Helper Functions That Use the Context

Now you can create helper functions that access the context without requiring it as a parameter. Here's an example for accessing a database singleton:

```ts {% path="app/middleware/database.ts" %}
import { createSingletonMiddleware } from "remix-utils/middleware/singleton";

import { createDatabase } from "~/db";

import { getBindings } from "./bindings";
import { getContext } from "./context-storage";

const [databaseMiddleware, getDBFromContext] = createSingletonMiddleware({
	instantiator() {
		return createDatabase(getBindings().DB);
	},
});

export function getDB() {
	let context = getContext();
	return getDBFromContext(context);
}

export { databaseMiddleware };
```

The `getDB()` function retrieves the context internally and returns the database instance. Callers don't need to know about the context at all.

## Access the Request from Anywhere

You can also access the current request from anywhere using `getRequest()`. This is useful for building URLs or reading headers:

```ts {% path="app/lib/url.ts" %}
import { getRequest } from "~/middleware/context-storage";

export function buildAbsoluteUrl(path: string) {
	let request = getRequest();
	return new URL(path, request.url).toString();
}
```

This pattern is particularly useful in query functions or services that need request information but shouldn't require it as a parameter.

## Wrap Session Access with Context Storage

Here's how to wrap session access so you can call `getSession()` or `getUser()` from anywhere:

```ts {% path="app/middleware/session.ts" %}
import { createSessionMiddleware } from "remix-utils/middleware/session";

import { getContext } from "./context-storage";

const [sessionMiddleware, getSessionFromContext] = createSessionMiddleware(
	sessionStorage,
	(prev, next) => prev.user?.id !== next.user?.id,
);

export function getSession() {
	let context = getContext();
	return getSessionFromContext(context);
}

export function getUser() {
	let session = getSession();
	return session.get("user");
}

export { sessionMiddleware };
```

Now any part of your application can call `getUser()` without passing context through multiple layers.

## Use in Loaders and Actions

With this setup, your loaders and actions become much cleaner:

```ts {% path="app/routes/posts.tsx" %}
import type { Route } from "./+types/posts";
import { getDB } from "~/middleware/database";
import { getUser } from "~/middleware/session";

export async function loader({}: Route.LoaderArgs) {
	let user = getUser();
	let db = getDB();

	let posts = await db.query.posts.findMany({
		where: (posts, { eq }) => eq(posts.authorId, user?.id),
	});

	return { posts };
}
```

No need to destructure `context` or pass it around. The helper functions handle everything internally.

## Final Thoughts

AsyncLocalStorage provides a clean way to access request-scoped values anywhere in your application. This pattern works well for databases, sessions, loggers, and any other per-request resources. The trade-off is that it creates implicit dependencies, so use it judiciously for truly cross-cutting concerns rather than for every piece of data. For an alternative approach that keeps dependencies explicit, see [dependency injection in loaders and actions](/articles/dependency-injection-in-remix-loaders-and-actions).
