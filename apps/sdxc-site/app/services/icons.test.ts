/**
 * The icon catalogue the gallery reads: which icons a query keeps, how a name resolves,
 * and the versioned sprite address every tile draws from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { LUCIDE_VERSION } from "@sdxc/icons";
import { describe, expect, test } from "vitest";

import { iconMarkdown } from "~/app/services/catalogue-markdown";
import { filterIcons, findIcon, listIcons, spriteHref } from "~/app/services/icons";

describe("filterIcons", () => {
	let icons = listIcons();

	test("keeps every icon for a blank query", () => {
		expect(filterIcons(icons, "   ")).toHaveLength(icons.length);
	});

	test("matches a tag as well as a name", () => {
		let names = filterIcons(icons, "love").map((icon) => icon.name);
		expect(names).toContain("heart");
	});

	test("requires every word, so a second word narrows the grid", () => {
		let arrows = filterIcons(icons, "arrow");
		let up = filterIcons(icons, "arrow up");
		expect(up.length).toBeGreaterThan(0);
		expect(up.length).toBeLessThan(arrows.length);
		expect(up.map((icon) => icon.name)).toContain("arrow-up");
	});

	test("reads a spaced query against a hyphenated name", () => {
		expect(filterIcons(icons, "Circle Alert").map((icon) => icon.name)).toContain("circle-alert");
	});
});

describe("findIcon", () => {
	test("names the component the package exports for the icon", () => {
		expect(findIcon("circle-alert")).toMatchObject({ component: "CircleAlertIcon" });
	});

	test("answers null for a name the package has no icon for, inherited keys included", () => {
		expect(findIcon("trash-2")).toBeNull();
		expect(findIcon("constructor")).toBeNull();
	});
});

describe("spriteHref", () => {
	test("carries the Lucide version, so each release of the icons is its own address", () => {
		expect(spriteHref()).toBe(`/api/icons/sprite.svg?v=${LUCIDE_VERSION}`);
	});
});

describe("iconMarkdown", () => {
	test("credits Lucide before the code", () => {
		let source = iconMarkdown(findIcon("heart")!, "<svg></svg>");
		expect(source.indexOf("https://lucide.dev/sponsor")).toBeLessThan(
			source.indexOf("## By component"),
		);
		expect(source).toContain('<HeartIcon aria-hidden="true" />');
		expect(source).toContain('<Icon name="heart" aria-hidden="true" />');
	});
});
