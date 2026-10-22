/**
 * The exact-pin install command `sdxc doctor` prints as a fix, spelled for each package manager
 * and keeping every package in the dependency section that lists it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vite-plus/test";

import { packageManager } from "../package-manager.js";

import { exactInstallCommand } from "./install.js";

/** A manifest listing one runtime and one development `@sdxc/*` package. */
const MANIFEST = {
	dependencies: { "@sdxc/cli": "2026.9.4" },
	devDependencies: { "@sdxc/jwt": "2026.9.1" },
};

/** The versions both packages move to. */
const VERSIONS = new Map([
	["@sdxc/cli", "2026.10.14"],
	["@sdxc/jwt", "2026.10.1"],
]);

describe("exactInstallCommand", () => {
	test.each([
		["bun", "bun add --exact @sdxc/cli@2026.10.14 && bun add --exact --dev @sdxc/jwt@2026.10.1"],
		[
			"npm",
			"npm install --save-exact @sdxc/cli@2026.10.14 && npm install --save-exact --save-dev @sdxc/jwt@2026.10.1",
		],
		[
			"pnpm",
			"pnpm add --save-exact @sdxc/cli@2026.10.14 && pnpm add --save-exact --save-dev @sdxc/jwt@2026.10.1",
		],
		["yarn", "yarn add --exact @sdxc/cli@2026.10.14 && yarn add --exact --dev @sdxc/jwt@2026.10.1"],
	] as const)("spells %s's exact add per dependency section", async (name, command) => {
		let manager = await packageManager({ declared: name, findLockFile: () => null });
		expect(exactInstallCommand(manager, MANIFEST, VERSIONS)).toBe(command);
	});
});
