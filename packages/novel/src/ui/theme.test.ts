/**
 * The typed theme helper: it keeps exactly the variables a game sets, and its keys are the
 * player's own variable names, so a misspelled or removed variable fails the type check.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { css } from "remix/component";
import { describe, expect, expectTypeOf, test } from "vitest";

import type { NovelTheme, NovelThemeVariable } from "./theme.js";

import { NOVEL_THEME_VARIABLES, theme, THEME_BRIDGE_STYLESHEET } from "./theme.js";

describe("theme", () => {
	test("returns the variables it is given, leaving out unset ones", () => {
		expect(
			theme({
				"--novel-accent": "#9c7630",
				"--novel-text-leading": 1.6,
				"--novel-color": undefined,
			}),
		).toEqual({ "--novel-accent": "#9c7630", "--novel-text-leading": 1.6 });
	});

	test("takes only the player's variable names, and fits css() and style", () => {
		expectTypeOf<keyof NovelTheme>().toEqualTypeOf<NovelThemeVariable>();
		expectTypeOf<NovelThemeVariable>().toEqualTypeOf<keyof typeof NOVEL_THEME_VARIABLES>();
		expectTypeOf(theme).parameter(0).toEqualTypeOf<NovelTheme>();
		// @ts-expect-error A misspelled variable is not a theme variable.
		theme({ "--novel-acent": "#9c7630" });
		// @ts-expect-error A removed variable is not a theme variable.
		theme({ "--novel-settings-switch-on": "#9c7630" });
		// @ts-expect-error Keys keep their `--novel-` prefix.
		theme({ accent: "#9c7630" });
		css(theme({ "--novel-dialog-color": "#f3e7cc" }));
	});
});

describe("THEME_BRIDGE_STYLESHEET", () => {
	test("reads only variables the theme declares", () => {
		let read = [...THEME_BRIDGE_STYLESHEET.matchAll(/var\((--novel-[\w-]+)/g)].map(
			([, name]) => name!,
		);
		let declared = Object.keys(NOVEL_THEME_VARIABLES);
		let own = read.filter((name) => !name.startsWith("--novel-ui-"));
		expect(own.filter((name) => !declared.includes(name))).toEqual([]);
	});
});
