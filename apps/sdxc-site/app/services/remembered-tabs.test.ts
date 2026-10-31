/**
 * Covers the reading of a remembered code-tab choice. The cookie is the reader's to edit,
 * so these keep a hand-written value rendering the default instead of an option the site
 * never offered, and keep the cache key empty for a reader who has chosen nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { rememberedTab, rememberedTabsVariant } from "~/app/services/remembered-tabs";

describe("rememberedTab", () => {
	test("reads the manager the reader picked", () => {
		expect(rememberedTab("theme=dark; ui-code-tabs.package-manager=bun", "package-manager")).toBe(
			"bun",
		);
	});

	test("reads nothing from an absent cookie", () => {
		expect(rememberedTab(null, "package-manager")).toBeUndefined();
		expect(rememberedTab("", "package-manager")).toBeUndefined();
	});

	test("drops a value the strip does not offer", () => {
		expect(rememberedTab("ui-code-tabs.package-manager=deno", "package-manager")).toBeUndefined();
	});
});

describe("rememberedTabsVariant", () => {
	test("names every remembered choice", () => {
		expect(rememberedTabsVariant("ui-code-tabs.package-manager=pnpm")).toBe("package-manager:pnpm");
	});

	test("is empty for a reader who has chosen nothing this site offers", () => {
		expect(rememberedTabsVariant(null)).toBe("");
		expect(rememberedTabsVariant("ui-code-tabs.package-manager=deno")).toBe("");
		expect(rememberedTabsVariant("sdxc:options=package-manager:bun")).toBe("");
	});
});
