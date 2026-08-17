import type { CSSMixinDescriptor } from "remix/ui";

/**
 * These factories were rewritten to compose `@pkg/u/animation`'s
 * `keyframes()`/`animationHost()` instead of one hand-written style object.
 * `animationHost()` emits the longhand `animationName`/`animationDuration`/
 * `animationTimingFunction`/`animationIterationCount` properties rather than
 * the single `animation` shorthand the original hand-written version used —
 * a deliberate, computationally-equivalent design change (not a visual
 * regression), consistent with every other shorthand-to-longhand conversion
 * this migration has made elsewhere (e.g. `transition`).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { pulse, shimmer, spin, textShimmer } from "./keyframes";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("spin", () => {
	test("ungated: default rotation + reduced-motion breathe fallback", () => {
		expect(styles(spin())).toEqual({
			opacity: 1,
			transition:
				"opacity var(--ui-spin-fade-duration, 150ms) ease, display var(--ui-spin-fade-duration, 150ms) ease-out",
			transitionBehavior: "allow-discrete",
			"@starting-style": { "&": { opacity: 0 } },
			"@keyframes ui-spin-rotate": {
				from: { transform: "rotate(0deg)" },
				to: { transform: "rotate(360deg)" },
			},
			"@keyframes ui-spin-breathe": {
				"0%, 100%": { opacity: 1 },
				"50%": { opacity: 0.4 },
			},
			"&": {
				animationName: "ui-spin-rotate",
				animationDuration: "var(--ui-spin-duration, 1s)",
				animationTimingFunction: "var(--ui-spin-easing, linear)",
				animationIterationCount: "infinite",
			},
			"@media (prefers-reduced-motion: reduce)": {
				"&": {
					animationName: "ui-spin-breathe",
					animationDuration: "var(--ui-spin-duration, 1s)",
					animationTimingFunction: "ease-in-out",
					animationIterationCount: "infinite",
				},
			},
		});
	});

	test("gated behind a `when` selector", () => {
		expect(styles(spin({ when: '[aria-busy="true"]' }))).toEqual({
			opacity: 1,
			transition:
				"opacity var(--ui-spin-fade-duration, 150ms) ease, display var(--ui-spin-fade-duration, 150ms) ease-out",
			transitionBehavior: "allow-discrete",
			'&:not([aria-busy="true"])': { opacity: 0 },
			"@starting-style": { '&[aria-busy="true"]': { opacity: 0 } },
			"@keyframes ui-spin-rotate": {
				from: { transform: "rotate(0deg)" },
				to: { transform: "rotate(360deg)" },
			},
			"@keyframes ui-spin-breathe": {
				"0%, 100%": { opacity: 1 },
				"50%": { opacity: 0.4 },
			},
			'&[aria-busy="true"]': {
				animationName: "ui-spin-rotate",
				animationDuration: "var(--ui-spin-duration, 1s)",
				animationTimingFunction: "var(--ui-spin-easing, linear)",
				animationIterationCount: "infinite",
			},
			"@media (prefers-reduced-motion: reduce)": {
				'&[aria-busy="true"]': {
					animationName: "ui-spin-breathe",
					animationDuration: "var(--ui-spin-duration, 1s)",
					animationTimingFunction: "ease-in-out",
					animationIterationCount: "infinite",
				},
			},
		});
	});
});

describe("pulse", () => {
	test("default opacity range + reduced-motion narrowed amplitude", () => {
		expect(styles(pulse())).toEqual({
			opacity: 1,
			transition:
				"opacity var(--ui-pulse-fade-duration, 150ms) ease, display var(--ui-pulse-fade-duration, 150ms) ease-out",
			transitionBehavior: "allow-discrete",
			"@starting-style": { "&": { opacity: 0 } },
			"@keyframes ui-pulse-breathe": {
				"0%, 100%": { opacity: "var(--ui-pulse-max-opacity, 1)" },
				"50%": { opacity: "var(--ui-pulse-min-opacity, 0.5)" },
			},
			"&": {
				animationName: "ui-pulse-breathe",
				animationDuration: "var(--ui-pulse-duration, 1.6s)",
				animationTimingFunction: "var(--ui-pulse-easing, ease-in-out)",
				animationIterationCount: "infinite",
			},
			"@media (prefers-reduced-motion: reduce)": {
				"&": {
					"--ui-pulse-min-opacity": "0.8",
					animationDuration: "calc(var(--ui-pulse-duration, 1.6s) * 1.5)",
				},
			},
		});
	});
});

describe("shimmer", () => {
	test("default indeterminate-gated sweep + reduced-motion breathe fallback", () => {
		expect(styles(shimmer())).toEqual({
			opacity: 1,
			transition:
				"opacity var(--ui-shimmer-fade-duration, 150ms) ease, display var(--ui-shimmer-fade-duration, 150ms) ease-out",
			transitionBehavior: "allow-discrete",
			"&:not(:indeterminate)": { opacity: 0 },
			"@starting-style": { "&:indeterminate": { opacity: 0 } },
			"@keyframes ui-shimmer-sweep": {
				from: { backgroundPosition: "-100% 0" },
				to: { backgroundPosition: "200% 0" },
			},
			"@keyframes ui-shimmer-breathe": {
				"0%, 100%": { opacity: 1 },
				"50%": { opacity: 0.6 },
			},
			"&:indeterminate": {
				backgroundImage:
					"linear-gradient(90deg, transparent, color-mix(in oklab, currentColor 35%, transparent), transparent)",
				backgroundRepeat: "no-repeat",
				backgroundSize: "var(--ui-shimmer-band-size, 50%) 100%",
				animationName: "ui-shimmer-sweep",
				animationDuration: "var(--ui-shimmer-duration, 1.6s)",
				animationTimingFunction: "var(--ui-shimmer-easing, ease-in-out)",
				animationIterationCount: "infinite",
			},
			"@media (prefers-reduced-motion: reduce)": {
				"&:indeterminate": {
					animationName: "ui-shimmer-breathe",
					animationDuration: "var(--ui-shimmer-duration, 1.6s)",
					animationTimingFunction: "ease-in-out",
					animationIterationCount: "infinite",
				},
			},
		});
	});
});

describe("textShimmer", () => {
	test("default glyph sweep gated behind @supports, + reduced-motion breathe fallback", () => {
		expect(styles(textShimmer())).toEqual({
			opacity: 1,
			transition:
				"opacity var(--ui-text-shimmer-fade-duration, 150ms) ease, display var(--ui-text-shimmer-fade-duration, 150ms) ease-out",
			transitionBehavior: "allow-discrete",
			"@starting-style": { "&": { opacity: 0 } },
			"@supports (background-clip: text) or (-webkit-background-clip: text)": {
				"@keyframes ui-text-shimmer-sweep": {
					from: { backgroundPosition: "100% 0" },
					to: { backgroundPosition: "-100% 0" },
				},
				"@keyframes ui-text-shimmer-breathe": {
					"0%, 100%": { opacity: 1 },
					"50%": { opacity: 0.6 },
				},
				"&": {
					backgroundImage:
						"linear-gradient(var(--ui-text-shimmer-angle, 90deg), color-mix(in oklab, var(--ui-text-shimmer-color, currentColor) 45%, transparent) 0%, color-mix(in oklab, var(--ui-text-shimmer-color, currentColor) 45%, transparent) calc(50% - (var(--ui-text-shimmer-band-size, 30%) / 2)), var(--ui-text-shimmer-color, currentColor) 50%, color-mix(in oklab, var(--ui-text-shimmer-color, currentColor) 45%, transparent) calc(50% + (var(--ui-text-shimmer-band-size, 30%) / 2)), color-mix(in oklab, var(--ui-text-shimmer-color, currentColor) 45%, transparent) 100%)",
					backgroundSize: "200% 100%",
					backgroundRepeat: "no-repeat",
					WebkitBackgroundClip: "text",
					backgroundClip: "text",
					WebkitTextFillColor: "transparent",
					animationName: "ui-text-shimmer-sweep",
					animationDuration: "var(--ui-text-shimmer-duration, 2s)",
					animationTimingFunction: "var(--ui-text-shimmer-easing, linear)",
					animationIterationCount: "infinite",
				},
				"@media (prefers-reduced-motion: reduce)": {
					"&": {
						backgroundImage: "none",
						WebkitBackgroundClip: "border-box",
						backgroundClip: "border-box",
						WebkitTextFillColor: "currentColor",
						animationName: "ui-text-shimmer-breathe",
						animationDuration: "var(--ui-text-shimmer-duration, 2s)",
						animationTimingFunction: "ease-in-out",
						animationIterationCount: "infinite",
					},
				},
			},
		});
	});
});
