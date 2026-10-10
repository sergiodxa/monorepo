/**
 * Tenant domains: the hostnames that reach a tenant's Durable Object, whether the platform's
 * own default subdomain or a customer's own DNS. A custom domain starts `pending` until it
 * verifies; a platform domain is written active, since the wildcard route already covers it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { createModel } from "@sdxc/data-model";
import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid/v7";

import { domains } from "~/database/schema";

/** Whether a domain is the platform-issued default or a customer's own DNS. */
export type DomainKind = "platform" | "custom";

/** A domain's DNS-verification/activation state. */
export type DomainStatus = "pending" | "active" | "failed";

/** Mints a `dom_` TypeID for a new domain row. */
const domainId = typeid("dom");

/**
 * Domains, keyed by a minted id and unique by hostname.
 *
 * @example let domain = await models.domains.findByHostname("acme.auth.sergiodxa.com");
 */
export const Domains = createModel(domains, {
	optional: ["id", "status"],

	scopes: {
		ofTenant: (query, tenantId: string) => query.where({ tenant_id: tenantId }),
		/** Domains still awaiting DNS verification or certificate issuance. */
		pending: (query) => query.where({ status: "pending" }),
	},

	methods: {
		/** The domain a request's hostname resolves to, or `null` when unregistered. */
		findByHostname(hostname: string) {
			return this.findBy({ hostname });
		},
	},

	callbacks: {
		async beforeCreate(values) {
			return {
				...values,
				id: values.id ?? domainId(generateUUID()).toString(),
				status: values.status ?? "pending",
			};
		},
	},
});

/** One domain row as the control plane stores it. */
export type DomainRow = ModelRow<typeof Domains>;

export default Domains;
