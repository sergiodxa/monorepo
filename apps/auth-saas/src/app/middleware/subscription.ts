import Subscription from "~/app/models/subscription";
import middleware from "~/lib/middleware";

/** Subscription statuses that allow full access. */
const ACTIVE_STATUSES = new Set(["active", "trialing"]);

/** Subscription statuses that show a warning but allow access. */
const WARNING_STATUSES = new Set(["past_due"]);

/** Subscription statuses that block access and redirect to billing. */
const BLOCKED_STATUSES = new Set(["canceled", "unpaid", "incomplete"]);

/**
 * Extends the request context with the tenant's subscription information.
 */
declare module "remix/fetch-router" {
	interface RequestContext {
		subscription: {
			/** The unique subscription identifier */
			id: string;
			/** The current subscription status */
			status: string;
			/** Whether the subscription has full access (active or trialing) */
			isActive: boolean;
			/** Whether the subscription is past due (access with warning) */
			isPastDue: boolean;
			/** Whether access is blocked due to subscription status */
			isBlocked: boolean;
			/** The Polar customer ID for billing operations */
			polarCustomerId: string | null;
		};
	}
}

/** The platform tenant ID - exempt from subscription checks. */
const PLATFORM_TENANT_ID = "platform";

/**
 * Middleware that checks subscription status for the current tenant.
 *
 * Must be used after the tenant-owner middleware to ensure tenant context exists.
 *
 * Access levels by status:
 * - active/trialing: Full access
 * - past_due: Access with warning (isPastDue flag set in context)
 * - canceled/unpaid/incomplete: Blocked with redirect to billing page
 *
 * Note: The platform tenant is exempt from subscription checks.
 */
export default middleware(async (context, next) => {
	let log = context.logger.middleware("subscription");

	if (!context.tenant) {
		log.error("Subscription middleware used without tenant context");
		return new Response("Internal error", { status: 500 });
	}

	// Platform tenant is exempt from subscription checks
	if (context.tenant.id === PLATFORM_TENANT_ID) {
		context.subscription = {
			id: "platform",
			status: "active",
			isActive: true,
			isPastDue: false,
			isBlocked: false,
			polarCustomerId: null,
		};
		return next();
	}

	let subscription = await Subscription.findByTenant(context.db, context.tenant.id);

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
			Location: `/dashboard/tenants/${tenantId}/billing?blocked=${encodeURIComponent(reason)}`,
		},
	});
}
