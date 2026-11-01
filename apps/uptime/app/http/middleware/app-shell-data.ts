/**
 * Publishes what the signed-in shell shows on every page beside the screen itself: how many
 * monitors of each kind need attention, for the sidebar's counts, and whether the team's
 * billing has a problem, for the banner. Mapped on page routes only, after `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import type { AttentionCounts } from "~/app/models/attention-counts";

import { getViewer } from "~/app/http/middleware/auth";
import { attentionCounts } from "~/app/models/attention-counts";
import { hasBillingProblem } from "~/app/services/billing-problem";

/** What the shell reads beside the screen, published as `ctx.shell`. */
export interface AppShellData {
	attention: AttentionCounts;
	billingProblem: boolean;
	/** Whether the viewer owns the team, the one person who can fix a billing problem. */
	isOwner: boolean;
}

declare module "remix/router" {
	interface RequestContext {
		/** Set on page routes; a request without it draws the shell without counts or banner. */
		shell?: AppShellData;
	}
}

/**
 * Creates the middleware. Both reads run together, so a page pays for the slower of the two.
 *
 * @example middleware: [requireUser, requireTeam, appShellData()]
 */
export default function appShellData(): Middleware {
	return async (ctx, next) => {
		let [attention, billingProblem] = await Promise.all([
			attentionCounts(ctx.db, ctx.team.id),
			hasBillingProblem(ctx.models, ctx.team.owner_id),
		]);
		ctx.shell = { attention, billingProblem, isOwner: getViewer()?.id === ctx.team.owner_id };
		return next();
	};
}
