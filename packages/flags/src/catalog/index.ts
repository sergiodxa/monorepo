/**
 * The typed flag catalog: `defineFlags` and the `flag.*` handle constructors an
 * application declares its flags with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { StandardSchemaV1 } from "@standard-schema/spec";

import type { Flag } from "../core/client.js";
import type { FlagValue } from "../core/value.js";

/**
 * Declares an application's flags as one named thing, so a call site reaches
 * for `features.newCheckout` rather than an object nobody gave a name. It hands
 * back what it was given, with every handle's type intact.
 *
 * @example
 * export const features = defineFlags({
 * 	newCheckout: flag.boolean("new-checkout", false),
 * 	digestBatch: flag.number("digest-batch-size", 50),
 * });
 */
export function defineFlags<Catalog extends Record<string, Flag<FlagValue>>>(
	catalog: Catalog,
): Catalog {
	return catalog;
}

/**
 * The four constructors a catalog entry is written with, one per flag type. Each
 * fixes the key, the type and the default in one place, and `client.get` reads
 * all three back off the handle, so a call site restates none of them.
 *
 * @example
 * let newCheckout = flag.boolean("new-checkout", false);
 * let copy = flag.object("checkout-copy", CopySchema, { title: "Checkout", cta: "Pay" });
 */
export const flag = {
	boolean(key: string, defaultValue: boolean): Flag<boolean> {
		return { key, type: "boolean", defaultValue };
	},

	string(key: string, defaultValue: string): Flag<string> {
		return { key, type: "string", defaultValue };
	},

	number(key: string, defaultValue: number): Flag<number> {
		return { key, type: "number", defaultValue };
	},

	/**
	 * The schema comes before the default because it is what types the default:
	 * a structure the schema would reject is a compile error here rather than a
	 * `TYPE_MISMATCH` in production.
	 */
	object<T extends FlagValue>(
		key: string,
		schema: StandardSchemaV1<unknown, T>,
		defaultValue: NoInfer<T>,
	): Flag<T> {
		return { key, type: "object", defaultValue, schema };
	},
};
