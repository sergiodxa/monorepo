/**
 * Wires up the app-wide dependency-injection container (ADR-008) and registers the
 * shared {@link Database} singleton backed by the production D1 database and the
 * shared {@link PolarClient} singleton for billing. Controllers, middleware, and jobs
 * resolve their dependencies from this container rather than constructing them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createD1DatabaseAdapter } from "@pkg/data-table-d1";
import { PolarClient } from "@pkg/polar";
import { ServiceContainer } from "@pkg/service-container";
import { env } from "cloudflare:workers";
import { createDatabase, Database } from "remix/data-table";
import { Resend } from "resend";

import { IdTokenVerificationKeyService } from "~/app/services/id-token-verification-key";

/**
 * The app service container (ADR-008). Registered once per isolate; the worker wraps
 * each unit of work in `container.scope(...)`, so controllers and jobs resolve
 * dependencies with `inject([Database, ...])` instead of ad-hoc construction.
 *
 * @example
 * await container.scope(() => router.fetch(request));
 */
export const container = new ServiceContainer();

// `now` is overridden to epoch-ms because `database/schema.ts` declares timestamp
// columns as `c.integer()` to match the frozen production schema; the library's
// default `now()` returns a `Date`, which D1 cannot bind.
container.singleton(Database, () =>
	createDatabase(createD1DatabaseAdapter(env.DB), { now: () => Date.now() }),
);
container.singleton(PolarClient, () => new PolarClient({ accessToken: env.POLAR_ACCESS_TOKEN }));
container.singleton(Resend, () => new Resend(env.RESEND_API_TOKEN));
container.singleton(IdTokenVerificationKeyService, () => new IdTokenVerificationKeyService());
