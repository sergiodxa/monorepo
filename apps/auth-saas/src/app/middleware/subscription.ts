import Subscription from "~/app/models/subscription";
import middleware from "~/lib/middleware";

/**
 * Subscription status that allows full access.
 */
const ACTIVE_STATUSES = new Set(["active", "trialing"]);

/**
 * Subscription status that shows a warning but allows access.
 */
const WARNING_STATUSES = new Set(["past_due"]);

/**
 * Subscription status that blocks access.
 */
const BLOCKED_STATUSES = new Set(["canceled", "unpaid", "incomplete"]);

declare module "remix/fetch-router" {
	interface RequestContext {
		subscription: {
			id: string;
			status: string;
			isActive: boolean;
			isPastDue: boolean;
			isBlocked: boolean;
			polarCustomerId: string | null;
		};
	}
}

/**
 * Middleware that checks subscription status for the current tenant.
 * Must be used after the tenant-owner middleware.
 *
 * - active/trialing: Full access
 * - past_due: Access with warning (set in context)
 * - canceled/unpaid/incomplete: Blocked with redirect to billing
 */
export default middleware(async (context, next) => {
	let log = context.logger.middleware("subscription");

	// Skip if no tenant in context (middleware order issue)
	if (!context.tenant) {
		log.error("Subscription middleware used without tenant context");
		return new Response("Internal error", { status: 500 });
	}

	let subscription = await Subscription.findByTenant(context.db, context.tenant.id);

	// If no subscription exists, treat as blocked (shouldn't happen normally)
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

	// Block access for unpaid subscriptions
	if (isBlocked) {
		log.info("Access blocked due to subscription status", {
			tenantId: context.tenant.id,
			status,
		});
		return redirectToBlocked(context.tenant.id, status);
	}

	// Log warning for past_due but allow access
	if (isPastDue) {
		log.info("Subscription past due, access allowed with warning", {
			tenantId: context.tenant.id,
		});
	}

	return next();
});

/**
 * Redirect to a blocked page with reason.
 */
function redirectToBlocked(tenantId: string, reason: string): Response {
	return new Response(null, {
		status: 302,
		headers: {
			Location: `/dashboard/tenants/${tenantId}/billing?blocked=${encodeURIComponent(reason)}`,
		},
	});
}
