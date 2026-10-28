/**
 * Checked claim rows for landing CTAs and hero support lists. The mark is a
 * brand-filled mask; every string stays on the page as children.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { flexWrap, gap, inlineFlex, items, vstack } from "@sdxc/u/layout";
import { when } from "@sdxc/u/state";
import { leading, text } from "@sdxc/u/typography";

/** Axis {@link CheckList} lays rows along when `orientation` is omitted. */
const DEFAULT_ORIENTATION: CheckList.Orientation = "stacked";

/** The check each row is marked with, drawn as a brand-filled mask. */
const CHECK_MASK = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6 9 17l-5-5'/%3E%3C/svg%3E") center / contain no-repeat`;

/**
 * Prop types for {@link CheckList}.
 */
export namespace CheckList {
	/**
	 * Whether rows stack as a claim list or wrap as a horizontal cluster under
	 * a hero CTA.
	 */
	export type Orientation = "stacked" | "horizontal";

	/**
	 * Props accepted by {@link CheckList}.
	 */
	export interface Props extends TagProps<"ul"> {
		/** Layout axis. Defaults to {@link DEFAULT_ORIENTATION}. */
		orientation?: Orientation;
		/** One or more {@link CheckRow} items. */
		children: RemixNode;
	}
}

/**
 * Prop types for {@link CheckRow}.
 */
export namespace CheckRow {
	/**
	 * Props accepted by {@link CheckRow}.
	 */
	export interface Props extends TagProps<"li"> {
		/** Claim copy for the row. */
		children: RemixNode;
	}
}

/**
 * Lays {@link CheckRow} children as a stacked claim list or a wrapping
 * horizontal cluster under CTAs.
 *
 * @param handle Runtime handle carrying the host `<ul>`'s props.
 * @returns The render function producing the list's markup.
 * @example
 * <CheckList>
 * 	<CheckRow>{t("claim.one")}</CheckRow>
 * 	<CheckRow>{t("claim.two")}</CheckRow>
 * </CheckList>
 * @example
 * <CheckList orientation="horizontal">
 * 	<CheckRow>{t("claim.fast")}</CheckRow>
 * 	<CheckRow>{t("claim.free")}</CheckRow>
 * </CheckList>
 */
export function CheckList(handle: Handle<CheckList.Props>) {
	return () => {
		let { mix, orientation, ...rest } = handle.props;
		let resolvedOrientation = orientation ?? DEFAULT_ORIENTATION;
		let isHorizontal = resolvedOrientation === "horizontal";

		return (
			<ul
				{...rest}
				data-slot="check-list"
				data-orientation={resolvedOrientation}
				mix={[
					raw({ listStyle: "none", padding: "0", margin: "0" }),
					isHorizontal
						? [inlineFlex(), flexWrap(), items("center"), gap(4)]
						: [vstack({ gap: 2.5, align: "stretch" })],
					mix,
				]}
			/>
		);
	};
}

/**
 * One checked claim. The brand mark sits in the inline-start gutter; copy is
 * the row's children.
 *
 * @param handle Runtime handle carrying the host `<li>`'s props.
 * @returns The render function producing the row's markup.
 * @example
 * <CheckRow>{t("claim.uptime")}</CheckRow>
 */
export function CheckRow(handle: Handle<CheckRow.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<li
				{...rest}
				data-slot="check-row"
				mix={[
					raw({
						position: "relative",
						paddingInlineStart: "1.75rem",
					}),
					text("base"),
					leading("snug"),
					fg("neutral"),
					when(
						"&::before",
						raw({
							content: '""',
							position: "absolute",
							insetInlineStart: "0",
							insetBlockStart: "0.3em",
							inlineSize: "1rem",
							blockSize: "1rem",
							backgroundColor: "var(--ui-brand-fg)",
							mask: CHECK_MASK,
							WebkitMask: CHECK_MASK,
						}),
					),
					mix,
				]}
			/>
		);
	};
}
