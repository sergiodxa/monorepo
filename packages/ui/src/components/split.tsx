/**
 * Two-column marketing band content: prose on one side and the media it
 * describes on the other. Stacks to a single column under the nearest
 * container; `lean` hands the wider track to copy or media, and `Split.Media
 * bleed` lets a wide shot run past the measure.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { fg } from "@sdxc/u/color";
import { combine, raw } from "@sdxc/u/general";
import { container, gap, grid, gridTemplate, items, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { minIs } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { leading, text } from "@sdxc/u/typography";

/** Which column gets the wider track when `lean` is omitted. */
const DEFAULT_LEAN: Split.Lean = "media";

/** The check each claim list item is marked with, drawn as a brand-filled mask. */
const CHECK_MASK = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6 9 17l-5-5'/%3E%3C/svg%3E") center / contain no-repeat`;

/**
 * Prop types for {@link Split} and its compound parts.
 */
export namespace Split {
	/**
	 * Which column receives the wider track above the stack breakpoint.
	 */
	export type Lean = "copy" | "media";

	/**
	 * Props accepted by {@link Split}.
	 */
	export interface Props extends TagProps<"div"> {
		/**
		 * Which column is wider. Defaults to {@link DEFAULT_LEAN} so media
		 * usually leads the layout.
		 */
		lean?: Lean;
		/** {@link Split.Copy} and {@link Split.Media} columns. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Split.Copy}.
	 */
	export interface CopyProps extends TagProps<"div"> {
		/**
		 * When set, unordered lists inside the copy render as checked claims
		 * rather than bullets.
		 */
		checks?: boolean;
		/** Prose, claims, and supporting copy for the column. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link Split.Media}.
	 */
	export interface MediaProps extends TagProps<"div"> {
		/**
		 * Lets the media's content grow to `max(100%, 60rem)` and run past the
		 * measure toward the inline end once the split has two columns; the
		 * enclosing band clips it at the viewport edge.
		 */
		bleed?: "end";
		/** Media, samples, or staged UI for the column. */
		children: RemixNode;
	}
}

/**
 * Lays {@link Split.Copy} and {@link Split.Media} as a two-track grid. The host
 * is the named sizing container; an inner wrapper holds the tracks and
 * `@container` column rules so the query can restyle a descendant. Goes two
 * columns at the `lg` container (48rem); the gap grows from 2rem to 3rem at `xl`.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the split's markup.
 * @example
 * <Split lean="copy">
 * 	<Split.Copy checks>{claims}</Split.Copy>
 * 	<Split.Media>{shot}</Split.Media>
 * </Split>
 */
export function Split(handle: Handle<Split.Props>) {
	return () => {
		let { children, lean, mix, ...rest } = handle.props;
		let resolvedLean = lean ?? DEFAULT_LEAN;
		let columns =
			resolvedLean === "copy"
				? "minmax(0, 1.15fr) minmax(0, 0.85fr)"
				: "minmax(0, 0.85fr) minmax(0, 1.15fr)";

		return (
			<div
				{...rest}
				data-lean={resolvedLean}
				data-slot="split"
				mix={[container("ui-marketing-split"), mix]}
			>
				<div
					mix={[
						combine([
							grid(),
							items("start"),
							gap(8),
							gridTemplate({ columns: "minmax(0, 1fr)" }),
							at("lg", "ui-marketing-split", gridTemplate({ columns })),
							at("xl", "ui-marketing-split", gap(12)),
						]),
					]}
				>
					{children}
				</div>
			</div>
		);
	};
}

/**
 * The prose column of a {@link Split}. Pass `checks` so nested unordered
 * lists read as claim rows with brand check marks.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the copy column.
 * @example
 * <Split.Copy checks>
 * 	<ul><li>{t("claim.one")}</li></ul>
 * </Split.Copy>
 */
Split.Copy = function SplitCopy(handle: Handle<Split.CopyProps>) {
	return () => {
		let { checks, mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="split-copy"
				data-checks={checks ? "true" : undefined}
				mix={[
					vstack({ gap: 6, align: "stretch" }),
					text("lg"),
					leading("relaxed"),
					fg("neutral"),
					checks
						? [
								when(
									"& ul",
									raw({
										listStyle: "none",
										padding: "0",
										margin: "0",
										display: "grid",
										gap: "0.625rem",
									}),
								),
								when(
									"& li",
									raw({
										position: "relative",
										paddingInlineStart: "1.75rem",
										fontSize: "1rem",
									}),
								),
								when(
									"& li::before",
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
							]
						: [],
					mix,
				]}
			/>
		);
	};
};

/**
 * The media column of a {@link Split}, sized to the track rather than its
 * content so a long sample does not tower over the copy beside it. With
 * `bleed="end"` a stacked split keeps the media at the column width.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the media column.
 * @example
 * <Split.Media>
 * 	<img src={shot} alt={alt} />
 * </Split.Media>
 */
Split.Media = function SplitMedia(handle: Handle<Split.MediaProps>) {
	return () => {
		let { bleed, mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="split-media"
				data-bleed={bleed}
				mix={[
					vstack({ gap: 4, align: "stretch" }),
					minIs(0),
					text("base"),
					when("& pre", raw({ maxBlockSize: "22rem", overflowY: "auto" })),
					bleed === "end"
						? at(
								"lg",
								"ui-marketing-split",
								when(
									"& > *",
									raw({ inlineSize: "max(100%, 60rem)", maxInlineSize: "none", flexShrink: "0" }),
								),
							)
						: [],
					mix,
				]}
			/>
		);
	};
};
