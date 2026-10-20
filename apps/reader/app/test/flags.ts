/**
 * Serves a different flag definition to the app's own instance, so a test can exercise
 * the branch behind a flag rather than only the one that ships.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { StoredFlagSet } from "@sdxc/flags-engine/store";

import { createEngine } from "@sdxc/flags-engine";
import { EngineProvider } from "@sdxc/flags-engine/provider";
import { InMemoryFlagStore } from "@sdxc/flags-engine/store/memory";

import { FLAG_SET, flags } from "~/app/initializers/flags";

/**
 * Serves every shipped definition except the ones named here, which are served as one
 * variant holding the given value.
 *
 * @param values - The flag key to serve, by the value every evaluation of it answers.
 * @example await serveFlags({ "saved-posts": false });
 */
export async function serveFlags(values: Record<string, boolean | number | string>): Promise<void> {
	let flagSet: StoredFlagSet = {
		flags: {
			...FLAG_SET.flags,
			...Object.fromEntries(
				Object.entries(values).map(([key, value]) => [
					key,
					{ variants: { served: value }, defaultVariant: "served" },
				]),
			),
		},
	};

	await flags.setProvider(
		new EngineProvider(createEngine({ store: new InMemoryFlagStore(flagSet) })),
	);
}

/** Puts the shipped definitions back, for a test that left something else in place. */
export async function restoreFlags(): Promise<void> {
	await flags.setProvider(
		new EngineProvider(createEngine({ store: new InMemoryFlagStore(FLAG_SET) })),
	);
}
