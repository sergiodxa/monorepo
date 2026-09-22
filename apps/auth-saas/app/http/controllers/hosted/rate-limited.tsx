/**
 * The HTML a hosted screen's own rate limit denial renders, reusing the
 * `/u/error` screen's own card so a browser exhausting a form's budget sees
 * the same recognizable failure shape rather than a bare JSON body.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { HostedDocument } from "~/app/views/hosted/document";
import { ErrorPage } from "~/app/views/hosted/error";

/**
 * Renders the rate-limited state for a hosted form's own submission, at
 * `429` so the response already carries the status the rate limit
 * middleware's own headers land on.
 *
 * @param ctx - The request context (provides `render`, `locale` and `i18next`).
 * @returns The rendered page, at `429`.
 * @example
 * rateLimit({ ..., onLimit: (ctx) => renderRateLimitedPage(ctx) });
 */
export async function renderRateLimitedPage(ctx: RequestContext): Promise<Response> {
	let t = ctx.i18next.t;
	let correlationId = crypto.randomUUID();

	return ctx.render(
		<HostedDocument title={t("hostedError.title")} locale={ctx.locale}>
			<ErrorPage
				t={t}
				description={t("hostedError.tooManyAttempts")}
				correlationId={correlationId}
			/>
		</HostedDocument>,
		{ status: 429 },
	);
}
