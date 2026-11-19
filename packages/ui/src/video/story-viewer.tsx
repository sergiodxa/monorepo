/**
 * A full-screen story player: each person's stories are a group of timed segments under a row
 * of progress bars, groups sit side by side on a horizontal snap track, and tap zones that are
 * links step through them, so the viewer reads and moves without script and its island adds
 * timing, hold to pause and swipe down to close.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle, Props as TagProps, RemixNode } from "remix/component";

import { ChevronLeftIcon, ChevronRightIcon, PauseIcon, PlayIcon, XIcon } from "@sdxc/icons";
import { keyframes } from "@sdxc/u/animation";
import { mergeMix, raw } from "@sdxc/u/general";
import { motionReduce } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";
import { clientEntry } from "remix/component";

import { STORY_ACTIVE, STORY_PAUSED, storyViewerSync } from "./mixins/story-viewer-sync.js";

export { STORY_CHANGE_EVENT } from "./mixins/story-viewer-sync.js";
export type { StoryChangeDetail } from "./mixins/story-viewer-sync.js";

/** Prop types for {@link StoryViewer} and its parts. */
export namespace StoryViewer {
	/** Every native `<section>` attribute, plus the viewer's name, exit and control names. */
	export interface Props extends TagProps<"section"> {
		/** The viewer's accessible name, such as "Stories". */
		label: string;
		/** Where closing leaves to: the page the viewer opened from. */
		closeHref: string;
		labels: {
			close: string;
			/** The pause button's name; it is pressed while the story is paused. */
			pause: string;
		};
		/** {@link StoryViewer.Group} elements, one per person, in viewing order. */
		children: RemixNode;
	}

	/** Every native `<article>` attribute, plus one person's stories. */
	export interface GroupProps extends Omit<TagProps<"article">, "children"> {
		/** The group's accessible name, such as "Mara Quint's story". */
		label: string;
		/** What sits under the progress bars: the person, how long ago, a menu. */
		header?: RemixNode;
		/** Each segment's length in seconds, in order, which times its progress bar. */
		durations: number[];
		/** The segment the group shows first. */
		current: number;
		/** Whether the viewer opens on this group; exactly one group in a viewer sets it. */
		active?: boolean;
		/** The address of the segment before the current one, or the close address before the first. */
		previousHref: string;
		/** The address of the segment after the current one, or the close address after the last. */
		nextHref: string;
		/** The tap zones' names. */
		labels: { previous: string; next: string };
		/** What sits at the foot of the card, such as a reply field. */
		footer?: RemixNode;
		/** {@link StoryViewer.Segment} elements in order. */
		children: RemixNode;
	}

	/** Every native `<div>` attribute, plus one segment's address and picture. */
	export interface SegmentProps extends TagProps<"div"> {
		/** The segment's own address, which the address bar follows. */
		href: string;
		/** Whether this is the group's current segment. */
		current: boolean;
	}
}

/** The keyframes a current segment's bar fills by. */
const FILL = "ui-story-fill";

/**
 * Renders the viewer: a full-screen dark stage with the close and pause buttons, and the track
 * of groups; the group marked `active` is the one the track starts at. A page shows it inside
 * a box by setting `--ui-story-viewer-position: absolute` and `--ui-story-viewer-height`.
 *
 * @example
 * <StoryViewer label="Stories" closeHref="/" labels={{ close: "Close", pause: "Pause" }}>
 * 	<StoryViewer.Group label="Mara's story" durations={[5, 5]} current={0} active
 * 		previousHref="/" nextHref="/stories/mara/2" labels={{ previous: "Previous", next: "Next" }}>
 * 		<StoryViewer.Segment href="/stories/mara/1" current><Art /></StoryViewer.Segment>
 * 	</StoryViewer.Group>
 * </StoryViewer>
 */
