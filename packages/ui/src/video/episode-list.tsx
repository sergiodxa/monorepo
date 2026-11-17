/**
 * A season's episodes as an ordered list: each one a link with its still, number, title,
 * running time and synopsis, a bar for how much of it was watched, and a mark on the one the
 * viewer is up to. Wide, the still sits beside the text; on a phone, the synopsis wraps under both.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { mergeMix, raw } from "@sdxc/u/general";
import { motionSafe } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";

import { clampProgress } from "./video-card.js";

/** Container each row queries, so the layout follows the list's width rather than the page's. */
const CONTAINER = "ui-episode-list";

/** Prop types for {@link EpisodeList} and its parts. */
export namespace EpisodeList {
	/** Every native `<ol>` attribute, with {@link EpisodeList.Item} children. */
	export interface Props extends TagProps<"ol"> {}

	/** One episode; every native `<li>` attribute but `title`, plus the episode's content. */
	export interface ItemProps extends Omit<TagProps<"li">, "title" | "children"> {
		/** Where the episode plays. */
		href: string;
		/** The episode's number in its season, drawn large beside the still. */
		number: number;
		title: string;
		/** The still, drawn edge to edge in a 16:9 frame. */
		still: RemixNode;
		/** The running time as it reads, such as "48 min". */
		duration?: string;
		/** One or two sentences on the episode. */
		synopsis?: RemixNode;
		/** The share watched, from 0 to 1. */
		progress?: number;
		/** What a screen reader hears for the bar, such as "Watched 60%". */
		progressLabel?: string;
		/** Marks the episode the viewer is up to, with `aria-current` on its link. */
		current?: boolean;
	}
}

/**
 * Renders the list. It is an `<ol>`, so a screen reader hears where each episode falls in the
 * season, and each row is one link named by its number and title.
 *
 * @example
 * <EpisodeList aria-label="Season 1">
 * 	<EpisodeList.Item href="/watch/1" number={1} title="Low Tide" still={<Still />} duration="52 min" />
 * </EpisodeList>
 */
export function EpisodeList(handle: Handle<EpisodeList.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;
		return (
			<ol
				{...rest}
				data-slot="episode-list"
				mix={mergeMix(
					[
						raw({
							containerName: CONTAINER,
							containerType: "inline-size",
							display: "grid",
							gap: "0.25rem",
							margin: "0",
							padding: "0",
							listStyle: "none",
						}),
					],
					mix,
				)}
			/>
		);
	};
}

/**
 * One episode row. The whole row is the link; its wash lights on hover and focus, and the still
 * lifts a little under the pointer, held still under reduced motion.
 */
