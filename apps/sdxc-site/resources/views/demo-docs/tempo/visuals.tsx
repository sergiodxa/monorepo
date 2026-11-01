/**
 * The drawings Tempo's reference pages put beside each call: padding and gaps hatched,
 * colour ramps as swatches, flex and grid layouts laid out in boxes, type set at every step,
 * and radius, shadow and opacity tiles, so a reader sees what a utility does before reading it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";

import { Code } from "~/resources/views/demo-docs/blocks";

/** The shade names of every Tempo palette, lightest first. */
export const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

/** The lightness of each shade, so every hue's ramp steps evenly from paper to ink. */
const LIGHTNESS = [0.975, 0.94, 0.88, 0.8, 0.71, 0.62, 0.54, 0.46, 0.38, 0.3, 0.22];

/** How much of a hue's chroma each shade carries, peaking in the middle of the ramp. */
const CHROMA_CURVE = [0.12, 0.25, 0.45, 0.7, 0.9, 1, 0.95, 0.85, 0.7, 0.55, 0.4];

/** One of Tempo's palettes: the name a call uses, its hue and its strongest chroma. */
export interface Palette {
	name: string;
	hue: number;
	chroma: number;
}

/** The palettes Tempo ships, in the order the colour page lists them. */
export const PALETTES: Palette[] = [
	{ name: "stone", hue: 250, chroma: 0.02 },
	{ name: "clay", hue: 35, chroma: 0.16 },
	{ name: "ochre", hue: 80, chroma: 0.15 },
	{ name: "moss", hue: 145, chroma: 0.15 },
	{ name: "tide", hue: 200, chroma: 0.13 },
	{ name: "ink", hue: 265, chroma: 0.18 },
	{ name: "plum", hue: 320, chroma: 0.17 },
];

/**
 * The colour a palette name and shade resolve to, the same in light and dark mode because a
 * swatch shows a value rather than a role.
 *
 * @example swatch("tide", 500) // "oklch(0.62 0.13 200)"
 */
export function swatch(name: string, shade: (typeof SHADES)[number]): string {
	let palette = PALETTES.find((entry) => entry.name === name) ?? PALETTES[0]!;
	let index = SHADES.indexOf(shade);
	let chroma = +(palette.chroma * CHROMA_CURVE[index]!).toFixed(3);
	return `oklch(${LIGHTNESS[index]} ${chroma} ${palette.hue})`;
}

/** Tempo's spacing steps, each a quarter of a rem. */
export const SPACING_STEPS = [0, 1, 2, 3, 4, 6, 8, 12, 16] as const;

/** The type scale's steps with the size each sets, smallest first. */
export const TYPE_SCALE: Array<{ step: string; size: string; leading: string }> = [
	{ step: "xs", size: "0.75rem", leading: "1rem" },
	{ step: "sm", size: "0.875rem", leading: "1.25rem" },
	{ step: "base", size: "1rem", leading: "1.5rem" },
	{ step: "lg", size: "1.125rem", leading: "1.75rem" },
	{ step: "xl", size: "1.25rem", leading: "1.75rem" },
	{ step: "2xl", size: "1.5rem", leading: "2rem" },
	{ step: "3xl", size: "1.875rem", leading: "2.25rem" },
	{ step: "4xl", size: "2.25rem", leading: "2.5rem" },
];

/** The corner radii with the value each sets. */
export const RADII: Array<{ step: string; value: string }> = [
	{ step: "none", value: "0" },
	{ step: "sm", value: "0.25rem" },
	{ step: "md", value: "0.5rem" },
	{ step: "lg", value: "0.75rem" },
	{ step: "xl", value: "1rem" },
	{ step: "full", value: "9999px" },
];

/** The elevations with the shadow each casts, drawn the same way on the page and in the CSS column. */
export const SHADOWS: Array<{ step: string; value: string }> = [
	{ step: "xs", value: "0 1px 2px oklch(0.2 0.02 250 / 0.08)" },
	{
		step: "sm",
		value: "0 1px 3px oklch(0.2 0.02 250 / 0.12), 0 1px 2px oklch(0.2 0.02 250 / 0.08)",
	},
	{ step: "md", value: "0 4px 8px -2px oklch(0.2 0.02 250 / 0.14)" },
	{ step: "lg", value: "0 12px 20px -6px oklch(0.2 0.02 250 / 0.18)" },
	{ step: "xl", value: "0 24px 40px -12px oklch(0.2 0.02 250 / 0.24)" },
];

