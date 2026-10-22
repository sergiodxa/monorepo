/**
 * `sdxc setup flags`: `@sdxc/flags` + engine store, empty catalog and a wide-event hook ready
 * for the router / dispatcher middleware.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { success } from "@sdxc/result";

import type { SetupPlan } from "./plan.js";

import { creditSetupFiles } from "./credit.js";

/** Builds the flags setup plan. */
export async function planFlags(root: string): Promise<Result<SetupPlan, Error>> {
	let files = await creditSetupFiles(root, [
		{ path: "app/initializers/flags.ts", content: FLAGS_INITIALIZER },
	]);
	return success({
		feature: "flags",
		provider: null,
		files,
		edits: [],
		dependencies: ["@sdxc/flags", "@sdxc/flags-engine"],
		notes: [
			"Install the flags instance on the router and job dispatcher with the package's middleware.",
			"Add flag definitions to FLAG_SET and features as product needs them.",
		],
	});
}

const FLAGS_INITIALIZER = `/**
 * The app's feature flags: the definitions every evaluation resolves against, the typed
 * catalog a call site names one by, and the instance both surfaces evaluate through.
 */

import type { StoredFlagSet } from "@sdxc/flags-engine/store";

import { createEngine } from "@sdxc/flags-engine";
import { EngineProvider } from "@sdxc/flags-engine/provider";
import { InMemoryFlagStore } from "@sdxc/flags-engine/store/memory";
import { defineFlags } from "@sdxc/flags/catalog";
import { createFlags, wideEventHook } from "@sdxc/flags/client";

/**
 * What every evaluation resolves against. A key absent from here resolves to the default
 * its call site passed, so retiring a flag is deleting its entry and then its branch.
 */
export const FLAG_SET: StoredFlagSet = {
	flags: {},
};

/**
 * Every flag by the name a call site reaches for. Add entries with \`flag.boolean\` /
 * \`flag.number\` / \`flag.string\` as product needs them.
 */
export const features = defineFlags({});

/**
 * The instance both surfaces evaluate through, installed by the router's middleware and
 * the job dispatcher's.
 */
export const flags = createFlags({
	provider: new EngineProvider(createEngine({ store: new InMemoryFlagStore(FLAG_SET) })),
	hooks: [wideEventHook()],
});
`;
