/**
 * Billing entry point. Owners get redirected to a hosted checkout session or the hosted
 * customer portal, based on subscription status; billing stays 100% platform-hosted.
 * Non-owners see a message, since only the owner can manage billing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { redirect } from "@pkg/http/response";
import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { border, fg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { vstack } from "@pkg/u/layout";
import { media } from "@pkg/u/responsive";
import { pb, pi } from "@pkg/u/size";
import { fontSize, textAlign } from "@pkg/u/typography";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import type { Viewer } from "~/app/http/middleware/auth";

import Customer from "~/app/data/customer";
import Subscription from "~/app/data/subscription";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

namespace BillingNotice {
	export interface Props {
		/** What the page has to say, already translated. */
		message: string;
	}
}

/**
 * The billing page with nothing to redirect to. It is the page's only rendered state, since
 * an owner with a working platform is redirected away before anything renders.
 */
function BillingNotice(handle: Handle<BillingNotice.Props>) {
	return () => (
		<div
			mix={[
				vstack({ gap: "12px", align: "center" }),
				textAlign("center"),
				pb("64px"),
				pi("32px"),
				border({ width: 1, style: "dashed", color: "oklch(0.83 0.011 250)" }),
				rounded("12px"),
				media("(prefers-color-scheme: dark)", border("oklch(0.42 0.012 250)")),
			]}
		>
			<p
				mix={[
					fontSize("0.8125rem"),
					fg("oklch(0.62 0.014 250)"),
					media("(prefers-color-scheme: dark)", fg("oklch(0.73 0.013 250)")),
				]}
			>
				{handle.props.message}
			</p>
		</div>
	);
}

/**
 * GET /app/:team/checkout — redirects the owner to platform-hosted billing. Subscription
 * status comes from the D1 projection (ADR-005); defaulting to checkout on an unknown answer
 * keeps the mistake recoverable.
 */
export default createAction(routes.app.team.checkout, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		if (ctx.membership.subject_id !== ctx.team.owner_id) {
			return notice(ctx.i18next.t("page.billing.ownerOnly"), viewer);
		}

		let hasActiveSubscription = await Subscription.isActive(db, ctx.team.owner_id);

		let opened = hasActiveSubscription
			? await Customer.portal(ctx.billing, ctx.team, ctx.url)
			: await Customer.checkout(ctx.billing, ctx.team, ctx.url);

		if (isFailure(opened)) {
			ctx.logger.error("billing.hosted_page_failed", {
				code: opened.error.code,
				providerCode: opened.error.providerCode,
				connection: opened.error.connection,
				ownerId: ctx.team.owner_id,
				subscribed: hasActiveSubscription,
			});

			return notice(ctx.i18next.t("page.billing.unavailable"), viewer);
		}

		return redirect(opened.data, { status: redirect.Status.SeeOther });

		/**
		 * Renders the page in place, which is what every non-redirecting outcome answers with.
		 * The viewer is a parameter because the guard above narrows it at the call, not inside
		 * this closure.
		 */
		function notice(message: string, signedIn: Viewer) {
			return ctx.render(
				<DocumentLayout title={`${ctx.team.name} · Billing`}>
					<AppShell
						team={ctx.team}
						currentPath={ctx.url.pathname}
						teams={ctx.teams}
						viewer={signedIn}
						isAdmin={ctx.membership.role === "admin"}
						i18next={ctx.i18next}
						heading={ctx.i18next.t("page.billing.header.title")}
					>
						<BillingNotice message={message} />
					</AppShell>
				</DocumentLayout>,
			);
		}
	}),
});
