/**
 * Billing entry point. Owners get redirected to a hosted Polar checkout session (no
 * active subscription) or the hosted customer portal (already subscribed) — billing
 * is 100% Polar-hosted, matching the OLD APP. Non-owners see a message instead of a
 * redirect: only the owner can manage billing. This intentionally drops the OLD
 * APP's usage-quantities view shown to non-owners on this page, since `@pkg/polar`
 * has no equivalent to the raw SDK's `meters.quantities` call it used — a
 * team-usage view is a bigger, separate feature, not a one-line port.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { PolarClient } from "@pkg/polar";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { createAction } from "remix/fetch-router";

import Customer from "~/app/data/customer";
import { getViewer } from "~/app/http/middleware/auth";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import CheckoutView from "~/resources/views/checkout";
import routes from "~/routes/web";

/** GET /app/:team/checkout — redirects the owner to Polar-hosted billing. */
export default createAction(
	routes.app.team.checkout,
	inject([PolarClient] as const, async (polar) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		if (ctx.membership.subject_id !== ctx.team.owner_id) {
			let renderDocument = DocumentLayout();
			return ctx.render(
				renderDocument({
					title: `${ctx.team.name} · Billing`,
					children: (
						<AppShell team={ctx.team} viewer={viewer}>
							<CheckoutView />
						</AppShell>
					),
				}),
			);
		}

		let hasActiveSubscription = await Customer.hasActiveSubscription(polar, ctx.team.owner_id);

		let url = hasActiveSubscription
			? await Customer.portal(polar, ctx.team.owner_id)
			: await Customer.checkout(
					polar,
					ctx.team.owner_id,
					new URL(
						routes.app.team.dashboard.href({ team: ctx.team.slug }),
						ctx.request.url,
					).toString(),
				);

		return redirect(url, { status: redirect.Status.SeeOther });
	}),
);
