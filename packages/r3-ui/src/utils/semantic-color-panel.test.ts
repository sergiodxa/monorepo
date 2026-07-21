/**
 * Unit tests for {@link "./semantic-color-panel"}: every assertion checks a
 * built style object against its expected `--ui-*` variable references, with
 * no DOM and no rendering involved.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { semanticColorPanelStyle } from "./semantic-color-panel";

describe(semanticColorPanelStyle.name, () => {
	test("builds the border, tinted background, and emphasized foreground for a color", () => {
		expect(semanticColorPanelStyle("danger")).toEqual({
			borderColor: "var(--ui-danger-border)",
			backgroundColor: "var(--ui-danger-bg-tint)",
			color: "var(--ui-danger-fg-emphasis)",
		});
	});

	test("reads every semantic color's own variables rather than a fixed color", () => {
		expect(semanticColorPanelStyle("primary").borderColor).toBe("var(--ui-primary-border)");
		expect(semanticColorPanelStyle("success").backgroundColor).toBe("var(--ui-success-bg-tint)");
		expect(semanticColorPanelStyle("warning").color).toBe("var(--ui-warning-fg-emphasis)");
		expect(semanticColorPanelStyle("neutral")).toEqual({
			borderColor: "var(--ui-neutral-border)",
			backgroundColor: "var(--ui-neutral-bg-tint)",
			color: "var(--ui-neutral-fg-emphasis)",
		});
	});
});
