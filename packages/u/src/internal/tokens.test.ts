/**
 * Unit tests for every pure token resolver in {@link "./tokens"}: each one
 * is a plain string function, so these tests assert directly on return
 * values rather than unwrapping a mixin descriptor.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import {
	blur,
	boxLength,
	color,
	container,
	font,
	isLength,
	radius,
	shadow,
	spacing,
	text,
} from "./tokens";

describe("spacing", () => {
	test("resolves a number against the spacing scale", () => {
		expect(spacing(4)).toBe("calc(var(--ui-spacing, 0.25rem) * 4)");
	});

	test("resolves 0 against the spacing scale", () => {
		expect(spacing(0)).toBe("calc(var(--ui-spacing, 0.25rem) * 0)");
	});

	test("passes 'auto' through unchanged", () => {
		expect(spacing("auto")).toBe("auto");
	});

	test("passes a raw CSS length string through unchanged", () => {
		expect(spacing("13px")).toBe("13px");
		expect(spacing("60ch")).toBe("60ch");
	});
});

describe("isLength", () => {
	test("accepts every documented unit", () => {
		for (let value of [
			"1px",
			"1ch",
			"1em",
			"1rem",
			"1%",
			"1vw",
			"1vh",
			"1dvw",
			"1dvh",
			"1vi",
			"1vb",
			"1svw",
			"1svh",
			"1lvw",
			"1lvh",
			"1cqw",
			"1cqh",
			"1cqmin",
			"1cqmax",
		]) {
			expect(isLength(value)).toBe(true);
		}
	});

	test("accepts negative and decimal lengths", () => {
		expect(isLength("-1px")).toBe(true);
		expect(isLength("1.5rem")).toBe(true);
	});

	test("rejects non-length strings and non-strings", () => {
		expect(isLength("auto")).toBe(false);
		expect(isLength("full")).toBe(false);
		expect(isLength(4)).toBe(false);
	});
});

describe("color", () => {
	test("resolves a raw palette reference", () => {
		expect(color("color.neutral.50")).toBe("var(--ui-color-neutral-50)");
		expect(color("color.brand.600")).toBe("var(--ui-color-brand-600)");
	});

	test("resolves a semantic tone with an explicit friendly suffix, aliased to its property segment", () => {
		expect(color("brand.tint")).toBe("var(--ui-brand-bg-tint)");
		expect(color("brand.solid")).toBe("var(--ui-brand-bg-solid)");
		expect(color("brand.muted")).toBe("var(--ui-brand-fg-muted)");
		expect(color("brand.emphasis")).toBe("var(--ui-brand-fg-emphasis)");
		expect(color("brand.onSolid")).toBe("var(--ui-brand-fg-on-solid)");
		expect(color("brand.strong")).toBe("var(--ui-brand-border-strong)");
	});

	test("resolves 'currentcolor' regardless of case", () => {
		expect(color("currentColor")).toBe("currentColor");
		expect(color("currentcolor")).toBe("currentColor");
	});

	test("resolves an explicit suffix that isn't a friendly alias verbatim", () => {
		expect(color("brand.border")).toBe("var(--ui-brand-border)");
		expect(color("brand.ring")).toBe("var(--ui-brand-ring)");
	});

	test("resolves a bare tone using the given default property", () => {
		expect(color("brand", "fg")).toBe("var(--ui-brand-fg)");
		expect(color("danger", "border")).toBe("var(--ui-danger-border)");
	});

	test("throws when a bare tone has no explicit suffix and no default is given", () => {
		expect(() => color("brand")).toThrow();
	});

	test("passes an already-fully-formed CSS color function through unchanged", () => {
		expect(color("color-mix(in oklab, red 50%, blue)")).toBe("color-mix(in oklab, red 50%, blue)");
	});

	test("passes a raw var() reference through unchanged", () => {
		expect(color("var(--some-color)")).toBe("var(--some-color)");
	});
});

describe("radius", () => {
	test("resolves a named radius with its fallback", () => {
		expect(radius("lg")).toBe("var(--ui-radius-lg, 0.5rem)");
		expect(radius("full")).toBe("var(--ui-radius-full, 9999px)");
		expect(radius("none")).toBe("var(--ui-radius-none, 0px)");
	});

	test("falls back to 0px for an unrecognized name", () => {
		expect(radius("made-up")).toBe("var(--ui-radius-made-up, 0px)");
	});

	test("passes a raw CSS length through unchanged instead of treating it as a token name", () => {
		expect(radius("3px")).toBe("3px");
		expect(radius("0.125rem")).toBe("0.125rem");
	});
});

describe("font", () => {
	test("resolves a named font family with its fallback stack", () => {
		expect(font("serif")).toBe("var(--ui-font-serif, ui-serif, Georgia, serif)");
		expect(font("mono")).toBe("var(--ui-font-mono, ui-monospace, SFMono-Regular, monospace)");
	});

	test("falls back to sans-serif for an unrecognized name", () => {
		expect(font("made-up")).toBe("var(--ui-font-made-up, sans-serif)");
	});
});

describe("text", () => {
	test("resolves a named text size with its fallback", () => {
		expect(text("lg")).toBe("var(--ui-text-lg, 1.125rem)");
		expect(text("9xl")).toBe("var(--ui-text-9xl, 8rem)");
	});

	test("falls back to 1rem for an unrecognized name", () => {
		expect(text("made-up")).toBe("var(--ui-text-made-up, 1rem)");
	});

	test("passes a raw CSS length through unchanged instead of treating it as a token name", () => {
		expect(text("0.9375rem")).toBe("0.9375rem");
	});
});

describe("container", () => {
	test("resolves a named container breakpoint with its fallback", () => {
		expect(container("md")).toBe("var(--ui-container-md, 36rem)");
		expect(container("2xl")).toBe("var(--ui-container-2xl, 80rem)");
	});

	test("falls back to 36rem for an unrecognized name", () => {
		expect(container("made-up")).toBe("var(--ui-container-made-up, 36rem)");
	});

	test("passes a raw CSS length through unchanged instead of treating it as a token name", () => {
		expect(container("40rem")).toBe("40rem");
	});
});

describe("shadow", () => {
	test("resolves a named shadow with its fallback", () => {
		expect(shadow("sm")).toBe("var(--ui-shadow-sm, 0 1px 2px 0 rgb(0 0 0 / 0.05))");
	});

	test("resolves the base shadow with its fallback", () => {
		expect(shadow("base")).toBe(
			"var(--ui-shadow-base, 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1))",
		);
	});

	test("falls back to the md shadow for an unrecognized name", () => {
		expect(shadow("made-up")).toBe(
			"var(--ui-shadow-made-up, 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1))",
		);
	});

	test("resolves the xl shadow with its fallback", () => {
		expect(shadow("xl")).toBe(
			"var(--ui-shadow-xl, 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1))",
		);
	});
});

describe("blur", () => {
	test("resolves a named blur with its fallback", () => {
		expect(blur("sm")).toBe("var(--ui-blur-sm, 4px)");
		expect(blur("lg")).toBe("var(--ui-blur-lg, 24px)");
	});

	test("falls back to the md blur for an unrecognized name", () => {
		expect(blur("made-up")).toBe("var(--ui-blur-made-up, 12px)");
	});

	test("passes a raw CSS length through unchanged instead of treating it as a token name", () => {
		expect(blur("8px")).toBe("8px");
	});
});

describe("boxLength", () => {
	test("resolves 'full' to 100%", () => {
		expect(boxLength("full")).toBe("100%");
	});

	test("otherwise delegates to spacing()", () => {
		expect(boxLength(4)).toBe("calc(var(--ui-spacing, 0.25rem) * 4)");
		expect(boxLength("auto")).toBe("auto");
		expect(boxLength("60ch")).toBe("60ch");
	});
});
