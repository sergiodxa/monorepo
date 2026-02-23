---
title: How to Create a Per-Request Database Instance with Middleware
excerpt: Create a database instance when the request starts and close it when it ends.
tech: react-router@7.9.0 @react-router/fs-routes@7.0.0
---

Some database clients need explicit lifecycle management. You might need to open a connection at the start of a request and close it at the end, or you want to wrap all database operations in a transaction that commits on success and rolls back on error.

React Router middleware runs code both before and after your loaders and actions execute, making it the perfect place to handle this setup and teardown pattern. If you're new to middleware, see [the middleware basics](/tutorials/use-middleware-in-react-router) first.

## Create the Database Context

```ts {% path="app/context/database.ts" %}
import { createContext } from "react-router";
import type { Database } from "~/lib/database";

export let databaseContext = createContext<Database>();
```

The context holds a typed reference to your database instance. Using `createContext` ensures type safety when getting and setting the value.

## Build the Middleware with Cleanup

```ts {% path="app/middleware/database.ts" %}
import type { MiddlewareFunction } from "react-router";
import { databaseContext } from "~/context/database";
import { createDatabase } from "~/lib/database";

export let databaseMiddleware: MiddlewareFunction = async ({ context }, next) => {
	let db = createDatabase();

	try {
		context.set(databaseContext, db);
		return await next();
	} finally {
		await db.close();
	}
};
```

The middleware creates a fresh database instance, stores it in context, then calls `next()` to run the rest of the request. The `finally` block ensures `db.close()` runs whether the request succeeds or throws an error.

This pattern guarantees cleanup even when a loader throws, a validation fails, or an unexpected error occurs.

## Add the Middleware to Routes

```tsx {% path="app/routes/users.tsx" %}
import { databaseMiddleware } from "~/middleware/database";

export let middleware = [databaseMiddleware];

export async function loader({ context }: Route.LoaderArgs) {
	let db = context.get(databaseContext);
	let users = await db.query("SELECT * FROM users");
	return { users };
}
```

Export the middleware array from any route that needs database access. The middleware runs before the loader, so `context.get(databaseContext)` always returns a valid instance.

For a related pattern that creates instances without cleanup logic, see [how to create a per-request singleton with middleware](/tutorials/create-a-per-request-singleton-with-react-router-middleware).

## Apply to All Routes with a Layout

```ts {% path="app/routes.ts" %}
import type { RouteConfig } from "@react-router/dev/routes";
import { layout } from "@react-router/dev/routes";
import { flatRoutes } from "@react-router/fs-routes";

export default [layout("./middleware/with-database.tsx", await flatRoutes())] satisfies RouteConfig;
```

```tsx {% path="app/middleware/with-database.tsx" %}
import { Outlet } from "react-router";
import { databaseMiddleware } from "~/middleware/database";

export let middleware = [databaseMiddleware];

export default function WithDatabase() {
	return <Outlet />;
}
```

Wrapping all routes in a layout with the middleware means every loader and action gets database access automatically. The layout component just renders an `Outlet` since it only exists to attach the middleware.

## Wrap Requests in a Transaction

```ts {% path="app/middleware/transaction.ts" %}
import type { MiddlewareFunction } from "react-router";
import { databaseContext } from "~/context/database";
import { createDatabase } from "~/lib/database";

export let transactionMiddleware: MiddlewareFunction = async ({ context }, next) => {
	let db = createDatabase();
	await db.beginTransaction();

	try {
		context.set(databaseContext, db);
		let response = await next();
		await db.commit();
		return response;
	} catch (error) {
		await db.rollback();
		throw error;
	} finally {
		await db.close();
	}
};
```

This variant starts a transaction before the request and commits it after. If anything throws, the transaction rolls back and the error propagates. The `finally` block still closes the connection regardless of the outcome.

Use this when you need atomic operations across multiple database calls within a single request.

## Access the Database in Actions

```tsx {% path="app/routes/users.new.tsx" %}
import { redirect } from "react-router";
import { databaseContext } from "~/context/database";
import { transactionMiddleware } from "~/middleware/transaction";

export let middleware = [transactionMiddleware];

export async function action({ request, context }: Route.ActionArgs) {
	let db = context.get(databaseContext);
	let formData = await request.formData();

	let user = await db.query("INSERT INTO users (name) VALUES (?)", [formData.get("name")]);

	await db.query("INSERT INTO audit_log (action, user_id) VALUES (?, ?)", [
		"user_created",
		user.id,
	]);

	return redirect(`/users/${user.id}`);
}
```

Both inserts happen within the same transaction. If the audit log insert fails, the user creation rolls back too. The redirect only happens after a successful commit.

This lifecycle pattern works for any resource that needs setup and teardown: database connections, external API clients with session tokens, or temporary files that need cleanup. To ensure your middleware behaves correctly, learn [how to test middleware](/tutorials/test-middleware-in-react-router).
