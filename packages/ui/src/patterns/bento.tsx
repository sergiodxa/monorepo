/**
 * Equal columns of claim cells — separate raised cards by default, or one
 * hairline-ruled mosaic — for a purpose row, a claim strip or a product bento
 * whose cells can lead with a fading illustration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { fg } from "@sdxc/u/color";
import { combine } from "@sdxc/u/general";
import { container, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { m } from "@sdxc/u/size";
import { leading, pretty, text, tracking, weight } from "@sdxc/u/typography";

import { Feature } from "../components/feature.js";
import { resolveHeadingLevel, TAG_BY_LEVEL } from "../components/heading-scope.js";
import { cardGrid, cardMedia, cardPadding } from "../styles/card-grid.js";
import { marketingEmphasis } from "../styles/marketing.js";

/** How many cells a wide {@link Bento} puts on one row when `columns` is omitted. */
const DEFAULT_COLUMNS: Bento.Columns = 3;

/** Grid chrome {@link Bento} applies when `variant` is omitted. */
const DEFAULT_VARIANT: Bento.Variant = "cards";

/** Title step {@link Bento.Title} applies when `size` is omitted. */
const DEFAULT_TITLE_SIZE: Bento.TitleSize = "base";

/** Named sizing container on the bento host that every column and padding step queries. */
const CONTAINER_NAME = "ui-marketing-bento";

/**
 * Prop types for {@link Bento} and its compound parts.
 */
export namespace Bento {
	/**
	 * How many cells a wide grid puts on one row.
	 */
	export type Columns = 2 | 3 | 4;

	/**
	 * Grid chrome: separate raised `cards` with larger outer corners, or one
	 * `mosaic` box whose 1px gaps draw hairlines between flush cells.
	 */
	export type Variant = Feature.GridVariant;

	/**
	 * Title step: `base` for a claim cell, `lg` for a hero cell that anchors the bento.
	 */
	export type TitleSize = "base" | "lg";

	/**
	 * Props accepted by {@link Bento}.
	 */
	export interface Props extends TagProps<"div"> {
		/** Columns at the `lg` container. Defaults to {@link DEFAULT_COLUMNS}. */
		columns?: Columns;
		/** Grid chrome. Defaults to {@link DEFAULT_VARIANT}. */
		variant?: Variant;
		/** {@link Bento.Cell} children to lay out. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Bento.Cell}.
	 */
	export interface CellProps extends TagProps<"div"> {
		/**
		 * Outer corners this cell rounds at the `lg` step, space separated
		 * (`"start-start end-start"`). Setting it on any cell hands every `lg`
		 * outer corner to the page, for cells that span columns.
		 */
		"data-corner"?: string;
		/** Cell content: an optional {@link Bento.Media}, then title and body. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Bento.Media}.
	 */
	export interface MediaProps extends TagProps<"div"> {
		/** Illustration or screenshot drawn edge to edge at the top of the cell. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Bento.Title}.
	 */
	export interface TitleProps extends TagProps<"h1"> {
		/** Title step. Defaults to {@link DEFAULT_TITLE_SIZE}. */
		size?: TitleSize;
		/** Title copy for the cell. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Bento.Body}.
	 */
	export interface BodyProps extends TagProps<"div"> {
		/** Supporting copy for the cell; `<strong>` fragments render in the heading ink. */
		children: RemixNode;
	}
}

/**
 * Bento grid of claim cells. The host is the named sizing container; an inner
 * wrapper holds the tracks so the query can restyle a descendant: one column
 * on a phone, two from the `md` container (36rem), `columns` from `lg` (48rem).
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the bento's markup.
 * @example
 * <Bento columns={3}>
 * 	<Bento.Cell>
 * 		<Bento.Title>{t("purpose.one")}</Bento.Title>
 * 		<Bento.Body>{t("purpose.one.body")}</Bento.Body>
 * 	</Bento.Cell>
 * </Bento>
 */
export function Bento(handle: Handle<Bento.Props>) {
	return () => {
		let { children, columns, mix, variant, ...rest } = handle.props;
		let resolvedColumns = columns ?? DEFAULT_COLUMNS;
		let resolvedVariant = variant ?? DEFAULT_VARIANT;

		return (
			<div
				{...rest}
				data-slot="bento"
				data-columns={String(resolvedColumns)}
				data-variant={resolvedVariant}
				mix={[container(CONTAINER_NAME), mix]}
			>
				<div
					mix={[
						cardGrid({
							columns: resolvedColumns,
							variant: resolvedVariant,
							containerName: CONTAINER_NAME,
						}),
					]}
				>
					{children}
				</div>
			</div>
		);
	};
}

/**
 * One bento cell, padded 1.5rem and 2.5rem from the `lg` container. Compose
 * an optional {@link Bento.Media} first, then {@link Bento.Title} and
 * {@link Bento.Body}.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the cell's markup.
 */
Bento.Cell = function BentoCell(handle: Handle<Bento.CellProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="bento-cell"
				mix={[
					vstack({ gap: 3, align: "stretch" }),
					cardPadding("1.5rem", "1.5rem", "2.5rem", CONTAINER_NAME),
					mix,
				]}
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
Bento.Media = function BentoMedia(handle: Handle<Bento.MediaProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return <div {...rest} data-slot="bento-media" mix={[cardMedia(), mix]} />;
	};
};

/**
 * Cell title at the ambient heading depth: `base` semibold, or 1.25rem rising
 * to 1.5rem from the `md` container for a hero cell.
 *
 * @param handle Runtime handle carrying the host heading's props.
 * @returns The render function producing the title.
 */
Bento.Title = function BentoTitle(handle: Handle<Bento.TitleProps>) {
	return () => {
		let { mix, size, ...rest } = handle.props;
		let resolvedSize = size ?? DEFAULT_TITLE_SIZE;
		let resolved = resolveHeadingLevel(handle);
		let Tag = TAG_BY_LEVEL[resolved];

		return (
			<Tag
				{...rest}
				data-slot="bento-title"
				data-heading-level={resolved}
				data-size={resolvedSize}
				mix={[
					m(0),
					resolvedSize === "lg"
						? combine([text("xl"), tracking("tight"), at("md", CONTAINER_NAME, text("2xl"))])
						: text("base"),
					weight("semibold"),
					fg("neutral.emphasis"),
					mix,
				]}
			/>
		);
	};
};

/**
 * Supporting copy under a bento title, with emphasis fragments in the heading ink.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the body.
 */
Bento.Body = function BentoBody(handle: Handle<Bento.BodyProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="bento-body"
				mix={[text("sm"), leading("relaxed"), pretty(), fg("neutral"), marketingEmphasis(), mix]}
			/>
		);
	};
};
