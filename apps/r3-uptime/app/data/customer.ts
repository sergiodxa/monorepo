/**
 * Billing customer provisioning for the auth flow. Resolves a signed-in subject to a
 * Polar customer — by external id first, then by email, creating one when neither
 * exists — and links the external id when a matched customer lacks one. Wraps
 * `@pkg/polar` so login provisioning stays independent of the Polar SDK's shapes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PolarClient } from "@pkg/polar";

import type IdToken from "~/app/auth/value-objects/id-token";

export default class Customer {
	/**
	 * Finds or creates the Polar customer for a signed-in subject, linking the
	 * external id when an existing customer (found by email) is missing one.
	 */
	static async findOrCreate(polar: PolarClient, idToken: IdToken) {
		let customer = await polar.getExternalCustomer(idToken.subject);
		if (customer) return customer;

		customer = await polar.findCustomerByEmail(idToken.email);
		if (!customer) return await polar.createCustomer(idToken.email, idToken.name);
		if (customer.externalId) return customer;

		return await polar.updateCustomer(customer.id, { externalId: idToken.subject });
	}
}
