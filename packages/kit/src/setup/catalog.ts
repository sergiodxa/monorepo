/**
 * Features `sdxc setup` can install: each row names what the plan wires, so agents discover
 * the catalog the same way they discover `make` kinds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** One feature this kit release knows how to set up. */
export interface SetupFeature {
	/** The verb after `sdxc setup`, such as `auth`. */
	name: string;
	/** One sentence of what it wires. */
	description: string;
	/** Provider flag values this feature accepts; empty when it has none. */
	providers: readonly string[];
	/** Default `--provider` when the feature has providers. */
	defaultProvider?: string;
}

/**
 * Features shipped in this kit release. Further rows land only when their planner has a
 * deterministic file list a test can assert.
 */
export const SETUP_FEATURES: readonly SetupFeature[] = [
	{
		name: "auth",
		description:
			"OIDC relying party, login/callback/logout, client secrets, CSP formAction, signIn() helper",
		providers: ["r3-auth"],
		defaultProvider: "r3-auth",
	},
	{
		name: "billing",
		description:
			"@sdxc/billing provider, webhook route stub, portal/checkout secrets, empty product catalog",
		providers: ["polar"],
		defaultProvider: "polar",
	},
	{
		name: "flags",
		description:
			"@sdxc/flags + engine store, empty catalog, wide-event hook ready for router middleware",
		providers: [],
	},
];

/** Looks up a feature by name, or `null` when this release does not ship it. */
export function setupFeature(name: string): SetupFeature | null {
	return SETUP_FEATURES.find((feature) => feature.name === name) ?? null;
}
