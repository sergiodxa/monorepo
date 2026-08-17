import { Database } from "remix/data-table";
/**
 * Covers deriving the runtime theme from stored settings: `Settings.theme` decodes
 * the persisted `settings.theme` JSON, and feeding it to `renderThemeStyle` yields
 * a `:root` block whose CSS variables reflect the stored knobs, falling back to the
 * engine defaults for any knob the owner never set.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { beforeEach, describe, expect, test } from "vitest";

import { renderThemeStyle } from "../../appearance/theme/theme";
import { createTestDatabase } from "../../shared/test/db";

import { Settings } from "./settings";

describe("Settings.theme", () => {
	let db: Database;

	beforeEach(async () => {
		({ db } = await createTestDatabase());
	});

	test("returns an empty object for the seeded (unconfigured) theme", async () => {
		// The seed stores `theme` as `{}`, meaning: apply engine defaults everywhere.
		expect(await Settings.theme(db)).toEqual({});
	});

	test("decodes the stored theme JSON into a partial settings object", async () => {
		await Settings.set(db, "theme", { accent: "#2563eb", measure: "72ch", spacing: "compact" });
		expect(await Settings.theme(db)).toEqual({
			accent: "#2563eb",
			measure: "72ch",
			spacing: "compact",
		});
	});

	test("falls back to {} when the stored theme value is malformed JSON", async () => {
		// Settings.get swallows JSON.parse errors and returns the fallback.
		await db.update(Settings.table, { key: "theme" }, { value: "{ not json" });
		expect(await Settings.theme(db)).toEqual({});
	});
});

describe("theme derivation from stored settings", () => {
	let db: Database;

	beforeEach(async () => {
		({ db } = await createTestDatabase());
	});

	test("renders a :root block whose variables reflect the stored knobs", async () => {
		await Settings.set(db, "theme", { accent: "#2563eb", measure: "72ch", spacing: "compact" });
		let css = renderThemeStyle(await Settings.theme(db));

		expect(css.startsWith(":root {")).toBe(true);
		// The stored non-color knobs pass through verbatim.
		expect(css).toContain("--blog-measure: 72ch");
		// Compact spacing resolves to its preset (not the "comfortable" default of 1rem).
		expect(css).not.toContain("--blog-spacing: 1rem");
		// The accent color drives an OKLCH accent ladder.
		expect(css).toContain("--color-accent-500:");
		expect(css).toContain("oklch(");
		// Semantic --ui-* tokens are wired to the derived palette.
		expect(css).toContain("--ui-accent: var(--blog-accent)");
	});

	test("unset knobs derive from the engine defaults", async () => {
		// Empty stored settings -> every knob comes from DEFAULT_THEME.
		let css = renderThemeStyle(await Settings.theme(db));
		expect(css).toContain("--blog-measure: 65ch");
		expect(css).toContain("--blog-spacing: 1rem");
	});

	test("a stored accent changes the derived accent token versus the default", async () => {
		let defaultCss = renderThemeStyle(await Settings.theme(db));

		await Settings.set(db, "theme", { accent: "#ff0000" });
		let redCss = renderThemeStyle(await Settings.theme(db));

		expect(redCss).not.toBe(defaultCss);
		expect(redCss).toContain("--blog-accent:");
	});
});