/** The CSS length a spacing step sets. */
export function space(step: number): string {
	return step === 0 ? "0" : `${step * 0.25}rem`;
}

/** Diagonal brand hatching, the mark for space a utility reserves. */
const HATCH = {
	backgroundImage:
		"repeating-linear-gradient(-45deg, var(--ui-brand-border) 0 1px, transparent 1px 7px)",
	boxShadow: "inset 0 0 0 1px var(--ui-brand-border)",
} as const;

namespace Example {
	export interface Props {
		/** The calls that drew the preview, printed under it. */
		code: string;
		/** Lays the drawing out as a column instead of a wrapping row. */
		column?: boolean;
		children: RemixNode;
	}
}

/**
 * A drawing on a dotted stage with the code that produced it underneath, so the result and
 * the call read together without switching tabs.
 */
export function Example(handle: Handle<Example.Props>) {
	return () => {
		let { children, code, column = false } = handle.props;
		return (
			<figure data-not-typeset="" mix={[raw({ margin: "var(--ui-typeset-flow, 1rem) 0 0" })]}>
				<div
					mix={[
						raw({
							display: "flex",
							flexDirection: column ? "column" : "row",
							flexWrap: "wrap",
							alignItems: column ? "stretch" : "center",
							justifyContent: "center",
							gap: "1rem",
							padding: "1.75rem 1rem",
							borderRadius: "var(--ui-radius-lg, 0.5rem) var(--ui-radius-lg, 0.5rem) 0 0",
							boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
							backgroundColor: "var(--ui-bg)",
							backgroundImage:
								"radial-gradient(circle at 1px 1px, var(--ui-neutral-border) 1px, transparent 0)",
							backgroundSize: "14px 14px",
							minInlineSize: 0,
						}),
					]}
				>
					{children}
				</div>
				<Code code={code} language="tsx" />
			</figure>
		);
	};
}

namespace Tile {
	export interface Props {
		label?: string;
		/** Styles the drawing adds to the tile, such as a radius or a shadow. */
		style?: Record<string, string>;
		/** A wider, shorter tile, for a row inside a layout drawing. */
		wide?: boolean;
	}
}

/** The solid brand tile most drawings act on, labelled in the mono face. */
export function Tile(handle: Handle<Tile.Props>) {
	return () => {
		let { label, style = {}, wide = false } = handle.props;
		return (
			<div
				mix={[
					raw({
						display: "grid",
						placeItems: "center",
						minInlineSize: wide ? "0" : "3rem",
						minBlockSize: wide ? "2rem" : "3rem",
						paddingInline: "0.5rem",
						borderRadius: "var(--ui-radius-md, 0.25rem)",
						backgroundColor: "var(--ui-brand-bg-solid)",
						color: "var(--ui-brand-fg-on-solid)",
						fontFamily: "var(--ui-font-mono)",
						fontSize: "0.75rem",
						fontWeight: "600",
						...style,
					}),
				]}
			>
				{label}
			</div>
		);
	};
}

namespace Padding {
	export interface Props {
		step: number;
		/** The call printed inside, such as `pad(4)`. */
		label: string;
		/** Pads only the inline sides when set. */
		inline?: boolean;
	}
}

/** A tile inside hatched padding as deep as the step, labelled with its call. */
export function Padding(handle: Handle<Padding.Props>) {
	return () => {
		let { inline = false, label, step } = handle.props;
		return (
			<div
				mix={[
					raw({
						...HATCH,
						padding: inline ? `0 ${space(step)}` : space(step),
						borderRadius: "var(--ui-radius-md, 0.25rem)",
					}),
				]}
			>
				<Tile label={label} />
			</div>
		);
	};
}

namespace Gap {
	export interface Props {
		step: number;
		label: string;
		/** Lays the tiles in a two-column grid, so the gap shows on both axes. */
		grid?: boolean;
	}
}

