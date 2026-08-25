/**
 * Wires up the app-wide dependency-injection container (ADR-008) and registers the
 * services every request, job and queue message resolves from: the D1-backed
 * `Database`, the Polar billing client, the five rate limiters, the mail transport and
 * the background mailer built on it. Request-lifetime values — session, current
 * subject, request logger — belong to middleware and request context.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createD1DatabaseAdapter } from "@pkg/data-table-d1";
import { Mailer } from "@pkg/mail";
import { CloudflareTransport } from "@pkg/mail/cloudflare";
import { PolarClient } from "@pkg/polar";
import { ServiceContainer } from "@pkg/service-container";
import { env } from "cloudflare:workers";
import { Database } from "remix/data-table";

import { MAIL_FROM, MAIL_REPLY_TO } from "~/app/emails/sender";
import { MailTransport } from "~/app/services/mail-transport";
import RateLimiters from "~/app/services/rate-limiters";

/**
 * The app service container. Registered once per isolate; the worker wraps each unit
 * of work in `container.scope(...)`, so handlers resolve their dependencies with
 * `inject([Database, ...])`.
 *
 * @example
 * await container.scope(() => router.fetch(request));
 */
export const container = new ServiceContainer();

/**
 * `now` is overridden to epoch-ms because the timestamp columns are `c.integer()` holding
 * milliseconds since the epoch, matching the rows already in the database: D1 binds an
 * integer, and integers sort and compare correctly against every row already stored.
 */
container.singleton(
	Database,
	() => new Database(createD1DatabaseAdapter(env.DB), { now: () => Date.now() }),
);

/**
 * The billing client holds {@link readPolarAccessToken}: the token is a Secrets Store
 * binding, read asynchronously, while a container factory is synchronous. Deferring the
 * read to the first call that bills keeps the await inside a request, where it is allowed.
 */
container.singleton(PolarClient, () => new PolarClient({ accessToken: readPolarAccessToken }));

/**
 * Reads the Polar access token from the Secrets Store binding, falling back to the plain
 * `POLAR_ACCESS_TOKEN_LOCAL` variable so local development works against the store's empty
 * local simulation. Production configures the binding alone, so a failure there is real.
 *
 * @returns The Polar API access token.
 * @throws {Error} When the binding cannot be read and no local value is configured.
 */
export async function readPolarAccessToken(): Promise<string> {
	try {
		return await env.POLAR_ACCESS_TOKEN.get();
	} catch (error) {
		let local = env.POLAR_ACCESS_TOKEN_LOCAL;
		if (local) return local;
		throw error;
	}
}

/**
 * How mail leaves this worker, registered once so both mailers agree on it: the
 * request-scoped mailer the mail middleware publishes resolves this key, and the
 * background {@link Mailer} below is built from it. Swapping providers is this line.
 */
container.singleton(MailTransport, () => new CloudflareTransport(env.EMAIL));

/**
 * Mailer for the send paths with no request behind them — a queue message or a scheduled
 * sweep — carrying the sender identity request paths use. HTTP handlers belong on
 * `ctx.email`, whose `later()` queue is the one flushed once the response is sent.
 */
container.singleton(
	Mailer,
	(scope) =>
		new Mailer({
			transport: scope.get(MailTransport),
			from: MAIL_FROM,
			replyTo: MAIL_REPLY_TO,
		}),
);

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
