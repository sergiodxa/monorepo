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

/** Height of each mark below the `lg` container. */
const LOGO_HEIGHT = varUtility("ui-marketing-logo-height", "1.75rem");

/** Height of each mark from the `lg` container up. */
const LOGO_HEIGHT_LG = varUtility("ui-marketing-logo-height-lg", "2.25rem");

/** Container name the cloud's layout steps query. */
const CONTAINER = "ui-marketing-logo-cloud";

/** Arrangement {@link LogoCloud} applies when `layout` is omitted. */
const DEFAULT_LAYOUT: LogoCloud.Layout = "row";

/**
 * Prop types for {@link LogoCloud}.
 */
export namespace LogoCloud {
	/**
	 * How the marks sit: a centered wrapping `row`, a row `spread` edge to edge across
	 * the measure from the `lg` container (centered wrap below), or a `grid` of ruled
	 * 4rem cells, as many 10rem columns as fit.
	 */
	export type Layout = "row" | "spread" | "grid";

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
		 * direct child; an SVG draws with `currentColor`.
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
		let isGrid = resolvedLayout === "grid";

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
				<div data-slot="logo-cloud-marks" mix={[marks(resolvedLayout, Boolean(muted))]}>
					{children}
				</div>
			</div>
		);
	};
}

/**
 * The marks row in one rule, so a layout's sizing, ruling and dimming never compete with
 * another class over the same property: a wrapping flex row, or a grid whose children
 * become 4rem cells ruled by 1px shadows that the grid clips at its outer edge.
 */
function marks(layout: LogoCloud.Layout, muted: boolean) {
	let ink = muted ? "var(--ui-neutral-fg)" : "var(--ui-neutral-fg-emphasis)";

	if (layout === "grid") {
		return combine([
			raw({
				display: "grid",
				gridTemplateColumns: "repeat(auto-fill, minmax(10rem, 1fr))",
				clipPath: "inset(0)",
				color: ink,
			}),
			when(
				"& > *",
				raw({
					boxSizing: "content-box",
					blockSize: LOGO_HEIGHT,
					inlineSize: "auto",
					minInlineSize: "0",
					padding: "1.125rem 1rem",
					objectFit: "contain",
					color: "currentColor",
					boxShadow: "1px 0 0 var(--ui-marketing-hairline), 0 1px 0 var(--ui-marketing-hairline)",
					filter: muted ? "grayscale(1)" : "none",
				}),
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
			color: ink,
		}),
		when(
			"& > *",
			raw({
				blockSize: LOGO_HEIGHT,
				inlineSize: "auto",
				objectFit: "contain",
				color: "currentColor",
				filter: muted ? "grayscale(1)" : "none",
			}),
		),
		at("lg", CONTAINER, when("& > *", raw({ blockSize: LOGO_HEIGHT_LG }))),
		layout === "spread"
			? at("lg", CONTAINER, raw({ justifyContent: "space-between", columnGap: "2rem" }))
			: [],
	]);
}
