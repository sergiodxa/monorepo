/**
 * One marketing claim cell — icon, media, title, description, optional link
 * chrome — and an optional {@link Feature.Grid} that lays cells as separate
 * cards or a hairline mosaic via container queries. Also ships the card-grid,
 * card-media and icon-tile style factories the bento pattern shares.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { container, hstack, vstack } from "@sdxc/u/layout";
import { m, mbs } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { leading, pretty, text, weight } from "@sdxc/u/typography";

import { cardGrid, cardMedia, cardPadding, iconTile } from "../styles/card-grid.js";
import { marketingEmphasis } from "../styles/marketing.js";

import { resolveHeadingLevel, TAG_BY_LEVEL } from "./heading-scope.js";

/** Cell chrome {@link Feature} applies when `variant` is omitted. */
const DEFAULT_VARIANT: Feature.Variant = "plain";

/** How many cells a wide {@link Feature.Grid} puts on one row. */
const DEFAULT_COLUMNS: Feature.Columns = 2;

/** Grid chrome {@link Feature.Grid} applies when `variant` is omitted. */
const DEFAULT_GRID_VARIANT: Feature.GridVariant = "cards";

/** Glyph tile {@link Feature.Icon} draws when `tone` is omitted. */
const DEFAULT_ICON_TONE: Feature.IconTone = "quiet";

/**
 * Prop types for {@link Feature} and its compound parts.
 */
export namespace Feature {
	/**
	 * Cell chrome: a light claim with no fill, or a panel when the cell itself
	 * is the interaction surface. A panel belongs outside a {@link Feature.Grid},
	 * which draws its own cell chrome.
	 */
	export type Variant = "plain" | "panel";

	/**
	 * How many cells a wide {@link Feature.Grid} puts on one row.
	 */
	export type Columns = 2 | 3;

	/**
	 * Grid chrome: separate raised `cards` with larger outer corners, or one
	 * `mosaic` box whose 1px gaps draw hairlines between flush cells.
	 */
	export type GridVariant = "cards" | "mosaic";

	/**
	 * Glyph tile: a `quiet` hairline ring in the heading ink, or a `brand`
	 * tinted and bordered badge.
	 */
	export type IconTone = "quiet" | "brand";

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
		 * Compound parts: {@link Feature.Media}, {@link Feature.Icon},
		 * {@link Feature.Title}, {@link Feature.Description},
		 * {@link Feature.Action}, or other content.
		 */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Feature.Icon}.
	 */
	export interface IconProps extends TagProps<"span"> {
		/** Tile chrome. Defaults to {@link DEFAULT_ICON_TONE}. */
		tone?: IconTone;
		/** Glyph rendered inside the tile. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Feature.Media}.
	 */
	export interface MediaProps extends TagProps<"div"> {
		/** Illustration or screenshot drawn edge to edge at the top of the cell. */
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
		/** Supporting copy for the claim; `<strong>` fragments render in the heading ink. */
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
		/** Columns at the `lg` container. Defaults to {@link DEFAULT_COLUMNS}. */
		columns?: Columns;
		/** Grid chrome. Defaults to {@link DEFAULT_GRID_VARIANT}. */
		variant?: GridVariant;
		/** {@link Feature} cells to lay out. */
		children: RemixNode;
	}
}

/**
 * Renders one claim cell. Compose {@link Feature.Media}, {@link Feature.Icon},
 * {@link Feature.Title}, {@link Feature.Description}, and
 * {@link Feature.Action} inside it.
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
					cardPadding("2rem", "1.5rem", "2.5rem"),
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
 * Glyph tile that leads the claim, quiet by default.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the icon tile.
 */
Feature.Icon = function FeatureIcon(handle: Handle<Feature.IconProps>) {
	return () => {
		let { mix, tone, ...rest } = handle.props;
		let resolvedTone = tone ?? DEFAULT_ICON_TONE;

		return (
			<span
				{...rest}
				data-slot="feature-icon"
				data-tone={resolvedTone}
				mix={[iconTile(resolvedTone, 10), mix]}
			/>
		);
	};
};

/**
 * Illustration at the top of the cell, bleeding past the cell padding and
 * fading into the fill; hidden below the `md` container. Place it first.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the media area.
 */
Feature.Media = function FeatureMedia(handle: Handle<Feature.MediaProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return <div {...rest} data-slot="feature-media" mix={[cardMedia(), mix]} />;
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
				mix={[m(0), text("base"), weight("semibold"), fg("neutral.emphasis"), mix]}
			/>
		);
	};
};

/**
 * Supporting copy under the claim title, with emphasis fragments in the heading ink.
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
				mix={[
					/**
					 * Block flow, so an inline `<strong>` stays inside its sentence; paragraphs a
					 * page passes are spaced by their own margin.
					 */
					when("& > * + *", raw({ marginBlockStart: "0.5rem" })),
					text("base"),
					leading("relaxed"),
					pretty(),
					fg("neutral"),
					marketingEmphasis(),
					mix,
				]}
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
 * Grid of {@link Feature} cells, as separate cards by default. The host is the
 * named sizing container; an inner wrapper holds the tracks so the query can
 * restyle a descendant: one column on a phone, two from the `md` container
 * (36rem), `columns` from `lg` (48rem).
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
		let { children, columns, mix, variant, ...rest } = handle.props;
		let resolvedColumns = columns ?? DEFAULT_COLUMNS;
		let resolvedVariant = variant ?? DEFAULT_GRID_VARIANT;

		return (
			<div
				{...rest}
				data-columns={String(resolvedColumns)}
				data-variant={resolvedVariant}
				data-slot="feature-grid"
				mix={[container("ui-marketing-feature-grid"), mix]}
			>
				<div
					mix={[
						cardGrid({
							columns: resolvedColumns,
							variant: resolvedVariant,
							containerName: "ui-marketing-feature-grid",
						}),
					]}
				>
					{children}
				</div>
			</div>
		);
	};
};
