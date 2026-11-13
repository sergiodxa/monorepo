/**
 * A label an issue, pull request or record carries, drawn as a small pill in the label's own
 * colour. Any colour goes in and the text stays readable on its tint in light and dark, so
 * labels whose colours people pick themselves never need a hand-tuned text colour.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { mergeMix, raw } from "@sdxc/u/general";
import { inlineFlex, items, shrink } from "@sdxc/u/layout";
import { nowrap } from "@sdxc/u/typography";

import { mergeStyle } from "../utils/merge-style.js";

/** Custom property carrying the label's colour to every rule that derives from it. */
const COLOR_PROPERTY = "--ui-label-chip-color";

/** The label's colour as the rules read it. */
const COLOR = `var(${COLOR_PROPERTY})`;

/** Lightness of the colour a `hue` stands for: a mid-tone, which both themes derive from well. */
const HUE_LIGHTNESS = 0.62;

/** Chroma of the colour a `hue` stands for. */
const HUE_CHROMA = 0.15;

/** The colour a label without `color` or `hue` takes: a quiet grey. */
const DEFAULT_COLOR = "oklch(0.62 0 0)";

/**
 * Prop types for {@link LabelChip}.
 */
export namespace LabelChip {
	/**
	 * How the colour shows: `pill` tints the whole chip and its text, `dot` keeps a neutral
	 * outlined chip with the colour in a dot before the name, for dense rows.
	 */
	export type Variant = "pill" | "dot";

	/** Every native `<span>` attribute plus the label's colour and look. */
	export interface Props extends TagProps<"span"> {
		/** Any CSS colour (`#d73a4a`, `oklch(0.63 0.19 25)`), as the label was defined. */
		color?: string;
		/** A hue in degrees, used when `color` is absent; it stands for a mid-tone colour. */
		hue?: number;
		/** @default "pill" */
		variant?: Variant;
		/** The label's name. */
		children?: RemixNode;
	}
}

/**
 * Renders the chip as plain HTML and CSS. A pill derives tint, border and text from the colour at
 * fixed OKLCH lightness through `light-dark()`, so text clears 4.5:1 for every hue in the page's
 * `color-scheme`; the dot variant reads neutral roles. Rules read the colour from `--ui-label-chip-color`.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the chip's markup.
 * @example <LabelChip color="#d73a4a">bug</LabelChip>
 * @example <LabelChip hue={150}>{t("labels.feature")}</LabelChip>
 * @example <LabelChip variant="dot" color={label.color}>{label.name}</LabelChip>
 */
export function LabelChip(handle: Handle<LabelChip.Props>) {
	return () => {
		let { children, color, hue, mix, style, variant = "pill", ...rest } = handle.props;
		let resolved = color ?? (hue === undefined ? DEFAULT_COLOR : hueColor(hue));
		let dot = variant === "dot";

		return (
			<span
				{...rest}
				data-slot="label-chip"
				data-variant={variant}
				style={mergeStyle(style, { [COLOR_PROPERTY]: resolved })}
				mix={mergeMix(
					[
						inlineFlex(),
						items("center"),
						nowrap(),
						raw({
							gap: "0.3125rem",
							blockSize: "1.25rem",
							paddingInline: "0.4375rem",
							boxSizing: "border-box",
							borderWidth: "1px",
							borderStyle: "solid",
							borderRadius: "999px",
							fontSize: "0.75rem",
							lineHeight: "1rem",
						}),
						dot ? dotRules() : pillRules(),
					],
					mix,
				)}
			>
				{dot ? (
					<span
						aria-hidden="true"
						data-slot="label-chip-dot"
						mix={[
							shrink(0),
							raw({
								inlineSize: "0.5rem",
								blockSize: "0.5rem",
								borderRadius: "999px",
								backgroundColor: COLOR,
							}),
						]}
					/>
				) : null}
				{children}
			</span>
		);
	};
}

/** The colour a hue stands for. */
function hueColor(hue: number): string {
	return `oklch(${HUE_LIGHTNESS} ${HUE_CHROMA} ${hue})`;
}

/**
 * Re-derives the label's colour at one lightness and capped chroma. Fixing lightness is
 * what holds contrast for any hue; capping chroma keeps the result inside sRGB, where
 * clipping would shift its lightness.
 */
function derive(lightness: number, chroma: number): string {
	return `oklch(from ${COLOR} ${lightness} min(c, ${chroma}) h)`;
}

/** A pill's tint, border and text, one pair of lightnesses per theme. */
function pillRules() {
	return raw({
		fontWeight: 500,
		backgroundColor: `light-dark(${derive(0.95, 0.05)}, ${derive(0.3, 0.07)})`,
		borderColor: `light-dark(${derive(0.85, 0.09)}, ${derive(0.42, 0.1)})`,
		color: `light-dark(${derive(0.42, 0.14)}, ${derive(0.86, 0.1)})`,
	});
}

/** The dot variant's neutral outline and text, which the page's theme already makes readable. */
function dotRules() {
	return raw({
		borderColor: "var(--ui-neutral-border)",
		color: "var(--ui-neutral-fg)",
	});
}
