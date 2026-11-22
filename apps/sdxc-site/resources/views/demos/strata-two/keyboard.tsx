/**
 * Strata Two drawn from above: the milled case, 84 keycaps on the 75% grid and the volume
 * knob, in one SVG whose every surface reads the finish's custom properties, so the picker
 * recolours each drawing of the board on the page at once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";

/** One keycap: its legend, width in key units, and whether it is a modifier or the accent key. */
interface KeySpec {
	label: string;
	width: number;
	role: "alpha" | "mod" | "accent" | "knob";
}

/** The pitch of one key unit in the drawing's coordinates. */
const UNIT = 20;

/** The case's margin around the plate, so the chamfer frames the keys like the milled lip. */
const BEZEL = 14;

/** The extra gap that separates the function row from the number row. */
const ROW_GAP = 5;

/** The drawing's size: sixteen units across, six rows down, inside the bezel. */
export const KEYBOARD_VIEW = {
	width: UNIT * 16 + BEZEL * 2,
	height: UNIT * 6 + ROW_GAP + BEZEL * 2,
} as const;

/** Keys of one unit with a legend each. */
function alphas(labels: string): KeySpec[] {
	return labels.split("").map((label) => ({ label, width: 1, role: "alpha" }));
}

/** A modifier of a given width. */
function mod(label: string, width = 1): KeySpec {
	return { label, width, role: "mod" };
}

/**
 * The 75% ANSI layout, row by row. Every row adds up to sixteen units, so the right
 * column of navigation keys lines up from the number row to the arrows.
 */
export const LAYOUT: KeySpec[][] = [
	[
		{ label: "esc", width: 1, role: "accent" },
		...["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12"].map(
			(label): KeySpec => ({ label, width: 1, role: "alpha" }),
		),
		mod("prt"),
		mod("del"),
		{ label: "", width: 1, role: "knob" },
	],
	[...alphas("`1234567890-="), mod("⌫", 2), mod("home")],
	[mod("tab", 1.5), ...alphas("QWERTYUIOP[]"), mod("\\", 1.5), mod("pg up")],
	[mod("caps", 1.75), ...alphas("ASDFGHJKL;'"), mod("return", 2.25), mod("pg dn")],
	[mod("shift", 2.25), ...alphas("ZXCVBNM,./"), mod("shift", 1.75), mod("↑"), mod("end")],
	[
		mod("ctrl", 1.25),
		mod("opt", 1.25),
		mod("cmd", 1.25),
		{ label: "", width: 6.25, role: "alpha" },
		mod("cmd"),
		mod("fn"),
		mod("ctrl"),
		mod("←"),
		mod("↓"),
		mod("→"),
	],
];

/** One placed key: where it sits in the drawing and what it shows. */
export interface PlacedKey extends KeySpec {
	x: number;
	y: number;
	/** The legend lowercased, so a scene can name the keys it presses. */
	id: string;
}

/** Every key with its position, computed once from {@link LAYOUT}. */
export const KEYS: PlacedKey[] = LAYOUT.flatMap((row, rowIndex) => {
	let x = BEZEL;
	let y = BEZEL + rowIndex * UNIT + (rowIndex > 0 ? ROW_GAP : 0);
	return row.map((key) => {
		let placed = { ...key, x, y, id: key.width > 6 ? "space" : key.label.toLowerCase() };
		x += key.width * UNIT;
		return placed;
	});
});

namespace Keyboard {
	export interface Props {
		/** Prefix for the drawing's gradient ids, unique per drawing on the page. */
		id: string;
		/** The accessible name; the drawing is decorative when omitted. */
		label?: string;
		/** Keys a scene marks with `data-key`, so its own CSS can press them. */
		pressable?: boolean;
	}
}

/**
 * Renders the board. The case's top face carries a raking sheen and a one-pixel chamfer
 * highlight, the light that defines the edge; each keycap is a skirt with a lighter dished
 * top, and the legends sit on the top so they move with it when a scene presses a key.
 *
 * @param handle Runtime handle carrying the id prefix, label and press hooks.
 * @returns The render function producing the drawing.
 */
