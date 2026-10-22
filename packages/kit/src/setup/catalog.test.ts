/**
 * The setup feature catalog lists auth, billing and flags for agents to discover.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { SETUP_FEATURES, listFeatures, setupFeature } from "./index.js";

describe("setup catalog", () => {
	test("ships auth, billing and flags", () => {
		expect(SETUP_FEATURES.map((feature) => feature.name)).toEqual(["auth", "billing", "flags"]);
	});

	test("listFeatures names each row without monorepo app references", () => {
		let listed = listFeatures();
		expect(listed).toContain("auth");
		expect(listed).toContain("billing");
		expect(listed).toContain("flags");
		expect(listed).not.toMatch(/\bblog\b/);
		expect(listed).not.toMatch(/\buptime\b/);
	});

	test("setupFeature looks up by name", () => {
		expect(setupFeature("auth")?.defaultProvider).toBe("r3-auth");
		expect(setupFeature("missing")).toBeNull();
	});
});
