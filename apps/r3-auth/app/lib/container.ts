/**
 * Wires up the app-wide dependency-injection container (ADR-008) and registers the
 * services every request, job and queue message resolves from: the D1-backed
 * `Database`, the Polar billing client, and the five rate limiters. Request-lifetime
 * values — session, current subject, request logger — never live here; they belong to
 * middleware and request context.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createD1DatabaseAdapter } from "@pkg/data-table-d1";
import { PolarClient } from "@pkg/polar";
import { ServiceContainer } from "@pkg/service-container";
import { env } from "cloudflare:workers";
import { createDatabase, Database } from "remix/data-table";

import RateLimiters from "~/app/services/rate-limiters";

/**
 * The app service container. Registered once per isolate; the worker wraps each unit
 * of work in `container.scope(...)`, so handlers resolve dependencies with
 * `inject([Database, ...])` instead of constructing them.
 *
 * @example
 * await container.scope(() => router.fetch(request));
 */
export const container = new ServiceContainer();

/**
 * `now` is overridden to epoch-ms because the timestamp columns are `c.integer()`
 * holding milliseconds since the epoch, matching the rows already in the database.
 * The library's default `now()` returns a `Date`, which D1 cannot bind — and which
 * would sort and compare wrongly against every existing row even if it could.
 */
container.singleton(Database, () =>
	createDatabase(createD1DatabaseAdapter(env.DB), { now: () => Date.now() }),
);

container.singleton(PolarClient, () => new PolarClient({ accessToken: env.POLAR_ACCESS_TOKEN }));

container.singleton(
	RateLimiters,
	() =>
		new RateLimiters({
			token: env.TOKEN_RATE_LIMITER,
			introspect: env.INTROSPECT_RATE_LIMITER,
			revoke: env.REVOKE_RATE_LIMITER,
			authorize: env.AUTHORIZE_RATE_LIMITER,
			login: env.LOGIN_RATE_LIMITER,
		}),
);
