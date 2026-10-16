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
import { createAction } from "remix/router";

import { billingDeliveries, polar } from "~/app/initializers/billing";
import { openDatabase } from "~/app/initializers/database";
import models from "~/app/models";
import { createBillingWebhookHandlers } from "~/app/services/billing-sync";
import routes from "~/routes/web";

/** Verifies, deduplicates and applies each billing provider delivery. */
let webhook = new BillingWebhook(
	polar,
	createBillingWebhookHandlers(models.bind({ db: openDatabase() }), polar),
	{
		store: billingDeliveries,
	},
);

/**
 * The billing webhook endpoint.
 *
 * @example
 * router.map(routes.billing.webhook, webhook);
 */
export default createAction(routes.billing.webhook, (ctx) => webhook.handler(ctx));
