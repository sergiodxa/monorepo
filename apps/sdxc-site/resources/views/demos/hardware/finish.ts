/**
 * Strata Two's three finishes, and the page-wide hook that recolours every drawing of the
 * board when a finish's radio is checked. The radios live in the finishes band and belong
 * to the preorder form, so choosing a finish needs no script and travels with the order.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { combine, raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";

/** The custom properties a finish sets; the keyboard drawing reads nothing else for colour. */
interface FinishColours {
	"--strata-case-hi": string;
	"--strata-case-lo": string;
	"--strata-chamfer": string;
	"--strata-well": string;
	"--strata-cap-hi": string;
	"--strata-cap-lo": string;
	"--strata-legend": string;
	"--strata-mod-hi": string;
	"--strata-mod-lo": string;
	"--strata-mod-legend": string;
}

/** One finish: its form value, its name, how it is made, and its colours. */
export interface Finish {
	value: "raw" | "graphite" | "bronze";
	name: string;
	process: string;
	swatch: string;
	colours: FinishColours;
}

/** The finishes in the order the picker lists them; the first is checked by default. */
export const FINISHES: Finish[] = [
	{
		value: "raw",
		name: "Raw",
		process: "Bead-blasted, clear anodised",
		swatch: "linear-gradient(135deg, oklch(0.93 0.004 250), oklch(0.72 0.007 250))",
		colours: {
			"--strata-case-hi": "oklch(0.86 0.005 250)",
			"--strata-case-lo": "oklch(0.64 0.007 250)",
			"--strata-chamfer": "oklch(0.99 0 0 / 0.9)",
			"--strata-well": "oklch(0.36 0.006 250)",
			"--strata-cap-hi": "oklch(0.965 0.003 250)",
			"--strata-cap-lo": "oklch(0.86 0.005 250)",
			"--strata-legend": "oklch(0.32 0.01 250)",
			"--strata-mod-hi": "oklch(0.8 0.006 250)",
			"--strata-mod-lo": "oklch(0.68 0.007 250)",
			"--strata-mod-legend": "oklch(0.26 0.01 250)",
		},
	},
	{
		value: "graphite",
		name: "Graphite",
		process: "Bead-blasted, hard anodised",
		swatch: "linear-gradient(135deg, oklch(0.48 0.006 250), oklch(0.26 0.006 250))",
		colours: {
			"--strata-case-hi": "oklch(0.42 0.006 250)",
			"--strata-case-lo": "oklch(0.24 0.006 250)",
			"--strata-chamfer": "oklch(0.86 0.004 250 / 0.85)",
			"--strata-well": "oklch(0.16 0.004 250)",
			"--strata-cap-hi": "oklch(0.33 0.005 250)",
			"--strata-cap-lo": "oklch(0.25 0.005 250)",
			"--strata-legend": "oklch(0.9 0.004 250)",
			"--strata-mod-hi": "oklch(0.44 0.005 250)",
			"--strata-mod-lo": "oklch(0.33 0.005 250)",
			"--strata-mod-legend": "oklch(0.95 0.003 250)",
		},
	},
	{
		value: "bronze",
		name: "Bronze",
		process: "Bead-blasted, bronze anodised",
		swatch: "linear-gradient(135deg, oklch(0.74 0.06 70), oklch(0.47 0.05 60))",
		colours: {
			"--strata-case-hi": "oklch(0.66 0.055 68)",
			"--strata-case-lo": "oklch(0.46 0.045 60)",
			"--strata-chamfer": "oklch(0.93 0.04 78 / 0.9)",
			"--strata-well": "oklch(0.25 0.02 60)",
			"--strata-cap-hi": "oklch(0.95 0.018 85)",
			"--strata-cap-lo": "oklch(0.85 0.025 80)",
			"--strata-legend": "oklch(0.36 0.03 60)",
			"--strata-mod-hi": "oklch(0.42 0.025 60)",
			"--strata-mod-lo": "oklch(0.32 0.022 60)",
			"--strata-mod-legend": "oklch(0.93 0.02 80)",
		},
	},
];

/** The radio group name the picker and the preorder form share. */
export const FINISH_FIELD = "finish";

/** The id of a finish's radio, which the page's `:has()` hook watches. */
export function finishInputId(value: Finish["value"]): string {
	return `strata-finish-${value}`;
}

/**
 * Sets the default finish's colours on the page root and swaps them while another
 * finish's radio is checked. The swatches, every drawing of the board and the preorder
 * summary all follow, without a line of script.
 *
 * @returns One mixin for the element that wraps the whole page.
 */
export function finishColours() {
	let [first, ...rest] = FINISHES;
	return combine([
		raw({ ...first?.colours }),
		...rest.map((finish) =>
			when(`&:has(#${finishInputId(finish.value)}:checked)`, raw({ ...finish.colours })),
		),
		...FINISHES.map((finish) =>
			when(
				`&:has(#${finishInputId(finish.value)}:checked) [data-finish-name]:not([data-finish-name=${finish.value}])`,
				raw({ display: "none" }),
			),
		),
	]);
}