export function Keyboard(handle: Handle<Keyboard.Props>) {
	return () => {
		let { id, label, pressable } = handle.props;
		let sheen = `${id}-sheen`;
		let knurl = `${id}-knurl`;

		return (
			<svg
				viewBox={`0 0 ${KEYBOARD_VIEW.width} ${KEYBOARD_VIEW.height}`}
				role={label ? "img" : undefined}
				aria-label={label}
				aria-hidden={label ? undefined : "true"}
				data-slot="strata-keyboard"
				mix={[
					raw({
						display: "block",
						inlineSize: "100%",
						blockSize: "auto",
						overflow: "visible",
						fontFamily: "var(--ui-font-sans)",
						"& [data-p=case]": { fill: "var(--strata-case-lo)" },
						"& [data-p=top]": { fill: "var(--strata-case-hi)" },
						"& [data-p=chamfer]": { stroke: "var(--strata-chamfer)" },
						"& [data-p=well]": { fill: "var(--strata-well)" },
						"& [data-r=alpha] [data-p=skirt]": { fill: "var(--strata-cap-lo)" },
						"& [data-r=alpha] [data-p=dish]": { fill: "var(--strata-cap-hi)" },
						"& [data-r=alpha] text": { fill: "var(--strata-legend)" },
						"& [data-r=mod] [data-p=skirt]": { fill: "var(--strata-mod-lo)" },
						"& [data-r=mod] [data-p=dish]": { fill: "var(--strata-mod-hi)" },
						"& [data-r=mod] text": { fill: "var(--strata-mod-legend)" },
						"& [data-r=accent] [data-p=skirt]": { fill: "var(--ui-color-brand-700)" },
						"& [data-r=accent] [data-p=dish]": { fill: "var(--ui-color-brand-500)" },
						"& [data-r=accent] text": { fill: "var(--ui-color-brand-50)" },
						"& [data-p=knob]": { fill: `url(#${knurl})` },
						"& [data-p=knob-cap]": { fill: "var(--strata-case-hi)" },
						"& [data-p=knob-dot]": { fill: "var(--ui-color-brand-500)" },
						"& [data-p=sheen-stop-a]": { stopColor: "white", stopOpacity: "0.28" },
						"& [data-p=sheen-stop-b]": { stopColor: "white", stopOpacity: "0" },
						"& [data-p=sheen-stop-c]": { stopColor: "black", stopOpacity: "0.12" },
						"& [data-p=knurl-a]": { stopColor: "var(--strata-case-hi)" },
						"& [data-p=knurl-b]": { stopColor: "var(--strata-case-lo)" },
						"& [data-key] [data-p=cap-top]": { transition: "translate 70ms ease-out" },
						"& [data-key]:is([data-down], :active) [data-p=cap-top]": {
							translate: "0 1.1px",
							transition: "none",
						},
						"& [data-key]:is([data-down], :active) [data-p=skirt]": { filter: "brightness(0.82)" },
						"& text": {
							fontSize: "4.6px",
							fontWeight: "500",
							letterSpacing: "0.01em",
							dominantBaseline: "hanging",
						},
					}),
				]}
			>
				<defs>
					<linearGradient id={sheen} x1="0" y1="0" x2="1" y2="1">
						<stop offset="0" data-p="sheen-stop-a" />
						<stop offset="0.45" data-p="sheen-stop-b" />
						<stop offset="1" data-p="sheen-stop-c" />
					</linearGradient>
					<radialGradient id={knurl} cx="0.4" cy="0.35" r="0.7">
						<stop offset="0" data-p="knurl-a" />
						<stop offset="1" data-p="knurl-b" />
					</radialGradient>
				</defs>
				<rect
					data-p="case"
					x="0"
					y="1.5"
					width={KEYBOARD_VIEW.width}
					height={KEYBOARD_VIEW.height - 1.5}
					rx="9"
				/>
				<rect
					data-p="top"
					x="0"
					y="0"
					width={KEYBOARD_VIEW.width}
					height={KEYBOARD_VIEW.height - 2}
					rx="9"
				/>
				<rect
					x="0"
					y="0"
					width={KEYBOARD_VIEW.width}
					height={KEYBOARD_VIEW.height - 2}
					rx="9"
					fill={`url(#${sheen})`}
				/>
				<rect
					data-p="chamfer"
					x="0.5"
					y="0.5"
					width={KEYBOARD_VIEW.width - 1}
					height={KEYBOARD_VIEW.height - 3}
					rx="8.5"
					fill="none"
					stroke-width="0.6"
				/>
				<rect
					data-p="well"
					x={BEZEL - 3}
					y={BEZEL - 3}
					width={UNIT * 16 + 6}
					height={UNIT * 6 + ROW_GAP + 6}
					rx="3"
				/>
				{KEYS.map((key) => (
					<KeyCap key={`${key.x}-${key.y}`} spec={key} pressable={pressable === true} />
				))}
			</svg>
		);
	};
}

namespace KeyCap {
	export interface Props {
		spec: PlacedKey;
		pressable: boolean;
	}
}

/**
 * One keycap or the knob. A pressable cap carries `data-key` with its legend, which is the
 * hook a scene's CSS presses it by.
 *
 * @param handle Runtime handle carrying the placed key.
 * @returns The render function producing the cap's group.
 */
function KeyCap(handle: Handle<KeyCap.Props>) {
	return () => {
		let { spec, pressable } = handle.props;
		let width = spec.width * UNIT - 2;
		let x = spec.x + 1;
		let y = spec.y + 1;

		if (spec.role === "knob") {
			let cx = x + width / 2;
			let cy = y + (UNIT - 2) / 2;
			return (
				<g data-r="knob">
					<circle data-p="knob" cx={cx} cy={cy} r="9.5" />
					<circle data-p="knob-cap" cx={cx} cy={cy} r="6.5" />
					<circle data-p="knob-dot" cx={cx} cy={cy - 4.5} r="0.9" />
				</g>
			);
		}

		return (
			<g data-r={spec.role} data-key={pressable ? spec.id : undefined}>
				<rect data-p="skirt" x={x} y={y} width={width} height={UNIT - 2} rx="2.2" />
				<g data-p="cap-top">
					<rect
						data-p="dish"
						x={x + 1.6}
						y={y + 1}
						width={width - 3.2}
						height={UNIT - 6}
						rx="1.8"
					/>
					{spec.label === "" ? null : (
						<text x={x + 3} y={y + 2.6}>
							{spec.label}
						</text>
					)}
				</g>
			</g>
		);
	};
}
