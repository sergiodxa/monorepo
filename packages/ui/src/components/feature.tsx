/**
 * One marketing claim cell — icon, title, description, optional link chrome —
 * and an optional {@link Feature.Grid} that lays cells as a hairline-ruled
 * track via container queries. Default chrome stays light; pass
 * `variant="panel"` only when a filled panel is the right container for the
 * interaction.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import {
	center,
	container,
	gap,
	grid,
	gridTemplate,
	hstack,
	inlineFlex,
	repeat,
	vstack,
} from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { at } from "@sdxc/u/responsive";
import { bs, is, m, mbs, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { leading, pretty, text, tracking, weight } from "@sdxc/u/typography";

import { resolveHeadingLevel, TAG_BY_LEVEL } from "./heading-scope.js";

/** Cell chrome {@link Feature} applies when `variant` is omitted. */
const DEFAULT_VARIANT: Feature.Variant = "plain";

/** How many cells a wide {@link Feature.Grid} puts on one row. */
const DEFAULT_COLUMNS: Feature.Columns = 2;

/**
 * Prop types for {@link Feature} and its compound parts.
 */
export namespace Feature {
	/**
	 * Cell chrome: a light claim with no fill, or a panel when the cell itself
	 * is the interaction surface.
	 */
	export type Variant = "plain" | "panel";

	/**
	 * How many cells a wide {@link Feature.Grid} puts on one row.
	 */
	export type Columns = 2 | 3;

	/**
	 * Props accepted by {@link Feature}.
	 */
	export interface Props extends TagProps<"div"> {
		/** Cell chrome. Defaults to {@link DEFAULT_VARIANT}. */
		variant?: Variant;
		/**
		 * Optional destination for the claim. When set with a trailing action
		 * child, the cell can surface link chrome; the href itself is left for
		 * the consumer's {@link LinkButton} or anchor.
		 */
		href?: string;
		/**
		 * Compound parts: {@link Feature.Icon}, {@link Feature.Title},
		 * {@link Feature.Description}, {@link Feature.Action}, or other content.
		 */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Feature.Icon}.
	 */
	export interface IconProps extends TagProps<"span"> {
		/** Glyph rendered inside the tinted icon well. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Feature.Title}. The rendered tag follows the
	 * nearest ambient heading level.
	 */
	export interface TitleProps extends TagProps<"h1"> {
		/** Title copy for the claim. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Feature.Description}.
	 */
	export interface DescriptionProps extends TagProps<"div"> {
		/** Supporting copy for the claim. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Feature.Action}.
	 */
	export interface ActionProps extends TagProps<"div"> {
		/** Trailing link or button chrome for the claim. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Feature.Grid}.
	 */
	export interface GridProps extends TagProps<"div"> {
		/** Columns above the stack breakpoint. Defaults to {@link DEFAULT_COLUMNS}. */
		columns?: Columns;
		/** {@link Feature} cells to lay out. */
		children: RemixNode;
	}
}

/**
 * Renders one claim cell. Compose {@link Feature.Icon}, {@link Feature.Title},
 * {@link Feature.Description}, and {@link Feature.Action} inside it.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the cell's markup.
 * @example
 * <Feature>
 * 	<Feature.Icon><ZapIcon size={18} aria-hidden="true" /></Feature.Icon>
 * 	<Feature.Title>{t("feature.title")}</Feature.Title>
 * 	<Feature.Description>{t("feature.body")}</Feature.Description>
 * </Feature>
 */
export function Feature(handle: Handle<Feature.Props>) {
	return () => {
		let { href, mix, variant, ...rest } = handle.props;
		let resolvedVariant = variant ?? DEFAULT_VARIANT;

		return (
			<div
				{...rest}
				data-variant={resolvedVariant}
				data-href={href || undefined}
				data-slot="feature"
				mix={[
					vstack({ gap: 4, align: "stretch" }),
					bg(),
					p(8, 6),
					at("lg", p(10, 10)),
					when('&[data-variant="panel"]', [
						bg("neutral.tint"),
						border({ color: "neutral", width: 1, style: "solid" }),
						rounded("xl"),
					]),
					mix,
				]}
			/>
		);
	};
}

/**
 * Tinted rounded well that holds the claim's glyph.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the icon well.
 */
Feature.Icon = function FeatureIcon(handle: Handle<Feature.IconProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<span
				{...rest}
				data-slot="feature-icon"
				mix={[
					inlineFlex(),
					center(),
					is(10),
					bs(10),
					rounded("lg"),
					bg("brand.tint"),
					fg("brand"),
					border({ color: "brand", width: 1, style: "solid" }),
					mix,
				]}
			/>
		);
	};
};

/**
 * Claim title at the ambient heading depth, sized for a feature cell.
 *
 * @param handle Runtime handle carrying the host heading's props.
 * @returns The render function producing the title.
 */
Feature.Title = function FeatureTitle(handle: Handle<Feature.TitleProps>) {
	return () => {
		let { mix, ...rest } = handle.props;
		let resolved = resolveHeadingLevel(handle);
		let Tag = TAG_BY_LEVEL[resolved];

		return (
			<Tag
				{...rest}
				data-slot="feature-title"
				data-heading-level={resolved}
				mix={[m(0), text("xl"), weight("medium"), tracking("tight"), fg("neutral.emphasis"), mix]}
			/>
		);
	};
};

/**
 * Supporting copy under the claim title.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the description.
 */
Feature.Description = function FeatureDescription(handle: Handle<Feature.DescriptionProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="feature-description"
				mix={[vstack({ gap: 2 }), text("base"), leading("relaxed"), pretty(), fg("neutral"), mix]}
			/>
		);
	};
};