EpisodeList.Item = function EpisodeListItem(handle: Handle<EpisodeList.ItemProps>) {
	return () => {
		let {
			current,
			duration,
			href,
			mix,
			number,
			progress,
			progressLabel,
			still,
			synopsis,
			title,
			...rest
		} = handle.props;
		let watched = progress === undefined ? null : clampProgress(progress);

		return (
			<li {...rest} data-slot="episode-list-item" mix={mergeMix([], mix)}>
				<a
					href={href}
					aria-current={current ? "true" : undefined}
					mix={[
						raw({
							position: "relative",
							display: "grid",
							gridTemplateColumns: "minmax(0, 9rem) minmax(0, 1fr)",
							gridTemplateAreas: '"still head" "copy copy"',
							alignItems: "center",
							columnGap: "0.875rem",
							rowGap: "0.625rem",
							padding: "0.75rem",
							borderRadius: "var(--ui-radius-lg, 0.5rem)",
							color: "inherit",
							textDecoration: "none",
							outline: "none",
							transition: "background-color 140ms ease",
							[`@container ${CONTAINER} (min-width: 40rem)`]: {
								gridTemplateColumns: "2.5rem minmax(0, 13rem) minmax(0, 1fr)",
								gridTemplateAreas: '"number still head" "number still copy"',
								alignItems: "start",
								columnGap: "1.25rem",
								rowGap: "0.375rem",
								padding: "1rem",
							},
						}),
						when("&:hover", raw({ backgroundColor: "var(--ui-neutral-bg-tint-hover)" })),
						when("&:focus-visible", raw({ boxShadow: "inset 0 0 0 2px var(--ui-brand-ring)" })),
						when("&[aria-current]", raw({ backgroundColor: "var(--ui-neutral-bg-tint-hover)" })),
						motionSafe(
							when("&:hover [data-slot=episode-still] > :first-child", raw({ scale: "1.04" })),
						),
					]}
				>
					<span
						aria-hidden="true"
						mix={[
							raw({
								gridArea: "number",
								display: "none",
								alignSelf: "center",
								fontSize: "1.5rem",
								lineHeight: "1",
								fontWeight: "600",
								fontVariantNumeric: "tabular-nums",
								color: "var(--ui-neutral-fg-muted)",
								[`@container ${CONTAINER} (min-width: 40rem)`]: { display: "block" },
							}),
						]}
					>
						{number}
					</span>
					<EpisodeStill watched={watched}>{still}</EpisodeStill>
					<span
						mix={[
							raw({
								gridArea: "head",
								display: "flex",
								alignItems: "baseline",
								justifyContent: "space-between",
								gap: "0.75rem",
								minInlineSize: "0",
								alignSelf: "center",
								[`@container ${CONTAINER} (min-width: 40rem)`]: { alignSelf: "end" },
							}),
						]}
					>
						<span
							data-slot="episode-title"
							mix={[
								raw({
									fontSize: "0.9375rem",
									lineHeight: "1.375rem",
									fontWeight: "600",
									color: "var(--ui-neutral-fg-emphasis)",
									textWrap: "balance",
								}),
							]}
						>
							<span
								aria-hidden="true"
								mix={[raw({ [`@container ${CONTAINER} (min-width: 40rem)`]: { display: "none" } })]}
							>
								{number}.{" "}
							</span>
							<span mix={[visuallyHidden()]}>{number}. </span>
							{title}
						</span>
						{duration === undefined ? null : (
							<span
								mix={[
									raw({
										flexShrink: "0",
										fontSize: "0.8125rem",
										color: "var(--ui-neutral-fg-muted)",
										fontVariantNumeric: "tabular-nums",
									}),
								]}
							>
								{duration}
							</span>
						)}
					</span>
					<span
						mix={[
							raw({
								gridArea: "copy",
								alignSelf: "start",
								fontSize: "0.875rem",
								lineHeight: "1.375rem",
								color: "var(--ui-neutral-fg)",
							}),
						]}
					>
						{synopsis}
						{watched === null || progressLabel === undefined ? null : (
							<span mix={[visuallyHidden()]}> {progressLabel}</span>
						)}
					</span>
				</a>
			</li>
		);
	};
};

/**
 * The still in its 16:9 frame with the watched bar along its foot; the bar is decorative, its
 * share spoken through the row's own text.
 */
function EpisodeStill(handle: Handle<{ watched: number | null; children: RemixNode }>) {
	return () => {
		let { children, watched } = handle.props;
		return (
			<span
				data-slot="episode-still"
				mix={[
					raw({
						gridArea: "still",
						position: "relative",
						display: "block",
						aspectRatio: "16 / 9",
						overflow: "clip",
						borderRadius: "var(--ui-radius-md, 0.375rem)",
						backgroundColor: "var(--ui-neutral-bg-tint-pressed)",
						boxShadow: "0 0 0 1px var(--ui-image-outline, rgb(0 0 0 / 0.08))",
						"& > :first-child": {
							position: "absolute",
							inset: "0",
							inlineSize: "100%",
							blockSize: "100%",
							objectFit: "cover",
							transition: "scale 320ms cubic-bezier(0.2, 0.7, 0.2, 1)",
						},
					}),
				]}
			>
				{children}
				{watched === null ? null : (
					<span
						aria-hidden="true"
						mix={[
							raw({
								position: "absolute",
								insetInline: "0",
								insetBlockEnd: "0",
								blockSize: "0.1875rem",
								backgroundColor: "rgb(255 255 255 / 0.28)",
							}),
						]}
					>
						<span
							mix={[
								raw({
									display: "block",
									blockSize: "100%",
									backgroundColor: "var(--ui-video-card-progress-color, var(--ui-brand-bg-solid))",
								}),
							]}
							style={{ inlineSize: `${(watched * 100).toFixed(1)}%` }}
						/>
					</span>
				)}
			</span>
		);
	};
}
