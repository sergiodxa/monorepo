/**
 * Wires up the app-wide dependency-injection container (ADR-008) and registers the
 * services every request, job and queue message resolves from: the D1-backed
 * `Database`, the Polar billing client, the five rate limiters, the mail transport and
 * the background mailer built on it. Request-lifetime values — session, current subject,
 * request logger — never live here; they belong to middleware and request context.
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
import { createDatabase, Database } from "remix/data-table";

import { MAIL_FROM, MAIL_REPLY_TO } from "~/app/emails/sender";
import { MailTransport } from "~/app/services/mail-transport";
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

/**
 * The billing client, holding {@link readPolarAccessToken} rather than a token: the
 * token is a Secrets Store binding, so reading it is asynchronous and a container
 * factory is not. Passing the function defers the read to the first call that actually
 * bills — which is only ever the provisioning of a brand-new subject — so the vast
 * majority of isolates never read the secret at all, and none of them read it at module
 * scope, where an await would fail the Worker's upload validation.
 */
container.singleton(PolarClient, () => new PolarClient({ accessToken: readPolarAccessToken }));

/**
 * Reads the Polar access token from the Secrets Store binding, falling back to the
 * plain `POLAR_ACCESS_TOKEN_LOCAL` variable.
 *
 * The fallback is what makes local development work: a Secrets Store binding resolves
 * against Cloudflare's network, and the local simulation of it is an empty store, so
 * `get()` there throws for a secret nobody put in it. Production has no such variable,
 * so a failure there stays a failure and is reported by the caller instead of being
 * quietly swallowed.
 *
 * Exported so the three outcomes can be asserted apart from a live billing call; the
 * client above is the only caller.
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
 * sweep — carrying the sender identity the mail middleware applies to request paths.
 *
 * HTTP handlers must not resolve this one: `ctx.email` is theirs, and only that mailer's
 * `later()` queue is flushed after the response. A message deferred on this one would sit
 * in the queue until the isolate is discarded, and never be sent.
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