export function StoryViewer(handle: Handle<StoryViewer.Props>) {
	return () => {
		let { children, closeHref, label, labels, mix, ...rest } = handle.props;
		return (
			<section
				{...rest}
				aria-label={label}
				aria-roledescription="stories"
				tabindex={-1}
				data-slot="story-viewer"
				mix={mergeMix(
					[
						keyframes(FILL, { from: { inlineSize: "0%" }, to: { inlineSize: "100%" } }),
						raw({
							position: "var(--ui-story-viewer-position, fixed)",
							inset: "0",
							zIndex: "var(--ui-story-viewer-z, 60)",
							display: "grid",
							backgroundColor: "var(--ui-story-viewer-bg, oklch(0.14 0.01 280))",
							color: "oklch(0.98 0 0)",
							outline: "none",
							overscrollBehavior: "contain",
						}),
					],
					mix,
				)}
			>
				<div
					data-slot="story-viewer-track"
					mix={[
						raw({
							display: "grid",
							gridAutoFlow: "column",
							gridAutoColumns: "100%",
							overflowX: "auto",
							overflowY: "hidden",
							scrollSnapType: "x mandatory",
							overscrollBehaviorX: "contain",
							scrollbarWidth: "none",
							"&::-webkit-scrollbar": { display: "none" },
						}),
					]}
				>
					{children}
				</div>
				<div
					mix={[
						raw({
							position: "absolute",
							insetBlockStart: "max(0.75rem, env(safe-area-inset-top))",
							insetInlineEnd: "0.75rem",
							zIndex: "2",
							display: "flex",
							gap: "0.25rem",
						}),
					]}
				>
					<button
						type="button"
						data-story-pause=""
						data-story-control=""
						aria-label={labels.pause}
						aria-pressed="false"
						mix={[
							roundControl(),
							when("&:not([aria-pressed='true']) > [data-icon=play]", raw({ display: "none" })),
							when("&[aria-pressed='true'] > [data-icon=pause]", raw({ display: "none" })),
						]}
					>
						<PauseIcon aria-hidden="true" data-icon="pause" size={20} fill="currentColor" />
						<PlayIcon aria-hidden="true" data-icon="play" size={20} fill="currentColor" />
					</button>
					<a
						href={closeHref}
						data-story-close=""
						data-story-control=""
						aria-label={labels.close}
						mix={[roundControl()]}
					>
						<XIcon aria-hidden="true" size={24} />
					</a>
				</div>
				<StoryViewerSync />
			</section>
		);
	};
}

/** A round icon control over the dark stage, a 44px target. */
function roundControl() {
	return [
		raw({
			display: "inline-grid",
			placeItems: "center",
			inlineSize: "2.75rem",
			blockSize: "2.75rem",
			padding: "0",
			border: "0",
			borderRadius: "999px",
			color: "inherit",
			background: "rgb(0 0 0 / 0.25)",
			cursor: "pointer",
			textDecoration: "none",
		}),
		when("&:hover", raw({ background: "rgb(255 255 255 / 0.16)" })),
		when("&:focus-visible", raw({ outline: "2px solid oklch(0.98 0 0)", outlineOffset: "-2px" })),
	];
}

/**
 * One person's stories: a screen-wide snap point holding a card that fills a phone and stands
 * 9:16 with a margin on a wider screen, with the bars,
 * the header, the segments, the two tap zones and an optional footer.
 */
StoryViewer.Group = function StoryViewerGroup(handle: Handle<StoryViewer.GroupProps>) {
	return () => {
		let {
			active,
			children,
			current,
			durations,
			footer,
			header,
			label,
			labels,
			mix,
			nextHref,
			previousHref,
			...rest
		} = handle.props;
		return (
			<article
				{...rest}
				aria-label={label}
				data-slot="story-viewer-group"
				{...{ [STORY_ACTIVE]: active ? "" : undefined }}
				mix={mergeMix(
					[
						raw({
							container: "ui-story-group / size",
							display: "grid",
							placeItems: "center",
							blockSize: "var(--ui-story-viewer-height, 100dvh)",
							scrollSnapAlign: "center",
							scrollSnapStop: "always",
							overflow: "hidden",
						}),
						raw(active ? { scrollInitialTarget: "nearest" } : {}),
					],
					mix,
				)}
			>
				<div
					data-slot="story-viewer-card"
					mix={[
						raw({
							position: "relative",
							inlineSize: "100cqi",
							blockSize: "100cqb",
							overflow: "hidden",
							backgroundColor: "oklch(0.2 0.01 280)",
							touchAction: "pan-x",
							userSelect: "none",
							WebkitUserSelect: "none",
							WebkitTouchCallout: "none",
							transition: "transform 220ms ease, opacity 220ms ease, scale 220ms ease",
							"@container ui-story-group (min-width: 40rem)": {
								inlineSize: "min(100cqi, calc((100cqb - 3rem) * 0.5625))",
								blockSize: "calc(100cqb - 3rem)",
								borderRadius: "var(--ui-story-viewer-radius, 0.75rem)",
							},
						}),
						when(
							`[data-story-dragging] [${STORY_ACTIVE}] > &`,
							raw({
								transition: "none",
								transform: "translateY(var(--ui-story-pull, 0px))",
								opacity: "var(--ui-story-fade, 1)",
							}),
						),
						motionReduce(raw({ transition: "none" })),
					]}
				>
					{children}
					<div
						data-slot="story-viewer-chrome"
						mix={[
							raw({
								position: "absolute",
								insetInline: "0",
								insetBlockStart: "0",
								zIndex: "2",
								display: "grid",
								gap: "0.625rem",
								paddingBlock: "max(0.625rem, env(safe-area-inset-top)) 2.5rem",
								paddingInline: "0.75rem 6.75rem",
								background: "linear-gradient(rgb(0 0 0 / 0.45), rgb(0 0 0 / 0))",
								pointerEvents: "none",
								"& a, & button": { pointerEvents: "auto" },
								"@container ui-story-group (min-width: 40rem)": { paddingInlineEnd: "0.75rem" },
							}),
						]}
					>
						<div
							aria-hidden="true"
							mix={[
								raw({
									display: "grid",
									gridAutoFlow: "column",
									gridAutoColumns: "1fr",
									gap: "0.25rem",
								}),
							]}
						>
							{durations.map((seconds, index) => (
								<span
									data-slot="story-viewer-bar"
									data-done={index < current ? "" : undefined}
									data-current={index === current ? "" : undefined}
									style={`--ui-story-duration: ${seconds}s`}
									mix={[
										raw({
											display: "block",
											blockSize: "0.1875rem",
											borderRadius: "999px",
											overflow: "hidden",
											backgroundColor: "rgb(255 255 255 / 0.35)",
											"& > span": {
												display: "block",
												blockSize: "100%",
												inlineSize: "0%",
												backgroundColor: "oklch(0.99 0 0)",
											},
										}),
										when("&[data-done] > span", raw({ inlineSize: "100%" })),
										when(
											"&[data-current] > span",
											raw({
												animationName: FILL,
												animationDuration: "var(--ui-story-duration)",
												animationTimingFunction: "linear",
												animationFillMode: "forwards",
												animationPlayState: "paused",
											}),
										),
										when(
											`[${STORY_ACTIVE}] &[data-current] > span`,
											raw({ animationPlayState: "running" }),
										),
										when(
											`[${STORY_PAUSED}] &[data-current] > span`,
											raw({ animationPlayState: "paused" }),
										),
									]}
								>
									<span />
								</span>
							))}
						</div>
						{header}
					</div>
					<StoryZone direction="previous" href={previousHref} label={labels.previous} />
					<StoryZone direction="next" href={nextHref} label={labels.next} />
					{footer === undefined ? null : (
						<div
							data-slot="story-viewer-footer"
							data-story-control=""
							mix={[
								raw({
									position: "absolute",
									insetInline: "0",
									insetBlockEnd: "0",
									zIndex: "2",
									paddingBlock: "2.5rem max(0.75rem, env(safe-area-inset-bottom))",
									paddingInline: "0.75rem",
									background: "linear-gradient(rgb(0 0 0 / 0), rgb(0 0 0 / 0.5))",
								}),
							]}
						>
							{footer}
						</div>
					)}
				</div>
			</article>
		);
	};
};

