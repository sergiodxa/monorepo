/**
 * Tenant billing controller: renders the subscription/usage/pricing page and handles
 * billing portal, checkout, and cancel actions. Rendering uses `remix/ui` JSX via
 * `ctx.render`; all subscription logic, redirects, and status codes are preserved.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Location } from "@pkg/location";
import { inject } from "@pkg/service-container";
import { env } from "cloudflare:workers";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createController } from "remix/router";

import tenantOwner from "~/app/http/middleware/tenant-owner";
import Subscription from "~/app/models/subscription";
import AnalyticsService from "~/app/services/analytics";
import { SubscriptionBadge } from "~/app/views/components";
import { Document } from "~/app/views/document";
import * as s from "~/app/views/styles";
import routes from "~/routes/web";

export default createController(routes.dashboard.tenants.billing, {
	middleware: [tenantOwner],

	actions: {
		index: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let { request, tenant, logger } = ctx;
			let log = logger.loader(`/dashboard/tenants/${tenant.id}/billing`);

			let url = new URL(request.url);
			let showSuccess = url.searchParams.get("success") === "true";
			let blockedReason = url.searchParams.get("blocked");

			let subscription = await Subscription.findByTenant(db, tenant.id);

			let month = AnalyticsService.getCurrentMonth();
			let mau = 0;
			try {
				mau = await AnalyticsService.queryMAU(tenant.id, month);
			} catch (error) {
				log.error("Failed to query MAU", {
					tenantId: tenant.id,
					error: error instanceof Error ? error.message : String(error),
				});
			}

			log.info("Billing page loaded", {
				tenantId: tenant.id,
				hasSubscription: !!subscription,
				mau,
			});

			let periodStart = subscription?.current_period_start
				? new Date(subscription.current_period_start).toLocaleDateString()
				: null;
			let periodEnd = subscription?.current_period_end
				? new Date(subscription.current_period_end).toLocaleDateString()
				: null;

			let includedMau = 1000;
			let additionalMau = Math.max(0, mau - includedMau);
			let estimatedCost = 5 + additionalMau * 0.01;

			let portalAction = String(
				new Location({
					pathname: routes.dashboard.tenants.billing.action.href({ tenantId: tenant.id }),
					search: new URLSearchParams({ action: "portal" }),
				}),
			);
			let checkoutAction = String(
				new Location({
					pathname: routes.dashboard.tenants.billing.action.href({ tenantId: tenant.id }),
					search: new URLSearchParams({ action: "checkout" }),
				}),
			);

			return ctx.render(
				<Document title={`Billing - ${tenant.name}`} tenant={tenant}>
					<h2 mix={[s.pageTitle]}>Billing</h2>
					<p mix={[s.lead]}>Manage your subscription and billing settings.</p>

					{blockedReason && (
						<div mix={[s.noticeRed]}>
							<p mix={[s.noticeRedTitle]}>Access Restricted</p>
							<p mix={[s.noticeRedText]}>{getBlockedMessage(blockedReason)}</p>
						</div>
					)}

					{showSuccess && (
						<div mix={[s.noticeGreen]}>
							<p mix={[s.noticeGreenTitle]}>Subscription activated successfully!</p>
							<p mix={[s.noticeGreenText]}>
								Thank you for subscribing. Your subscription is now active.
							</p>
						</div>
					)}

					<section mix={[s.section]}>
						<h3 mix={[s.cardTitle]}>Current Plan</h3>
						{subscription ? (
							<>
								<div mix={[s.inlineRow]} style="margin-bottom:1rem">
									<span mix={[s.bigNumber]}>Auth SaaS</span>
									<SubscriptionBadge status={subscription.status}>
										{Subscription.getStatusLabel(subscription.status)}
									</SubscriptionBadge>
								</div>
								{periodStart && periodEnd && (
									<p mix={[s.mutedSmall]}>
										Current period: {periodStart} - {periodEnd}
									</p>
								)}
							</>
						) : (
							<p mix={[s.muted]}>No subscription found. Please contact support.</p>
						)}
					</section>

					<section mix={[s.section]}>
						<h3 mix={[s.cardTitle]}>Pricing</h3>
						<div mix={[s.stack]} style="gap:1rem">
							<div mix={[s.card]}>
								<div mix={[s.pricingRow]}>
									<span mix={[s.cardTitle]} style="margin:0">
										Base Plan
									</span>
									<span mix={[s.bigNumber]} style="font-size:1.125rem">
										$5/month
									</span>
								</div>
								<p mix={[s.mutedSmall]}>Includes 1,000 MAU</p>
							</div>
							<div mix={[s.card]}>
								<div mix={[s.pricingRow]}>
									<span mix={[s.cardTitle]} style="margin:0">
										Additional MAU
									</span>
									<span mix={[s.bigNumber]} style="font-size:1.125rem">
										$0.01/MAU
									</span>
								</div>
								<p mix={[s.mutedSmall]}>Charged based on usage above 1,000 MAU</p>
							</div>
						</div>
					</section>

					<section mix={[s.section]}>
						<h3 mix={[s.cardTitle]}>Usage This Month</h3>
						<div mix={[s.hugeNumber]}>{mau.toLocaleString()}</div>
						<p mix={[s.mutedSmall]}>Monthly Active Users</p>
						{mau > 0 ? (
							<div mix={[s.usageBox]}>
								<p mix={[s.mutedSmall]}>
									<strong>Included:</strong> {Math.min(mau, includedMau).toLocaleString()} MAU
								</p>
								{additionalMau > 0 && (
									<p mix={[s.mutedSmall]}>
										<strong>Additional:</strong> {additionalMau.toLocaleString()} MAU @ $0.01/each ={" "}
										${(additionalMau * 0.01).toFixed(2)}
									</p>
								)}
								<p mix={[s.mutedSmall]} style="font-weight:500;color:#111827;margin-top:0.5rem">
									Estimated cost: ${estimatedCost.toFixed(2)}
								</p>
							</div>
						) : (
							<p mix={[s.helpXs]}>Usage tracking will begin when users start authenticating.</p>
						)}
					</section>

					{subscription?.polar_customer_id ? (
						<section mix={[s.section]}>
							<h3 mix={[s.cardTitle]}>Manage Subscription</h3>
							<p mix={[s.lead]}>
								Access your billing portal to update payment methods, view invoices, or manage your
								subscription.
							</p>
							<form method="post" action={portalAction} data-rmx-document="">
								<button mix={[s.button, s.buttonDark]} type="submit">
									Open Billing Portal
								</button>
							</form>
						</section>
					) : (
						<section mix={[s.sectionBlue]}>
							<h3 mix={[s.sectionBlueTitle]}>Start Your Subscription</h3>
							<p mix={[s.sectionBlueText]}>
								Subscribe to Auth SaaS to unlock all features and continue using the service.
							</p>
							<form method="post" action={checkoutAction} data-rmx-document="">
								<button mix={[s.button]} type="submit">
									Subscribe Now
								</button>
							</form>
						</section>
					)}
				</Document>,
			);
		}),

		action: inject([Database] as const, async (db) => {
			let { request, tenant, logger } = getContext();
			let log = logger.action(`/dashboard/tenants/${tenant.id}/billing`);

			let url = new URL(request.url);
			let actionType = url.searchParams.get("action");

			if (actionType === "portal") {
				try {
					let portalUrl = await Subscription.createPortalUrl(db, tenant.id);
					log.info("Redirecting to billing portal", { tenantId: tenant.id });
					return new Response(null, {
						status: 302,
						headers: { Location: portalUrl },
					});
				} catch (error) {
					log.error("Failed to create portal session", {
						tenantId: tenant.id,
						error: error instanceof Error ? error.message : String(error),
					});
					return new Response("Failed to open billing portal", { status: 500 });
				}
			}

			if (actionType === "checkout") {
				try {
					let productId = env.POLAR_PRODUCT_ID ?? "placeholder-product-id";
					let successPath = String(
						new Location({
							pathname: routes.dashboard.tenants.billing.index.href({ tenantId: tenant.id }),
							search: new URLSearchParams({ success: "true" }),
						}),
					);
					let successUrl = `${url.origin}${successPath}`;

					let checkoutUrl = await Subscription.createCheckoutUrl(
						db,
						tenant.id,
						productId,
						successUrl,
					);
					log.info("Redirecting to checkout", { tenantId: tenant.id });
					return new Response(null, {
						status: 302,
						headers: { Location: checkoutUrl },
					});
				} catch (error) {
					log.error("Failed to create checkout session", {
						tenantId: tenant.id,
						error: error instanceof Error ? error.message : String(error),
					});
					return new Response("Failed to start checkout", { status: 500 });
				}
			}

			if (actionType === "cancel") {
				try {
					await Subscription.cancel(db, tenant.id);
					log.info("Subscription canceled", { tenantId: tenant.id });
				} catch (error) {
					log.error("Failed to cancel subscription", {
						tenantId: tenant.id,
						error: error instanceof Error ? error.message : String(error),
					});
					return new Response("Failed to cancel subscription", { status: 500 });
				}
			}

			return new Response(null, {
				status: 302,
				headers: {
					Location: routes.dashboard.tenants.billing.index.href({ tenantId: tenant.id }),
				},
			});
		}),
	},
});

/**
 * Get a human-readable message for the blocked reason.
 * @param reason - The `blocked` query-param value indicating why access is restricted.
 * @returns A user-facing explanation of the restriction.
 * @example
 * getBlockedMessage("unpaid"); // "Your subscription payment has failed. …"
 */
function getBlockedMessage(reason: string): string {
	switch (reason) {
		case "canceled":
			return "Your subscription has been canceled. Please subscribe to regain access to tenant management features.";
		case "unpaid":
			return "Your subscription payment has failed. Please update your payment method to restore access.";
		case "incomplete":
			return "Your subscription setup is incomplete. Please complete the checkout process to access tenant management features.";
		case "no_subscription":
			return "No subscription found for this tenant. Please subscribe to access tenant management features.";
		default:
			return "Your subscription status prevents access to tenant management features. Please review your billing settings.";
	}
}
