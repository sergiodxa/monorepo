/**
 * A titled row of video cards that scrolls sideways, the shelf a catalogue home stacks:
 * native scroll snap moves it by touch, trackpad and keyboard with no script, and once script
 * runs, paging buttons at its edges step one screenful at a time and disable at either end.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle, Props as TagProps, RemixNode } from "remix/component";

import { ChevronLeftIcon, ChevronRightIcon } from "@sdxc/icons";
import { mergeMix, raw } from "@sdxc/u/general";
import { hidden } from "@sdxc/u/layout";
import { motionReduce } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";
import { clientEntry } from "remix/component";

import { READY_ATTRIBUTE, STEP_ATTRIBUTE, videoShelfSteps } from "./mixins/video-shelf-steps.js";

/** Prop types for {@link VideoShelf} and its parts. */
export namespace VideoShelf {
	/** Which card shape the shelf holds, which sets how wide each item is. */
	export type Size = "landscape" | "poster";

	/** The paging buttons' accessible names. */
	export interface Labels {
		previous: string;
		next: string;
	}

	/** Every native `<section>` attribute but `title`, plus the shelf's heading and items. */
	export interface Props extends Omit<TagProps<"section">, "title"> {
		/** Names the shelf and its parts; the heading and the scroller derive their ids from it. */
		id: string;
		/** The shelf's heading, such as "Continue watching". */
		title: RemixNode;
		/** A link beside the heading, such as "See all". */
		action?: RemixNode;
		/** The paging buttons' names, which script reveals. */
		labels: Labels;
		/** Default: `"landscape"`. */
		size?: Size;
		/** The heading's level. Default: `2`. */
		level?: 2 | 3;
		/** {@link VideoShelf.Item} elements, one per card. */
		children: RemixNode;
	}

	/** Every native `<li>` attribute. */
	export interface ItemProps extends TagProps<"li"> {}
}

/** Each item's inline size per shape, wider on wider screens and never a sliver on a phone. */
const ITEM_SIZES: Record<VideoShelf.Size, string> = {
	landscape: "clamp(13.5rem, 21cqi, 19rem)",
	poster: "clamp(8.25rem, 13cqi, 11.5rem)",
};

/** Container the shelf declares, which its item sizes read their width from. */
const CONTAINER = "ui-video-shelf";

/**
 * Space before the first card and after the last, so the shelf runs edge to edge while its
 * cards line up with the page's own gutter; a page sets it to that gutter.
 */
const INSET = "var(--ui-video-shelf-inset, 1rem)";

/** Gap between two cards. */
const GAP = "var(--ui-video-shelf-gap, 0.75rem)";

/**
 * Renders the shelf: the heading row, then the scroller holding a list of items, between two
 * paging buttons kept hidden until the shelf's island reveals them. The scroller is a labelled
 * region, so a keyboard reaches it and scrolls it with the arrow keys.
 *
 * @example
 * <VideoShelf id="trending" title="Trending now" labels={{ previous: "Previous", next: "Next" }}>
 * 	{titles.map((title) => <VideoShelf.Item><VideoCard {...title} /></VideoShelf.Item>)}
 * </VideoShelf>
 */
export function VideoShelf(handle: Handle<VideoShelf.Props>) {
	return () => {
		let {
			action,
			children,
			id,
			labels,
			level = 2,
			mix,
			size = "landscape",
			title,
			...rest
		} = handle.props;
		let headingId = `${id}-title`;

		return (
			<section
				{...rest}
				id={id}
				aria-labelledby={headingId}
				data-slot="video-shelf"
				data-size={size}
				mix={mergeMix(
					[
						raw({
							"--ui-video-shelf-item-size": ITEM_SIZES[size],
							containerName: CONTAINER,
							containerType: "inline-size",
							position: "relative",
							display: "grid",
							gap: "0.625rem",
							minInlineSize: "0",
						}),
						when("&:hover [data-video-shelf-step]:not([disabled])", raw({ opacity: "1" })),
						when("&:focus-within [data-video-shelf-step]:not([disabled])", raw({ opacity: "1" })),
					],
					mix,
				)}
			>
				<div
					mix={[
						raw({
							display: "flex",
							alignItems: "baseline",
							justifyContent: "space-between",
							gap: "1rem",
							paddingInline: INSET,
						}),
					]}
				>
					<ShelfHeading id={headingId} level={level}>
						{title}
					</ShelfHeading>
					{action === undefined ? null : (
						<div mix={[raw({ fontSize: "0.875rem", flexShrink: "0" })]}>{action}</div>
					)}
				</div>
				<div mix={[raw({ position: "relative", minInlineSize: "0" })]}>
					<ShelfStep direction={-1} label={labels.previous} />
					<div
						id={`${id}-scroller`}
						role="region"
						aria-labelledby={headingId}
						data-slot="video-shelf-scroller"
						mix={[
							raw({
								overflowX: "auto",
								overflowY: "hidden",
								overscrollBehaviorX: "contain",
								scrollSnapType: "x mandatory",
								scrollPaddingInline: INSET,
								scrollBehavior: "smooth",
								scrollbarWidth: "thin",
								outline: "none",
							}),
							when(`&[${READY_ATTRIBUTE}]`, raw({ scrollbarWidth: "none" })),
							when("&:focus-visible", raw({ boxShadow: "inset 0 0 0 2px var(--ui-brand-ring)" })),
							motionReduce(raw({ scrollBehavior: "auto" })),
						]}
					>
						<ul
							mix={[
								raw({
									display: "grid",
									gridAutoFlow: "column",
									gridAutoColumns: "var(--ui-video-shelf-item-size)",
									gap: GAP,
									margin: "0",
									paddingBlock: "0.25rem 0.5rem",
									paddingInline: INSET,
									listStyle: "none",
									inlineSize: "max-content",
								}),
							]}
						>
							{children}
						</ul>
					</div>
					<ShelfStep direction={1} label={labels.next} />
				</div>
				<VideoShelfSync />
			</section>
		);
	};
}

