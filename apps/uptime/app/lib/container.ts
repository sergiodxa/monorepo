/**
 * Wires up the app-wide dependency-injection container (ADR-008) that controllers, middleware
 * and jobs resolve their dependencies from, and connects the database's per-statement row
 * counts to the cost ledger (ADR-019, ADR-007), which makes D1 cost priceable per job type.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ManagementClient } from "@pkg/auth/management-client";
import { ServiceClient } from "@pkg/auth/service-client";
import { createD1DatabaseAdapter } from "@pkg/data-table-d1";
import { setJobUsageTracker } from "@pkg/jobs";
import { Mailer } from "@pkg/mail";
import { CloudflareTransport } from "@pkg/mail/cloudflare";
import { PolarClient } from "@pkg/polar";
import { ServiceContainer } from "@pkg/service-container";
import { env } from "cloudflare:workers";
import { Database } from "remix/data-table";

import { issuer } from "~/app/auth/issuer";
import { MAIL_FROM, MAIL_REPLY_TO } from "~/app/emails/sender";
import { recordD1Statement, trackJobCost } from "~/app/services/cost";

/**
 * The app service container (ADR-008). Registered once per isolate; the worker wraps
 * each unit of work in `container.scope(...)`, so controllers and jobs resolve
 * dependencies with `inject([Database, ...])`.
 *
 * @example
 * await container.scope(() => router.fetch(request));
 */
export const container = new ServiceContainer();

/**
 * Every job's D1 row counts are attributed to that job (ADR-019): `Job.run` wraps its
 * lifecycle in this tracker, so its statements land on its own `job.completed` log line
 * and get priced through the cost ledger (ADR-007) for that job's teams.
 */
setJobUsageTracker(trackJobCost);

/**
 * `now` is overridden to epoch-ms because `database/schema.ts` types timestamp columns
 * as `c.integer()`, and the library's default `now()` returns a `Date`, which D1 cannot
 * bind; `onStatement` reuses the row counts D1 already returns in `meta`.
 */
container.singleton(
	Database,
	() =>
		new Database(createD1DatabaseAdapter(env.DB, { onStatement: recordD1Statement }), {
			now: () => Date.now(),
		}),
);
container.singleton(PolarClient, () => new PolarClient({ accessToken: env.POLAR_ACCESS_TOKEN }));
/**
 * Mailer for the send paths with no request behind them — the check jobs and the
 * queue consumer — sharing the mail middleware's sender identity. Handlers use
 * `ctx.email` instead, since only that instance's `later()` queue flushes.
 */
container.singleton(
	Mailer,
	() =>
		new Mailer({
			transport: new CloudflareTransport(env.EMAIL),
			from: MAIL_FROM,
			replyTo: MAIL_REPLY_TO,
		}),
);
/**
 * Reads other people's profiles from the identity provider, for the surfaces that need
 * more than the signed-in viewer's own claims. It authenticates as this app itself, so the
 * two jobs with no request behind them reach it too.
 */
container.singleton(
	ManagementClient,
	() =>
		new ManagementClient(
			new ServiceClient(issuer(), {
				clientId: env.CLIENT_ID,
				clientSecret: env.CLIENT_SECRET,
			}),
		),
);
