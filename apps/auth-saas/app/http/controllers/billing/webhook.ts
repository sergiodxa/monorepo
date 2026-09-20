/**
 * `POST /webhooks/billing` — Polar's delivery endpoint (ADR-018). Mounted as a
 * module-scope `BillingWebhook` over the platform's Polar connection and its
 * `billing_deliveries` store, so a misconfigured store surfaces at boot rather
 * than on the first delivery. The instance itself satisfies the router's action
 * object form and mounts directly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BillingWebhook } from "@sdxc/billing";

import { billingDeliveries, polar } from "~/app/lib/billing";
import { createDatabase } from "~/app/lib/database";
import { createBillingWebhookHandlers } from "~/app/services/billing-sync";

/**
 * The billing webhook endpoint.
 *
 * @example
 * router.map(routes.billing.webhook, webhook);
 */
export default new BillingWebhook(polar, createBillingWebhookHandlers(createDatabase(), polar), {
	store: billingDeliveries,
});
