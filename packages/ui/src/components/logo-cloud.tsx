/**
 * Adopter marks for marketing proof strips: a centered row, a row spread across the
 * measure, or a ruled grid of cells. Each mark is sized to the marketing logo height
 * in full ink, so a visitor recognizes it; dimming is one mechanism on the cloud.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { fg } from "@sdxc/u/color";
import { combine, raw, var as varUtility } from "@sdxc/u/general";
import { container, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";

import type { BalancedGridStep } from "../styles/card-grid.js";

import { Marquee } from "../patterns/marquee.js";
import { balancedGrid } from "../styles/card-grid.js";

/** Height of each mark below the `lg` container. */
const LOGO_HEIGHT = varUtility("ui-marketing-logo-height", "1.75rem");

/** Height of each mark from the `lg` container up. */
const LOGO_HEIGHT_LG = varUtility("ui-marketing-logo-height-lg", "2.25rem");

/** Container name the cloud's layout steps query. */
const CONTAINER = "ui-marketing-logo-cloud";

/** Fill behind each mark in the `tiles` layout: the heading ink at 3% over the page. */
const TILE =
	"var(--ui-marketing-logo-tile, color-mix(in oklch, var(--ui-neutral-fg-emphasis) 4%, var(--ui-bg)))";

/** Hairline that rules the grid layout's cells. */
const HAIRLINE = "var(--ui-marketing-hairline)";

/** Each grid cell's own rules on its inline-end and block-end edges; the grid clips them at its outer edge. */
const CELL_RULES = `1px 0 0 ${HAIRLINE}, 0 1px 0 ${HAIRLINE}`;

/**
 * The most cells a grid row holds at each width of the cloud, so each cell keeps
 * at least 10rem; the grid then evens the rows for the mark count.
 */
const GRID_STEPS: ReadonlyArray<BalancedGridStep> = [
	{ query: "(width < 30rem)", columns: 2 },
	{ query: "(30rem <= width < 40rem)", columns: 3 },
	{ query: "(40rem <= width < 60rem)", columns: 4 },
	{ query: "(width >= 60rem)", columns: 6 },
];

/** Layouts that set the marks in grid cells rather than a flowing row. */
const GRID_LAYOUTS: ReadonlySet<LogoCloud.Layout> = new Set(["grid", "ruled", "tiles"]);

/** A mark's height scaled by its own `--logo-scale`, so one mark can stand taller than its neighbours. */
function scaled(height: string): string {
	return `calc(${height} * var(--logo-scale, 1))`;
}

/** Arrangement {@link LogoCloud} applies when `layout` is omitted. */
const DEFAULT_LAYOUT: LogoCloud.Layout = "row";

/**
 * Prop types for {@link LogoCloud}.
 */
export namespace LogoCloud {
	/**
	 * How the marks sit: a centered wrapping `row`; a `spread` row edge to edge across
	 * the measure from the `lg` container (centered wrap below); a `grid` of 4rem cells
	 * ruled between them; `ruled`, the same grid closed by an outer frame; `tiles`, each
	 * mark on its own tinted 3:2 tile; or a `marquee` that scrolls them past.
	 */
	export type Layout = "row" | "spread" | "grid" | "ruled" | "tiles" | "marquee";

	/**
	 * Props accepted by {@link LogoCloud}.
	 */
	export interface Props extends TagProps<"div"> {
		/** Arrangement. Defaults to {@link DEFAULT_LAYOUT}. */
		layout?: Layout;
		/** A line above the marks, such as "Trusted by teams at". */
		label?: RemixNode;
		/**
		 * Draws inline-SVG marks in the body ink and turns image marks grayscale, so a
		 * row of brand colors reads as one band; marks never lose opacity.
		 */
		muted?: boolean;
		/**
		 * Consumer-supplied marks — `<img>` or inline SVG children. The cloud sizes each
		 * direct child; an SVG draws with `currentColor`, and a `--logo-scale` style on a
		 * mark (default 1) lets a square glyph stand taller than a wordmark.
		 */
		children: RemixNode;
	}
}

/**
 * Lays logo children out by `layout`, sizes each direct child to the logo height, and
 * draws an optional label above them.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the cloud's markup.
 * @example
 * <LogoCloud layout="spread" label={t("proof.label")}>
 * 	<img src={acme} alt="Acme" />
 * 	<img src={globex} alt="Globex" />
 * </LogoCloud>
 * @example
 * <LogoCloud layout="grid" muted>{marks}</LogoCloud>
 */
