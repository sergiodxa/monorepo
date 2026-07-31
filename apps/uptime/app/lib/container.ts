/**
 * Wires up the app-wide dependency-injection container (ADR-008) and registers the
 * shared {@link Database} singleton backed by the production D1 database and the
 * shared {@link PolarClient} singleton for billing. Controllers, middleware, and jobs
 * resolve their dependencies from this container rather than constructing them.
 *
 * It also connects the database's per-statement row counts to the cost ledger (ADR-019,
 * ADR-007), which is what makes D1 cost measurable — and priceable — per job type.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { AuthSDK } from "@pkg/auth-sdk";
import { createD1DatabaseAdapter } from "@pkg/data-table-d1";
import { setJobUsageTracker } from "@pkg/jobs";
import { PolarClient } from "@pkg/polar";
import { ServiceContainer } from "@pkg/service-container";
import { env } from "cloudflare:workers";
import { createDatabase, Database } from "remix/data-table";
import { Resend } from "resend";

import { recordD1Statement, trackJobCost } from "~/app/services/cost";
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

/**
 * Every job's D1 row counts are attributed to that job (ADR-019): `Job.run` wraps a
 * job's lifecycle in this tracker, so the statements it issues land on its own
 * `job.completed` log line instead of being pooled across a queue batch — and, since the
 * accumulator is the cost ledger (ADR-007), get priced and recorded for that job's teams
 * when the job ends. Registered here because this module is what the worker imports to
 * build the container, and it is the only place that knows both the database and the
 * ledger.
 */
setJobUsageTracker(trackJobCost);

/**
 * `now` is overridden to epoch-ms because `database/schema.ts` declares timestamp
 * columns as `c.integer()` to match the frozen production schema; the library's
 * default `now()` returns a `Date`, which D1 cannot bind.
 *
 * `onStatement` costs no extra query: D1 already returns the row counts in every
 * response's `meta`, and the adapter already reads `meta` to normalise `affectedRows`.
 */
container.singleton(Database, () =>
	createDatabase(createD1DatabaseAdapter(env.DB, { onStatement: recordD1Statement }), {
		now: () => Date.now(),
	}),
);
container.singleton(PolarClient, () => new PolarClient({ accessToken: env.POLAR_ACCESS_TOKEN }));
container.singleton(Resend, () => new Resend(env.RESEND_API_TOKEN));
container.singleton(IdTokenVerificationKeyService, () => new IdTokenVerificationKeyService());
container.singleton(
	AuthSDK,
	() => new AuthSDK({ client: { id: env.CLIENT_ID, secret: env.CLIENT_SECRET } }),
);