/**
 * A tap zone over one side of the card: a third of it going back, two thirds going forward,
 * each a link to that segment's address, with a chevron where a pointer can hover.
 */
function StoryZone(
	handle: Handle<{ direction: "previous" | "next"; href: string; label: string }>,
) {
	return () => {
		let { direction, href, label } = handle.props;
		let back = direction === "previous";
		return (
			<a
				href={href}
				data-story-zone={direction}
				aria-label={label}
				draggable={false}
				mix={[
					raw({
						position: "absolute",
						zIndex: "1",
						insetBlock: "0",
						insetInlineStart: back ? "0" : "33.333%",
						insetInlineEnd: back ? "66.667%" : "0",
						display: "flex",
						alignItems: "center",
						justifyContent: back ? "flex-start" : "flex-end",
						paddingInline: "0.5rem",
						color: "oklch(0.99 0 0)",
						WebkitTapHighlightColor: "transparent",
						outline: "none",
						"& > svg": {
							inlineSize: "2rem",
							blockSize: "2rem",
							padding: "0.25rem",
							borderRadius: "999px",
							backgroundColor: "rgb(0 0 0 / 0.35)",
							opacity: "0",
							transition: "opacity 140ms ease",
						},
						"@media (hover: hover)": { "&:hover > svg": { opacity: "1" } },
					}),
					when(
						"&:focus-visible > svg",
						raw({ opacity: "1", outline: "2px solid oklch(0.99 0 0)" }),
					),
					motionReduce(raw({ "& > svg": { transition: "none" } })),
				]}
			>
				{back ? <ChevronLeftIcon aria-hidden="true" /> : <ChevronRightIcon aria-hidden="true" />}
			</a>
		);
	};
}

/** One segment: a full-card layer, shown only while it is its group's current one. */
StoryViewer.Segment = function StoryViewerSegment(handle: Handle<StoryViewer.SegmentProps>) {
	return () => {
		let { current, href, mix, ...rest } = handle.props;
		return (
			<div
				{...rest}
				data-slot="story-viewer-segment"
				data-href={href}
				data-current={current ? "" : undefined}
				mix={mergeMix(
					[
						raw({
							position: "absolute",
							inset: "0",
							visibility: "hidden",
							"& > *": { inlineSize: "100%", blockSize: "100%" },
							"& video, & img, & svg": { objectFit: "cover" },
						}),
						when("&[data-current]", raw({ visibility: "visible" })),
					],
					mix,
				)}
			/>
		);
	};
};

/**
 * The island inside every {@link StoryViewer}: a hidden marker that runs the viewer. It loads
 * from `@sdxc/ui/video/story-viewer`, which the browser entry maps to an import.
 */
export const StoryViewerSync: EntryComponent<Record<never, never>> = clientEntry(
	"@sdxc/ui/video/story-viewer#StoryViewerSync",
	function StoryViewerSync() {
		return () => <span hidden mix={[storyViewerSync()]} />;
	},
);
