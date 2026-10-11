/**
 * Tenant add-ons: a tenant's subscriptions beyond its base plan, each its own Polar
 * subscription with its own status and period, recorded once a checkout or a subscription
 * event has resolved which tenant it belongs to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { createModel } from "@sdxc/data-model";
import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid/v7";

import { tenantAddons } from "~/database/schema";

/** Mints an `addon_` TypeID for a new tenant add-on row. */
const addonId = typeid("addon");

/** A subscription's add-on, as a checkout that produced it records it. */
export interface AttachTenantAddonInput {
	tenant_id: string;
	product_slug: string;
	subscription_id: string;
	status: string;
	current_period_end: number | null;
}

/**
 * Tenant add-ons, each unique by its subscription id.
 *
 * @example let addon = await models.tenantAddons.findBySubscriptionId(subscriptionId);
 */
export const TenantAddons = createModel(tenantAddons, {
	optional: ["id"],

	scopes: {
		ofTenant: (query, tenantId: string) => query.where({ tenant_id: tenantId }),
	},

	methods: {
		/** The add-on a provider's subscription id was recorded against. */
		findBySubscriptionId(subscriptionId: string) {
			return this.findBy({ subscription_id: subscriptionId });
		},

		/**
		 * Records a subscription's add-on in one statement; a subscription already recorded keeps
		 * its row, so two callers attaching the same checkout land one add-on.
		 */
		attach(input: AttachTenantAddonInput) {
			return this.upsert(
				{ ...input, id: addonId(generateUUID()).toString() },
				{ conflict: ["subscription_id"], update: {} },
			);
		},
	},

	callbacks: {
		async beforeCreate(values) {
			return { ...values, id: values.id ?? addonId(generateUUID()).toString() };
		},
	},
});

/** One tenant add-on row as the control plane stores it. */
export type TenantAddonRow = ModelRow<typeof TenantAddons>;

export default TenantAddons;