/**
 * Trailing action slot for a link or button under the claim body.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the action slot.
 */
Feature.Action = function FeatureAction(handle: Handle<Feature.ActionProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return <div {...rest} data-slot="feature-action" mix={[mbs(2), hstack({ gap: 2 }), mix]} />;
	};
};

/**
 * Hairline-ruled grid of {@link Feature} cells. The host is the named sizing
 * container; an inner wrapper holds the grid and `@container` column tracks so
 * the query can restyle a descendant. Collapses to one column below `lg`
 * (48rem), matching the landing's original viewport threshold.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the grid.
 * @example
 * <Feature.Grid columns={3}>
 * 	<Feature>...</Feature>
 * 	<Feature>...</Feature>
 * 	<Feature>...</Feature>
 * </Feature.Grid>
 */
Feature.Grid = function FeatureGrid(handle: Handle<Feature.GridProps>) {
	return () => {
		let { children, columns, mix, ...rest } = handle.props;
		let resolvedColumns = columns ?? DEFAULT_COLUMNS;

		return (
			<div
				{...rest}
				data-columns={String(resolvedColumns)}
				data-slot="feature-grid"
				mix={[container("ui-marketing-feature-grid"), mix]}
			>
				<div
					mix={[
						grid(),
						gap("1px"),
						rounded("xl"),
						overflow("hidden"),
						border({ color: "neutral", width: 1, style: "solid" }),
						raw({
							backgroundColor: "var(--ui-neutral-border)",
							textAlign: "start",
						}),
						gridTemplate({ columns: "minmax(0, 1fr)" }),
						at("lg", "ui-marketing-feature-grid", [
							gridTemplate({
								columns: repeat(resolvedColumns, "minmax(0, 1fr)"),
							}),
							resolvedColumns === 2
								? when("& > :last-child:nth-child(odd)", raw({ gridColumn: "1 / -1" }))
								: [
										when("& > :last-child:nth-child(3n + 1)", raw({ gridColumn: "1 / -1" })),
										when("& > :last-child:nth-child(3n + 2)", raw({ gridColumn: "span 2" })),
									],
						]),
					]}
				>
					{children}
				</div>
			</div>
		);
	};
};