/** The shelf's heading at the level its page outline needs. */
function ShelfHeading(handle: Handle<{ id: string; level: 2 | 3; children: RemixNode }>) {
	return () => {
		let { children, id, level } = handle.props;
		let mix = [
			raw({
				margin: "0",
				fontSize: "var(--ui-video-shelf-title-size, 1.125rem)",
				lineHeight: "1.5rem",
				fontWeight: "700",
				letterSpacing: "-0.01em",
				color: "var(--ui-neutral-fg-emphasis)",
			}),
		];
		return level === 3 ? (
			<h3 id={id} mix={mix}>
				{children}
			</h3>
		) : (
			<h2 id={id} mix={mix}>
				{children}
			</h2>
		);
	};
}

/**
 * One card's place in the shelf, snapping to the scroller's start so a step lands on a card's
 * edge rather than through one.
 */
VideoShelf.Item = function VideoShelfItem(handle: Handle<VideoShelf.ItemProps>) {
	return () => {
		let { mix, ...rest } = handle.props;
		return (
			<li
				{...rest}
				data-slot="video-shelf-item"
				mix={mergeMix([raw({ scrollSnapAlign: "start", minInlineSize: "0" })], mix)}
			/>
		);
	};
};

/**
 * A paging button over one edge of the shelf, tall enough to cover the art and shaded toward
 * the edge. It renders hidden: the island reveals it where a pointer can hover, and keeps it
 * disabled at the end it points to.
 */
function ShelfStep(handle: Handle<{ direction: -1 | 1; label: string }>) {
	return () => {
		let { direction, label } = handle.props;
		let start = direction === -1;
		return (
			<button
				type="button"
				hidden
				aria-label={label}
				{...{ [STEP_ATTRIBUTE]: String(direction) }}
				mix={[
					raw({
						position: "absolute",
						zIndex: "1",
						insetBlock: "0.25rem 0.5rem",
						insetInlineStart: start ? "0" : "auto",
						insetInlineEnd: start ? "auto" : "0",
						inlineSize: `max(2.75rem, calc(${INSET} + 0.25rem))`,
						display: "grid",
						placeItems: "center",
						padding: "0",
						border: "0",
						cursor: "pointer",
						color: "oklch(0.98 0 0)",
						background: `linear-gradient(${start ? "to right" : "to left"}, rgb(0 0 0 / 0.7), rgb(0 0 0 / 0))`,
						opacity: "0",
						transition: "opacity 160ms ease",
						"& > svg": { inlineSize: "1.75rem", blockSize: "1.75rem" },
						"@media (hover: none)": { display: "none" },
					}),
					when("&[hidden]", hidden()),
					when("&[disabled]", raw({ opacity: "0", pointerEvents: "none" })),
					when(
						"&:focus-visible",
						raw({ opacity: "1", outline: "2px solid var(--ui-brand-ring)", outlineOffset: "-2px" }),
					),
					motionReduce(raw({ transition: "none" })),
				]}
			>
				{start ? <ChevronLeftIcon aria-hidden="true" /> : <ChevronRightIcon aria-hidden="true" />}
			</button>
		);
	};
}

/**
 * The island inside every {@link VideoShelf}: a hidden marker that reveals and runs the paging
 * buttons. It loads from `@sdxc/ui/video/video-shelf`, which the browser entry maps to an import.
 */
export const VideoShelfSync: EntryComponent<Record<never, never>> = clientEntry(
	"@sdxc/ui/video/video-shelf#VideoShelfSync",
	function VideoShelfSync() {
		return () => <span hidden mix={[videoShelfSteps()]} />;
	},
);
