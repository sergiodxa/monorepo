/**
 * Unit tests for the `style` prop merge in {@link "./merge-style"}: every
 * assertion feeds one of the two prop forms plus a declaration record and
 * checks the merged result through direct calls to the function.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { mergeStyle } from "./merge-style.js";

describe(mergeStyle.name, () => {
	test("appends declarations to a CSS text prop", () => {
		expect(mergeStyle("color:red", { "--ui-slider-fill": "40%" })).toBe(
			"color:red;--ui-slider-fill:40%",
		);
	});

	test("appends every declaration in order to a CSS text prop", () => {
		expect(
			mergeStyle("color:red", {
				"--ui-color-wheel-value": "hsl(120 100% 50%)",
				"--ui-color-wheel-hue": "120",
			}),
		).toBe("color:red;--ui-color-wheel-value:hsl(120 100% 50%);--ui-color-wheel-hue:120");
	});

	test("assigns declarations over a declaration object prop", () => {
		expect(mergeStyle({ color: "red" }, { "--ui-slider-fill": "40%" })).toEqual({
			color: "red",
			"--ui-slider-fill": "40%",
		});
	});

	test("leaves the caller's object untouched", () => {
		let style = { color: "red" };

		mergeStyle(style, { "--ui-slider-fill": "40%" });

		expect(style).toEqual({ color: "red" });
	});

	test("lets a declaration win over the same property already on the prop", () => {
		expect(mergeStyle({ "--ui-aspect-ratio": "1 / 1" }, { "--ui-aspect-ratio": "16 / 9" })).toEqual(
			{ "--ui-aspect-ratio": "16 / 9" },
		);
	});

	test("drops declarations with no value from either form", () => {
		expect(
			mergeStyle("color:red", {
				"--ui-resizable-panel-size": "30%",
				"--ui-resizable-panel-min-size": null,
				"--ui-resizable-panel-max-size": undefined,
			}),
		).toBe("color:red;--ui-resizable-panel-size:30%");

		expect(
			mergeStyle(
				{ color: "red" },
				{ "--ui-resizable-panel-size": "30%", "--ui-resizable-panel-min-size": null },
			),
		).toEqual({ color: "red", "--ui-resizable-panel-size": "30%" });
	});

	test("emits only the declarations when the prop is an empty string", () => {
		expect(mergeStyle("", { "--ui-aspect-ratio": "16 / 9" })).toBe("--ui-aspect-ratio:16 / 9");
	});

	test("returns just the declarations when the prop is absent", () => {
		expect(mergeStyle(undefined, { "--ui-aspect-ratio": "16 / 9" })).toEqual({
			"--ui-aspect-ratio": "16 / 9",
		});
	});
});
