/**
 * The customization rules the gallery's server and its controls share: the stroke an icon is
 * drawn with, and the address and props a customization is written as.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	DEFAULT_ICON_STYLE,
	drawnStrokeWidth,
	iconStyleParams,
	iconStyleProps,
	iconStyleVars,
} from "~/app/services/icon-style";

describe("drawnStrokeWidth", () => {
	test("scales an absolute stroke against the size, so it keeps its width on screen", () => {
		expect(drawnStrokeWidth({ ...DEFAULT_ICON_STYLE, size: 48, absoluteStrokeWidth: true })).toBe(
			1,
		);
		expect(drawnStrokeWidth({ ...DEFAULT_ICON_STYLE, size: 48 })).toBe(2);
	});
});

describe("iconStyleParams", () => {
	test("names nothing for the default, so the plain gallery keeps its plain address", () => {
		expect(iconStyleParams(DEFAULT_ICON_STYLE).toString()).toBe("");
	});

	test("names only what differs", () => {
		let style = { ...DEFAULT_ICON_STYLE, size: 32, absoluteStrokeWidth: true };
		expect(iconStyleParams(style).toString()).toBe("size=32&absolute=1");
	});
});

describe("iconStyleProps", () => {
	test("writes the props a reader would, in the order LucideProps lists them", () => {
		let style = { size: 32, strokeWidth: 1.5, absoluteStrokeWidth: true, color: "#ff0000" };
		expect(iconStyleProps(style)).toBe(
			'size={32} strokeWidth={1.5} absoluteStrokeWidth color="#ff0000"',
		);
	});
});

describe("iconStyleVars", () => {
	test("leaves the colour to the text around the icon until one is picked", () => {
		expect(iconStyleVars(DEFAULT_ICON_STYLE)).toEqual({
			"--icon-size": "24px",
			"--icon-stroke-width": "2",
		});
	});
});
