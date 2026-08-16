/**
 * Billing entry point. Owners get redirected to a hosted Polar checkout session (no
 * active subscription) or the hosted customer portal (already subscribed) — billing
 * is 100% Polar-hosted. Non-owners see a message instead of a redirect: only the
 * owner can manage billing. This intentionally has no usage-quantities view for
 * non-owners, since `@pkg/polar` has no equivalent to the raw SDK's
 * `meters.quantities` call — a team-usage view would be a bigger, separate feature,
 * not a one-line addition.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { PolarClient } from "@pkg/polar";
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

import Customer from "~/app/data/customer";
import Subscription from "~/app/data/subscription";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** GET /app/:team/checkout — redirects the owner to Polar-hosted billing. */
export default createAction(routes.app.team.checkout, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database, PolarClient] as const, async (db, polar) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		if (ctx.membership.subject_id !== ctx.team.owner_id) {
			return ctx.render(
				<DocumentLayout title={`${ctx.team.name} · Billing`}>
					<AppShell
						team={ctx.team}
						currentPath={ctx.url.pathname}
						teams={ctx.teams}
						viewer={viewer}
						isAdmin={ctx.membership.role === "admin"}
						i18next={ctx.i18next}
						heading={ctx.i18next.t("page.billing.header.title")}
					>
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
								{ctx.i18next.t("page.billing.ownerOnly")}
							</p>
						</div>
					</AppShell>
				</DocumentLayout>,
			);
		}

		// The D1 projection, not Polar (ADR-005): an unknown answer sends the owner to
		// checkout, which is the recoverable half of getting this wrong.
		let hasActiveSubscription = await Subscription.isActive(db, ctx.team.owner_id);

		let url = hasActiveSubscription
			? await Customer.portal(polar, ctx.team.owner_id)
			: await Customer.checkout(
					polar,
					ctx.team.owner_id,
					new URL(
						routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						ctx.request.url,
					).toString(),
				);

		return redirect(url, { status: redirect.Status.SeeOther });
	}),
});
