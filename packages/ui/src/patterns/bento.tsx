/**
 * Equal columns divided by low-contrast rules — a purpose row or claim strip
 * that needs no card fill. Hairlines come from a 1px gap over the border token.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { container, gap, grid, gridTemplate, repeat, vstack } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { at } from "@sdxc/u/responsive";
import { p } from "@sdxc/u/size";
import { leading, pretty, text, weight } from "@sdxc/u/typography";

import { resolveHeadingLevel, TAG_BY_LEVEL } from "../components/heading-scope.js";

/** How many cells a wide {@link Bento} puts on one row when `columns` is omitted. */
const DEFAULT_COLUMNS: Bento.Columns = 3;

/**
 * Prop types for {@link Bento} and its compound parts.
 */
export namespace Bento {
	/**
	 * How many cells a wide grid puts on one row.
	 */
	export type Columns = 2 | 3 | 4;

	/**
	 * Props accepted by {@link Bento}.
	 */
	export interface Props extends TagProps<"div"> {
		/** Columns above the stack breakpoint. Defaults to {@link DEFAULT_COLUMNS}. */
		columns?: Columns;
		/** {@link Bento.Cell} children to lay out. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Bento.Cell}.
	 */
	export interface CellProps extends TagProps<"div"> {
		/** Cell content — typically title + body. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Bento.Title}.
	 */
	export interface TitleProps extends TagProps<"h1"> {
		/** Title copy for the cell. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Bento.Body}.
	 */
	export interface BodyProps extends TagProps<"div"> {
		/** Supporting copy for the cell. */
		children: RemixNode;
	}
}

/**
 * Hairline-ruled equal columns that collapse to one track below `md` on their
 * own named container.
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
		let { columns, mix, ...rest } = handle.props;
		let resolvedColumns = columns ?? DEFAULT_COLUMNS;

		return (
			<div
				{...rest}
				data-slot="bento"
				data-columns={String(resolvedColumns)}
				mix={[
					container("ui-marketing-bento"),
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
					at("md", "ui-marketing-bento", [
						gridTemplate({
							columns: repeat(resolvedColumns, "minmax(0, 1fr)"),
						}),
					]),
					mix,
				]}
			/>
		);
	};
}

/**
 * One bento cell. Compose {@link Bento.Title} and {@link Bento.Body} inside it.
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
					raw({ backgroundColor: "var(--ui-bg, Canvas)" }),
					p(6, 5),
					at("md", "ui-marketing-bento", p(8, 8)),
					mix,
				]}
			/>
		);
	};
};

/**
 * Cell title at the ambient heading depth.
 *
 * @param handle Runtime handle carrying the host heading's props.
 * @returns The render function producing the title.
 */
Bento.Title = function BentoTitle(handle: Handle<Bento.TitleProps>) {
	return () => {
		let { mix, ...rest } = handle.props;
		let resolved = resolveHeadingLevel(handle);
		let Tag = TAG_BY_LEVEL[resolved];

		return (
			<Tag
				{...rest}
				data-slot="bento-title"
				data-heading-level={resolved}
				mix={[text("lg"), weight("medium"), fg("neutral.emphasis"), mix]}
			/>
		);
	};
};

/**
 * Supporting copy under a bento title.
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
				mix={[text("sm"), leading("relaxed"), pretty(), fg("neutral"), mix]}
			/>
		);
	};
};
