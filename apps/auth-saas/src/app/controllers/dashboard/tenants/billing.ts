import { html as htmlResponse } from "@pkg/http/response";
import { Location } from "@pkg/location";
import { env } from "cloudflare:workers";
import { html } from "remix/html-template";

import { layout } from "~/app/lib/html";
import routes from "~/app/routes";
import tenantOwner from "~/app/middleware/tenant-owner";
import Subscription from "~/app/models/subscription";
import AnalyticsService from "~/app/services/analytics";
import form from "~/lib/form";

export default form<"/dashboard/tenants/:tenantId/billing">({
	middleware: [tenantOwner],

	actions: {
		async index({ db, request, tenant, logger }) {
			let log = logger.loader(`/dashboard/tenants/${tenant.id}/billing`);

			let url = new URL(request.url);
			let showSuccess = url.searchParams.get("success") === "true";
			let blockedReason = url.searchParams.get("blocked");

			let subscription = await Subscription.findByTenant(db, tenant.id);

			// Get current month's MAU
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

			// Format period dates
			let periodStart = subscription?.current_period_start
				? new Date(subscription.current_period_start).toLocaleDateString()
				: null;
			let periodEnd = subscription?.current_period_end
				? new Date(subscription.current_period_end).toLocaleDateString()
				: null;

			// Calculate estimated cost
			let includedMau = 1000;
			let additionalMau = Math.max(0, mau - includedMau);
			let estimatedCost = 5 + additionalMau * 0.01;

			let blockedBanner = blockedReason
				? html`
							<div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
								<p class="text-red-800 font-medium">Access Restricted</p>
								<p class="text-red-700 text-sm mt-1">
									${getBlockedMessage(blockedReason)}
								</p>
							</div>
						`
				: null;

			let successBanner = showSuccess
				? html`
						<div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
							<p class="text-green-800 font-medium">Subscription activated successfully!</p>
							<p class="text-green-700 text-sm mt-1">
								Thank you for subscribing. Your subscription is now active.
							</p>
						</div>
					`
				: null;

			let subscriptionSection = subscription
				? html`
								<div class="flex items-center gap-3 mb-4">
									<span class="text-2xl font-bold">Auth SaaS</span>
									<span class="px-2 py-1 text-sm rounded ${Subscription.getStatusColor(subscription.status)}">
										${Subscription.getStatusLabel(subscription.status)}
									</span>
								</div>
								${
									periodStart && periodEnd
										? html`<p class="text-gray-500 text-sm">Current period: ${periodStart} - ${periodEnd}</p>`
										: null
								}
							`
				: html`
						<p class="text-gray-500">No subscription found. Please contact support.</p>
					`;

			let usageSection =
				mau > 0
					? html`
								<div class="mt-4 pt-4 border-t">
									<p class="text-sm text-gray-600">
										<span class="font-medium">Included:</span> ${Math.min(mau, includedMau).toLocaleString()} MAU
									</p>
									${
										additionalMau > 0
											? html`
										<p class="text-sm text-gray-600">
											<span class="font-medium">Additional:</span> ${additionalMau.toLocaleString()} MAU @ $0.01/each = $${(additionalMau * 0.01).toFixed(2)}
										</p>
									`
											: null
									}
									<p class="text-sm font-medium text-gray-900 mt-2">
										Estimated cost: $${estimatedCost.toFixed(2)}
									</p>
								</div>
							`
					: html`
							<p class="text-gray-400 text-xs mt-2">Usage tracking will begin when users start authenticating.</p>
						`;

			let manageSection = subscription?.polar_customer_id
				? html`
							<section class="bg-white rounded-lg border p-6">
								<h3 class="font-semibold mb-4">Manage Subscription</h3>
								<p class="text-gray-500 mb-4">
									Access your billing portal to update payment methods, view invoices, or manage your subscription.
								</p>
								<form method="POST" action="${String(new Location({ pathname: routes.dashboard.tenants.billing.action.href({ tenantId: tenant.id }), search: new URLSearchParams({ action: "portal" }) }))}">
									<button type="submit" class="bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-800">
										Open Billing Portal
									</button>
								</form>
							</section>
						`
				: html`
							<section class="bg-blue-50 rounded-lg border border-blue-200 p-6">
								<h3 class="font-semibold text-blue-900 mb-2">Start Your Subscription</h3>
								<p class="text-blue-800 mb-4">
									Subscribe to Auth SaaS to unlock all features and continue using the service.
								</p>
								<form method="POST" action="${String(new Location({ pathname: routes.dashboard.tenants.billing.action.href({ tenantId: tenant.id }), search: new URLSearchParams({ action: "checkout" }) }))}">
									<button type="submit" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
										Subscribe Now
									</button>
								</form>
							</section>
						`;

			return htmlResponse(
				String(
					layout({
						title: `Billing - ${tenant.name}`,
						tenant,
						content: html`
						<h2 class="text-2xl font-bold mb-6">Billing</h2>
						<p class="text-gray-500 mb-6">Manage your subscription and billing settings.</p>

						${blockedBanner}
						${successBanner}

						<section class="bg-white rounded-lg border p-6 mb-6">
							<h3 class="font-semibold mb-4">Current Plan</h3>
							${subscriptionSection}
						</section>

						<section class="bg-white rounded-lg border p-6 mb-6">
							<h3 class="font-semibold mb-4">Pricing</h3>
							<div class="grid gap-4">
								<div class="border rounded-lg p-4">
									<div class="flex justify-between items-center mb-2">
										<span class="font-medium">Base Plan</span>
										<span class="text-lg font-bold">$5/month</span>
									</div>
									<p class="text-gray-500 text-sm">Includes 1,000 MAU</p>
								</div>
								<div class="border rounded-lg p-4">
									<div class="flex justify-between items-center mb-2">
										<span class="font-medium">Additional MAU</span>
										<span class="text-lg font-bold">$0.01/MAU</span>
									</div>
									<p class="text-gray-500 text-sm">Charged based on usage above 1,000 MAU</p>
								</div>
							</div>
						</section>

						<section class="bg-white rounded-lg border p-6 mb-6">
							<h3 class="font-semibold mb-4">Usage This Month</h3>
							<div class="text-3xl font-bold mb-2">${mau.toLocaleString()}</div>
							<p class="text-gray-500 text-sm">Monthly Active Users</p>
							${usageSection}
						</section>

						${manageSection}
					`,
					}),
				),
			);
		},

		async action({ request, db, tenant, logger }) {
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
					// Use env variable for product ID or fall back to placeholder
					let productId = env.POLAR_PRODUCT_ID ?? "placeholder-product-id";
					let successUrl = `${url.origin}${new Location({ pathname: routes.dashboard.tenants.billing.index.href({ tenantId: tenant.id }), search: new URLSearchParams({ success: "true" }) })}`;

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
				headers: { Location: routes.dashboard.tenants.billing.index.href({ tenantId: tenant.id }) },
			});
		},
	},
});

/**
 * Get a human-readable message for the blocked reason.
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
