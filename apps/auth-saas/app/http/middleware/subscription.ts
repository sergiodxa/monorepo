/**
 * Middleware that enforces the current tenant's billing subscription state, attaching
 * a normalized `context.subscription` (active / past-due / blocked flags) and
 * redirecting blocked tenants to the billing page. The platform tenant and internal
 * tenants are exempt. Must run after `tenantOwner`, which resolves `context.tenant`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Location } from "@sdxc/location";
import { getServiceContainer } from "@sdxc/service-container";
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
	if (!context.tenant) {
		context.log.fail(new Error("Subscription middleware ran without a resolved tenant"));
		return new Response("Internal error", { status: 500 });
	}

	if (context.tenant.id === PLATFORM_TENANT_ID || context.tenant.internal) {
		context.subscription = {
			id: context.tenant.id,
			status: "active",
			isActive: true,
			isPastDue: false,
			isBlocked: false,
		};
		return next();
	}

	let db = getServiceContainer().get(Database);
	let subscription = await Subscription.findByTenant(db, context.tenant.id);

	if (!subscription) {
		context.log.set({ subscription: { status: "none" } }).note("subscription.missing");
		return redirectToBlocked(context.tenant.id, "no_subscription");
	}

	let status = subscription.status;
	let isActive = ACTIVE_STATUSES.has(status);
	let isPastDue = WARNING_STATUSES.has(status);
	let isBlocked = BLOCKED_STATUSES.has(status);

	context.log.set({ subscription: { id: subscription.id, status } });

	context.subscription = {
		id: subscription.id,
		status,
		isActive,
		isPastDue,
		isBlocked,
	};

	if (isBlocked) {
		context.log.note("subscription.blocked");
		return redirectToBlocked(context.tenant.id, status);
	}

	if (isPastDue) context.log.note("subscription.past_due");

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
