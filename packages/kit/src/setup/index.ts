/**
 * `sdxc setup`: feature installers that span app code and config — list known features, print
 * a plan, and with confirmation write every path the feature needs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure } from "@sdxc/result";

import type { SetupPlan } from "./plan.js";

import { planAuth } from "./auth.js";
import { planBilling } from "./billing.js";
import { SETUP_FEATURES, setupFeature } from "./catalog.js";
import { planFlags } from "./flags.js";
import { applyPlan } from "./plan.js";

export { SETUP_FEATURES, setupFeature } from "./catalog.js";
export { applyPlan, formatPlan } from "./plan.js";
export type { SetupPlan } from "./plan.js";

/** Lists the features this kit release knows, one line each. */
export function listFeatures(): string {
	return (
		SETUP_FEATURES.map((feature) => `${feature.name.padEnd(10)} ${feature.description}`).join(
			"\n",
		) + "\n"
	);
}

/**
 * Plans `feature` for the project at `root`. Unknown features fail naming the catalog.
 */
export async function planSetup(
	root: string,
	feature: string,
	provider: string | undefined,
): Promise<Result<SetupPlan, Error>> {
	let known = setupFeature(feature);
	if (known === null) {
		return failure(
			new Error(
				`Unknown setup feature "${feature}"; this release ships ${SETUP_FEATURES.map((row) => row.name).join(", ")}`,
			),
		);
	}
	let chosen =
		provider ??
		known.defaultProvider ??
		(known.providers.length === 1 ? known.providers[0] : undefined);
	if (known.providers.length > 0 && chosen === undefined) {
		return failure(
			new Error(
				`setup ${feature} needs --provider ${known.providers.join("|")} (default: ${known.defaultProvider})`,
			),
		);
	}
	if (known.providers.length > 0 && chosen !== undefined && !known.providers.includes(chosen)) {
		return failure(
			new Error(`Unknown ${feature} provider "${chosen}"; choose ${known.providers.join(", ")}`),
		);
	}
	if (feature === "auth") return planAuth(root, chosen ?? "r3-auth");
	if (feature === "billing") return planBilling(root, chosen ?? "polar");
	if (feature === "flags") return planFlags(root);
	return failure(new Error(`setup ${feature} is listed but has no planner yet`));
}

/** Plans then applies, returning early when the plan itself fails. */
export async function runSetup(
	root: string,
	feature: string,
	options: {
		provider: string | undefined;
		dryRun: boolean;
		yes: boolean;
		stdout: (text: string) => void;
	},
): Promise<Result<void, Error>> {
	let planned = await planSetup(root, feature, options.provider);
	if (isFailure(planned)) return planned;
	/** Without `-y`, the plan is printed and nothing is written — the agent-safe default. */
	let dryRun = !options.yes || options.dryRun;
	return applyPlan(root, planned.data, { dryRun, stdout: options.stdout });
}