/** Tiles spaced by a gap, the gap itself hatched so the space reads as the subject. */
export function Gap(handle: Handle<Gap.Props>) {
	return () => {
		let { grid = false, label, step } = handle.props;
		return (
			<div
				aria-label={label}
				role="img"
				mix={[
					raw({
						...HATCH,
						display: grid ? "grid" : "flex",
						gridTemplateColumns: "repeat(2, 3rem)",
						gap: space(step),
						borderRadius: "var(--ui-radius-md, 0.25rem)",
					}),
				]}
			>
				{(grid ? ["1", "2", "3", "4"] : ["1", "2", "3"]).map((item) => (
					<Tile key={item} label={item} />
				))}
			</div>
		);
	};
}

namespace Ruler {
	export interface Props {
		steps: readonly number[];
	}
}

/** Each spacing step as a bar of its length, labelled with the step and the rems it sets. */
export function Ruler(handle: Handle<Ruler.Props>) {
	return () => (
		<div
			mix={[
				raw({
					display: "grid",
					gridTemplateColumns: "2.5rem minmax(0, 1fr) 4rem",
					alignItems: "center",
					gap: "0.5rem 0.75rem",
					inlineSize: "100%",
					maxInlineSize: "28rem",
					fontFamily: "var(--ui-font-mono)",
					fontSize: "0.75rem",
					color: "var(--ui-neutral-fg-muted)",
				}),
			]}
		>
			{handle.props.steps.map((step) => [
				<span key={`${step}-step`} mix={[raw({ color: "var(--ui-fg)", fontWeight: "600" })]}>
					{step}
				</span>,
				<span
					key={`${step}-bar`}
					mix={[
						raw({
							blockSize: "0.75rem",
							inlineSize: space(step),
							minInlineSize: "1px",
							backgroundColor: "var(--ui-brand-bg-solid)",
							borderRadius: "1px",
						}),
					]}
				/>,
				<span key={`${step}-rem`} mix={[raw({ textAlign: "end" })]}>
					{space(step)}
				</span>,
			])}
		</div>
	);
}

namespace Ramp {
	export interface Props {
		palette: Palette;
		/** Draws each swatch's shade under it. */
		labels?: boolean;
	}
}

/** A palette's eleven shades as one strip of swatches that narrows with the screen. */
export function Ramp(handle: Handle<Ramp.Props>) {
	return () => {
		let { labels = true, palette } = handle.props;
		return (
			<div
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "minmax(0, 1fr)",
						gap: "0.375rem",
						inlineSize: "100%",
					}),
				]}
			>
				<span mix={[raw({ fontFamily: "var(--ui-font-mono)", fontSize: "0.8125rem" })]}>
					{palette.name}
				</span>
				<ol
					aria-label={`${palette.name} shades`}
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: `repeat(${SHADES.length}, minmax(0, 1fr))`,
							gap: "0.125rem",
							margin: 0,
							padding: 0,
							listStyle: "none",
						}),
					]}
				>
					{SHADES.map((shade) => (
						<li key={shade} mix={[raw({ display: "grid", gap: "0.25rem" })]}>
							<span
								title={`${palette.name}.${shade}`}
								mix={[
									raw({
										blockSize: "2.25rem",
										borderRadius: "var(--ui-radius-md, 0.25rem)",
										backgroundColor: swatch(palette.name, shade),
										boxShadow: "inset 0 0 0 1px oklch(0 0 0 / 0.06)",
									}),
								]}
							/>
							{labels ? (
								<span
									mix={[
										raw({
											fontFamily: "var(--ui-font-mono)",
											fontSize: "0.625rem",
											color: "var(--ui-neutral-fg-muted)",
											textAlign: "center",
										}),
									]}
								>
									{shade}
								</span>
							) : null}
						</li>
					))}
				</ol>
			</div>
		);
	};
}

namespace Chip {
	export interface Props {
		background: string;
		color: string;
		border?: string;
		children: RemixNode;
	}
}

/** A labelled chip in the colours a call sets, for showing text over a background. */
export function Chip(handle: Handle<Chip.Props>) {
	return () => {
		let { background, border, children, color } = handle.props;
		return (
			<span
				mix={[
					raw({
						display: "inline-grid",
						placeItems: "center",
						minBlockSize: "2.5rem",
						padding: "0 1rem",
						borderRadius: "var(--ui-radius-md, 0.25rem)",
						backgroundColor: background,
						color,
						boxShadow: border ? `inset 0 0 0 2px ${border}` : "none",
						fontFamily: "var(--ui-font-mono)",
						fontSize: "0.8125rem",
						fontWeight: "600",
					}),
				]}
			>
				{children}
			</span>
		);
	};
}

