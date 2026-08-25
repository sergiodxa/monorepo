/**
 * Middleware that enforces the current tenant's billing subscription state, attaching
 * a normalized `context.subscription` (active / past-due / blocked flags) and
 * redirecting blocked tenants to the billing page. The platform tenant and internal
 * tenants are exempt. Must run after `tenantOwner`, which resolves `context.tenant`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Location } from "@pkg/location";
import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import middleware from "~/app/lib/middleware";
import Subscription from "~/app/models/subscription";
import routes from "~/routes/web";

/** Subscription statuses that allow full access. */
const ACTIVE_STATUSES = new Set(["active", "trialing"]);

/** Subscription statuses that show a warning but allow access. */
const WARNING_STATUSES = new Set(["past_due"]);

/** Subscription statuses that block access and redirect to billing. */
const BLOCKED_STATUSES = new Set(["canceled", "unpaid", "incomplete"]);

/**
 * Extends the request context with the tenant's subscription information.
 */
declare module "remix/router" {
	interface RequestContext {
		subscription: {
			id: string;
			status: string;
			/** Whether the subscription has full access (active or trialing) */
			isActive: boolean;
			/** Whether the subscription is past due (access with warning) */
			isPastDue: boolean;
			/** Whether access is blocked (canceled, unpaid, or incomplete) */
			isBlocked: boolean;
			polarCustomerId: string | null;
		};
	}
}

/** The platform tenant ID - exempt from subscription checks. */
const PLATFORM_TENANT_ID = "platform";

/**
 * Gates the current tenant's access by subscription status: past-due passes with a
 * warning, canceled/unpaid/incomplete redirects to billing. The platform tenant and
 * internal tenants pass through without a database lookup.
 *
 * @returns The downstream response when access is allowed, a `302` redirect to billing
 * when blocked, or a `500` response when used without tenant context.
 * @example
 * router.map(route, { middleware: [tenantOwner, subscription], handler });
 */
export default middleware(async (context, next) => {
	let log = context.logger.middleware("subscription");

	if (!context.tenant) {
		log.error("Subscription middleware used without tenant context");
		return new Response("Internal error", { status: 500 });
	}

	if (context.tenant.id === PLATFORM_TENANT_ID || context.tenant.internal) {
		context.subscription = {
			id: context.tenant.id,
			status: "active",
			isActive: true,
			isPastDue: false,
			isBlocked: false,
			polarCustomerId: null,
		};
		return next();
	}

	let db = getServiceContainer().get(Database);
	let subscription = await Subscription.findByTenant(db, context.tenant.id);

	if (!subscription) {
		log.info("No subscription found for tenant", { tenantId: context.tenant.id });
		return redirectToBlocked(context.tenant.id, "no_subscription");
	}

	let status = subscription.status;
	let isActive = ACTIVE_STATUSES.has(status);
	let isPastDue = WARNING_STATUSES.has(status);
	let isBlocked = BLOCKED_STATUSES.has(status);

	context.subscription = {
		id: subscription.id,
		status,
		isActive,
		isPastDue,
		isBlocked,
		polarCustomerId: subscription.polar_customer_id,
	};

	if (isBlocked) {
		log.info("Access blocked due to subscription status", {
			tenantId: context.tenant.id,
			status,
		});
		return redirectToBlocked(context.tenant.id, status);
	}

	if (isPastDue) {
		log.info("Subscription past due, access allowed with warning", {
			tenantId: context.tenant.id,
		});
	}

	return next();
});

/**
 * Redirects the user to the billing page with a blocked reason.
 * @param tenantId - The tenant identifier for the redirect URL
 * @param reason - The reason for blocking access (shown in query param)
 * @returns A redirect response to the tenant's billing page
 */
function redirectToBlocked(tenantId: string, reason: string): Response {
	return new Response(null, {
		status: 302,
		headers: {
			Location: new Location({
				pathname: routes.dashboard.tenants.billing.index.href({ tenantId }),
				search: new URLSearchParams({ blocked: reason }),
			}).toString(),
		},
	});
}
