/**
 * `POST /webhooks/billing` — Polar's delivery endpoint. Mounted as a
 * module-scope `BillingWebhook` over the platform's Polar connection and its
 * `billing_deliveries` store, so a misconfigured store surfaces at boot rather
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
const WEBHOOK = new BillingWebhook(
	polar,
	createBillingWebhookHandlers(models.bind({ db: openDatabase() }), polar),
	{
		store: billingDeliveries,
	},
);

/** `POST /webhooks/billing`, behind no guard: the delivery's signature alone says whether to trust it. */
export default createAction(routes.billing.webhook, (ctx) => WEBHOOK.handler(ctx));