namespace Layout {
	export interface Props {
		/** The CSS the call sets on the container. */
		style: Record<string, string>;
		/** The tile labels, one tile each. */
		items: string[];
		/** Grows the container to the stage's width, for layouts that distribute space. */
		fill?: boolean;
	}
}

/**
 * Tiles inside a hatched container laid out by the CSS a layout call sets, so a stack, a row
 * or a grid is drawn by the very properties the reference column lists.
 */
export function Layout(handle: Handle<Layout.Props>) {
	return () => {
		let { fill = true, items, style } = handle.props;
		return (
			<div
				mix={[
					raw({
						...HATCH,
						inlineSize: fill ? "100%" : "auto",
						maxInlineSize: "26rem",
						padding: "0.5rem",
						borderRadius: "var(--ui-radius-md, 0.25rem)",
						...style,
					}),
				]}
			>
				{items.map((item) => (
					<Tile key={item} label={item} wide />
				))}
			</div>
		);
	};
}

namespace TypeSample {
	export interface Props {
		label: string;
		/** The CSS the call sets on the text. */
		style: Record<string, string>;
		/** The words set in the sample. */
		children: string;
	}
}

/** A line of text set by a call, with the call beside it, wrapping on a narrow screen. */
export function TypeSample(handle: Handle<TypeSample.Props>) {
	return () => {
		let { children, label, style } = handle.props;
		return (
			<div
				mix={[
					raw({
						display: "grid",
						gridTemplateColumns: "minmax(4.5rem, max-content) minmax(0, 1fr)",
						alignItems: "baseline",
						gap: "1rem",
						inlineSize: "100%",
					}),
				]}
			>
				<code
					mix={[
						raw({
							fontFamily: "var(--ui-font-mono)",
							fontSize: "0.75rem",
							color: "var(--ui-neutral-fg-muted)",
						}),
					]}
				>
					{label}
				</code>
				<span mix={[raw({ color: "var(--ui-fg)", overflowWrap: "anywhere", ...style })]}>
					{children}
				</span>
			</div>
		);
	};
}

namespace Swatch {
	export interface Props {
		label: string;
		style: Record<string, string>;
		/** The label's colour, for a tile on a surface that keeps its colours in both themes. */
		labelColor?: string;
	}
}

/** A surface tile set by an effect call, its call written under it. */
export function Swatch(handle: Handle<Swatch.Props>) {
	return () => {
		let { label, labelColor = "var(--ui-neutral-fg-muted)", style } = handle.props;
		return (
			<div mix={[raw({ display: "grid", justifyItems: "center", gap: "0.5rem" })]}>
				<div
					mix={[
						raw({
							inlineSize: "4.5rem",
							blockSize: "4.5rem",
							backgroundColor: "var(--ui-bg)",
							boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
							...style,
						}),
					]}
				/>
				<code
					mix={[
						raw({
							fontFamily: "var(--ui-font-mono)",
							fontSize: "0.6875rem",
							color: labelColor,
						}),
					]}
				>
					{label}
				</code>
			</div>
		);
	};
}

namespace Dot {
	export interface Props {
		color: string;
	}
}

/** A small swatch of one colour, for a table cell beside the call that sets it. */
export function Dot(handle: Handle<Dot.Props>) {
	return () => (
		<span
			mix={[
				raw({
					display: "inline-block",
					inlineSize: "1.5rem",
					blockSize: "1.5rem",
					verticalAlign: "middle",
					borderRadius: "var(--ui-radius-md, 0.25rem)",
					backgroundColor: handle.props.color,
					boxShadow: "inset 0 0 0 1px oklch(0 0 0 / 0.08)",
				}),
			]}
		/>
	);
}

namespace LightSurface {
	export interface Props {
		children: RemixNode;
	}
}

/**
 * A light panel that stays light in either theme, for drawings such as shadows that only
 * read against a light background; tiles on it pass their own colours.
 */
export function LightSurface(handle: Handle<LightSurface.Props>) {
	return () => (
		<div
			mix={[
				raw({
					display: "flex",
					flexWrap: "wrap",
					justifyContent: "center",
					gap: "1.25rem",
					padding: "1.5rem",
					borderRadius: "var(--ui-radius-lg, 0.5rem)",
					backgroundColor: swatch("stone", 100),
				}),
			]}
		>
			{handle.props.children}
		</div>
	);
}
