/**
 * Billing entry point. Owners get redirected to a hosted checkout session or the hosted
 * customer portal, based on subscription status; billing stays 100% platform-hosted.
 * Non-owners see a message, since only the owner can manage billing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { LinkButton } from "@sdxc/ui";
import { Empty } from "@sdxc/ui/app";
import { createAction } from "remix/router";

import type { Viewer } from "~/app/http/middleware/auth";

import { teamAccess } from "~/app/http/middleware/access";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import abilities from "~/app/policies/abilities";
import { openCheckout, openPortal } from "~/app/services/customer";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/**
 * Why the page rendered instead of redirecting: the viewer is not the owner, or the billing
 * platform opened no hosted page, which a retry may fix.
 */
type BillingNoticeKind = "permission" | "error";

/**
 * GET /app/:team/checkout — redirects the owner to platform-hosted billing. Subscription
 * status comes from the D1 projection; defaulting to checkout on an unknown answer
 * keeps the mistake recoverable.
 */
export default createAction(routes.app.team.checkout, {
	middleware: [requireUser, requireTeam, teamAccess],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		await ctx.access.load(abilities.billing.manage);
		if (!ctx.access.can(abilities.billing.manage)) {
			return notice("permission", ctx.intl.t("page.billing.ownerOnly"), viewer);
		}

		let hasActiveSubscription = await ctx.models.subscriptions.isActive(ctx.team.owner_id);

		let opened = hasActiveSubscription
			? await openPortal(ctx.billing, ctx.team, ctx.url)
			: await openCheckout(ctx.billing, ctx.team, ctx.url, ctx.attribution);

		if (isFailure(opened)) {
			ctx.log.warn("billing.hosted_page_failed", {
				code: opened.error.code,
				provider_code: opened.error.providerCode,
				connection: opened.error.connection,
				subscribed: hasActiveSubscription,
			});

			return notice("error", ctx.intl.t("page.billing.unavailable"), viewer);
		}

		return redirect(opened.data, { status: redirect.Status.SeeOther });

		/**
		 * Renders the page in place, which is what every non-redirecting outcome answers with: an
		 * empty state typed by its cause, with a retry for a platform failure. The viewer is a
		 * parameter because the guard above narrows it at the call, not inside this closure.
		 */
		function notice(kind: BillingNoticeKind, message: string, signedIn: Viewer) {
			return ctx.render(
				<DocumentLayout assets={ctx.assets} title={`${ctx.team.name} · Billing`}>
					<AppShell
						team={ctx.team}
						currentPath={ctx.url.pathname}
						teams={ctx.teams}
						viewer={signedIn}
						isAdmin={ctx.membership.role === "admin"}
						intl={ctx.intl}
						heading={ctx.intl.t("page.billing.header.title")}
					>
						<Empty kind={kind}>
							<Empty.Description>{message}</Empty.Description>
							{kind === "error" && (
								<Empty.Action>
									<LinkButton
										href={routes.app.team.checkout.href({ team: ctx.team.slug })}
										data-rmx-document=""
										variant="outline"
									>
										{ctx.intl.t("page.billing.retry")}
									</LinkButton>
								</Empty.Action>
							)}
						</Empty>
					</AppShell>
				</DocumentLayout>,
			);
		}
	},
});
