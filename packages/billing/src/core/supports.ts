/**
 * The capability check: an optional group is both the declaration and the
 * implementation, so asking whether a platform has one narrows the property to
 * non-optional inside the branch, and the answer comes from the code itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Billing } from "./contract";

/**
 * Resource groups whose presence varies by platform. Derived from which
 * contract properties are optional, so the list follows the contract itself.
 */
export type OptionalCapability = {
	[Group in keyof Billing]-?: object extends Pick<Billing, Group> ? Group : never;
}[keyof Billing];

/**
 * Every optional group, so a conformance run asserts each declaration against
 * a real call.
 */
export const OPTIONAL_CAPABILITIES: readonly OptionalCapability[] = [
	"discounts",
	"meters",
	"portal",
	"usage",
];

/**
 * Narrows an optional resource group to present, so a page rendering meter
 * usage typechecks only against a platform that meters.
 *
 * @param billing - The configured provider to ask.
 * @param capability - Which optional group.
 * @returns Whether the provider implements it, narrowing the group when it does.
 *
 * @example
 * if (!supports(billing, "meters")) return notFound();
 * let usage = await billing.meters.quantities({ meter: "pings", customer, from, to, interval: "day" });
 */
export function supports<Provider extends Billing, Capability extends OptionalCapability>(
	billing: Provider,
	capability: Capability,
): billing is Provider & Required<Pick<Billing, Capability>> {
	return billing[capability] !== undefined;
}
