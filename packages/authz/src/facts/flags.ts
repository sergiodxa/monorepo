/**
 * Feature flags as a fact root: a guard reads `flags.reportsExport` from a
 * `@sdxc/flags` catalog, and only the flags some condition reads are
 * evaluated, so a split nobody's rule reads records no exposure.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Client, EvaluationContext, Flag, FlagValue } from "@sdxc/flags";

import { Flags } from "@sdxc/flags/middleware";
import { failure, success } from "@sdxc/result";

import type { FactLoader } from "../facts.js";

import { factLoader } from "../facts.js";

/** What `fromFlags` takes beside the catalog. */
export interface FromFlagsOptions {
	/**
	 * The client to evaluate through. Defaults to the invocation's client from
	 * `@sdxc/flags/middleware`, so `featureFlags` is installed before access binds.
	 */
	client?: Client;
	/**
	 * The evaluation context, for a flag whose subject is the team rather than
	 * the viewer. It receives the request or job the access serves, absent when
	 * code outside an adapter bound it.
	 */
	// oxlint-disable-next-line typescript/no-explicit-any -- the app's own request or job context, whatever it carries
	context?: (ctx: any) => EvaluationContext;
	/**
	 * `"default"` binds the value the client answered, as every other read sees
	 * it; `"missing"` omits a flag that errored, so a rule reading it refuses.
	 * @default "default"
	 */
	onError?: "default" | "missing";
}

/** The values of a flag catalog, keyed by the catalog's property names. */
export type FlagFacts<C extends Readonly<Record<string, Flag<FlagValue>>>> = {
	[K in keyof C]: C[K] extends Flag<infer T> ? T : never;
};

/**
 * Binds a flag catalog as a fact root, keyed by the catalog's property names.
 *
 * @param catalog The app's flags, as `defineFlags` declared them.
 * @param options The client, the evaluation context, and how an erroring flag binds.
 * @throws {TypeError} When a property name contains `.`, which a path could not read.
 * @example fromFlags(features, { context: (ctx) => ({ targetingKey: teamOf(ctx).id }) })
 */
export function fromFlags<C extends Readonly<Record<string, Flag<FlagValue>>>>(
	catalog: C,
	options: FromFlagsOptions = {},
): FactLoader<FlagFacts<C>> {
	for (let name of Object.keys(catalog)) {
		if (name.includes(".")) {
			throw new TypeError(`Flag property "${name}" contains ".", which a condition cannot read`);
		}
	}

	return factLoader(async ({ paths, context }) => {
		let client = options.client ?? (context?.get(Flags) as Client | undefined);
		if (client === undefined) {
			return failure(
				new Error("No flags client: install featureFlags() before access, or pass `client`"),
			);
		}

		let read = new Set([...paths].map((path) => path.split(".")[0] as string));
		let evaluation = options.context?.(context);
		let facts: Record<string, FlagValue> = {};
		await Promise.all(
			[...read]
				.filter((name) => Object.hasOwn(catalog, name))
				.map(async (name) => {
					let details = await client.details(
						catalog[name] as Flag<FlagValue>,
						evaluation === undefined ? {} : { context: evaluation },
					);
					if (details.errorCode !== undefined && options.onError === "missing") return;
					facts[name] = details.value;
				}),
		);
		return success(facts as FlagFacts<C>);
	});
}