export function LogoCloud(handle: Handle<LogoCloud.Props>) {
	return () => {
		let { children, label, layout, mix, muted, ...rest } = handle.props;
		let resolvedLayout = layout ?? DEFAULT_LAYOUT;
		let isGrid = GRID_LAYOUTS.has(resolvedLayout);

		return (
			<div
				{...rest}
				data-layout={resolvedLayout}
				data-muted={muted ? "true" : undefined}
				data-slot="logo-cloud"
				mix={[
					container(CONTAINER),
					vstack({ gap: 0, align: isGrid ? "stretch" : "center" }),
					raw({ inlineSize: "100%" }),
					mix,
				]}
			>
				{label ? (
					<p
						data-slot="logo-cloud-label"
						mix={[
							text("base"),
							weight("medium"),
							fg("neutral.emphasis"),
							raw({ marginBlockEnd: isGrid ? "1.5rem" : "2.5rem", textAlign: "center" }),
						]}
					>
						{label}
					</p>
				) : null}
				{resolvedLayout === "marquee" ? (
					<Marquee
						data-slot="logo-cloud-marks"
						mix={[
							raw({ color: ink(Boolean(muted)) }),
							markSize(Boolean(muted), '& [data-slot="marquee-group"] > *'),
						]}
					>
						{children}
					</Marquee>
				) : (
					<div data-slot="logo-cloud-marks" mix={[marks(resolvedLayout, Boolean(muted))]}>
						{children}
					</div>
				)}
			</div>
		);
	};
}

/**
 * The marks row in one rule, so a layout's sizing, ruling and dimming never compete with
 * another class over the same property: a wrapping flex row whose leftovers centre, or a
 * grid whose children become 4rem cells ruled by 1px shadows clipped at its outer edge.
 */
function marks(layout: LogoCloud.Layout, muted: boolean) {
	if (layout === "tiles") {
		return combine([
			raw({ display: "grid", gap: "0.5rem", color: ink(muted) }),
			when(
				"& > *",
				raw({
					boxSizing: "border-box",
					justifySelf: "stretch",
					aspectRatio: "3 / 2",
					inlineSize: "100%",
					blockSize: "auto",
					minInlineSize: "0",
					paddingBlock: `calc((100% * 2 / 3 - ${scaled(LOGO_HEIGHT)}) / 2)`,
					paddingInline: "1rem",
					objectFit: "contain",
					color: "currentColor",
					borderRadius: "var(--ui-marketing-tile-radius, 0.5rem)",
					backgroundColor: TILE,
					filter: muted ? "grayscale(1)" : "none",
				}),
			),
			balancedGrid(CONTAINER, GRID_STEPS),
		]);
	}

	if (layout === "grid" || layout === "ruled") {
		return combine([
			raw({
				display: "grid",
				clipPath: "inset(0)",
				color: ink(muted),
				boxShadow: layout === "ruled" ? `inset 0 0 0 1px ${HAIRLINE}` : "none",
			}),
			when(
				"& > *",
				raw({
					boxSizing: "border-box",
					justifySelf: "stretch",
					blockSize: `calc(${scaled(LOGO_HEIGHT)} + 2.25rem)`,
					inlineSize: "100%",
					minInlineSize: "0",
					padding: "1.125rem 1rem",
					objectFit: "contain",
					color: "currentColor",
					boxShadow: CELL_RULES,
					filter: muted ? "grayscale(1)" : "none",
				}),
			),
			balancedGrid(
				CONTAINER,
				GRID_STEPS,
				raw({ boxShadow: `${CELL_RULES}, -1px 0 0 ${HAIRLINE}` }),
			),
		]);
	}

	return combine([
		raw({
			display: "flex",
			flexWrap: "wrap",
			alignItems: "center",
			justifyContent: "center",
			columnGap: "2.5rem",
			rowGap: "1.5rem",
			inlineSize: "100%",
			color: ink(muted),
		}),
		markSize(muted, "& > *"),
		layout === "spread"
			? at("lg", CONTAINER, [
					raw({ justifyContent: "space-between", columnGap: "2rem", flexWrap: "nowrap" }),
					when("& > *", raw({ minInlineSize: "0" })),
				])
			: [],
	]);
}

/** The ink marks draw in: the body ink when muted, the heading ink otherwise. */
function ink(muted: boolean): string {
	return muted ? "var(--ui-neutral-fg)" : "var(--ui-neutral-fg-emphasis)";
}

/** Sizes the marks `selector` names to the logo height, a step taller from the `lg` container. */
function markSize(muted: boolean, selector: string) {
	return combine([
		when(
			selector,
			raw({
				blockSize: scaled(LOGO_HEIGHT),
				inlineSize: "auto",
				objectFit: "contain",
				color: "currentColor",
				filter: muted ? "grayscale(1)" : "none",
			}),
		),
		at("lg", CONTAINER, when(selector, raw({ blockSize: scaled(LOGO_HEIGHT_LG) }))),
	]);
}
