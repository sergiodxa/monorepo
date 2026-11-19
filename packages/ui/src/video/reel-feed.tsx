/**
 * A full-height vertical feed of short videos, one per screen, the way a reels or shorts tab
 * reads: native scroll snap moves it under the thumb, and its island loads only the reels
 * around the one on screen, plays that one, and steps one reel per key or wheel flick.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle, Props as TagProps, RemixNode } from "remix/component";

import { PlayIcon } from "@sdxc/icons";
import { mergeMix, raw } from "@sdxc/u/general";
import { motionReduce } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";
import { clientEntry } from "remix/component";

import { REEL_ACTIVE, REEL_PAUSED, reelFeedSync, reelPreload } from "./mixins/reel-feed-sync.js";

export { REEL_CHANGE_EVENT, reelPreload } from "./mixins/reel-feed-sync.js";
export type { ReelChangeDetail } from "./mixins/reel-feed-sync.js";

/** Prop types for {@link ReelFeed} and its parts. */
export namespace ReelFeed {
	/** Every native `<section>` attribute, plus the feed's name and options. */
	export interface Props extends TagProps<"section"> {
		/** The feed's accessible name, such as "Reels". */
		label: string;
		/**
		 * Puts each reel's `href` in the address bar as it comes on screen, in place, so the
		 * address always shares the reel being watched.
		 */
		followAddress?: boolean;
		/**
		 * The frame the next reel's page is prefetched into, such as `main`, so moving to it with
		 * a link renders without waiting; the document hint is prefetched either way.
		 */
		prefetchTarget?: string;
		/** {@link ReelFeed.Item} elements in feed order. */
		children: RemixNode;
		/**
		 * Controls beside the scroller, such as up and down arrows: an element marked
		 * `data-reel-step="1"` or `"-1"` steps the feed, so a link to the next reel moves it in place.
		 */
		controls?: RemixNode;
	}

	/** One video source, in the order the browser should try them. */
	export interface Source {
		src: string;
		type: string;
	}

	/** Every native `<article>` attribute, plus the reel's video and what sits over it. */
	export interface ItemProps extends Omit<TagProps<"article">, "children"> {
		/** The reel's own address, which the feed follows and prefetches. */
		href: string;
		/** The reel's accessible name, such as "Reel by Mara Quint". */
		label: string;
		/**
		 * The reel's index minus the index of the reel the page opens on: `0` marks that reel,
		 * which the scroller starts at and which autoplays, and the distance sets its `preload`.
		 */
		offset: number;
		sources: Source[];
		/** Plays the video only this many seconds before looping, for a clip longer than the reel. */
		loopAt?: number;
		/** Drawn behind the video, for a transparent clip or while it loads. */
		backdrop?: RemixNode;
		/** The stage's play button names: it reads `pause` while playing, pressed once paused. */
		labels: { pause: string };
		/** What sits over the video: the author, the caption, the action column. */
		children?: RemixNode;
	}
}

/**
 * A one-pixel transparent GIF as the poster, so the drawn backdrop shows through until the
 * first frame instead of the browser's grey placeholder.
 */
const CLEAR_POSTER =
	"data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** The feed's height, a screen by default, which a page shortens by its own bars. */
const HEIGHT = "var(--ui-reel-feed-height, 100dvh)";

/**
 * Renders the feed: a labelled `feed` scroller that snaps one reel per screen, and the island
 * that runs it. It keeps scrolling and snapping without script; the reel at `offset` 0 is
 * where the scroller starts and the one that autoplays.
 *
 * @example
 * <ReelFeed label="Reels" followAddress prefetchTarget="main">
 * 	{reels.map((reel, index) => <ReelFeed.Item href={reel.href} label={reel.label}
 * 		offset={index - current} sources={reel.sources} labels={{ pause: "Pause" }} />)}
 * </ReelFeed>
 */
export function ReelFeed(handle: Handle<ReelFeed.Props>) {
	return () => {
		let { children, controls, followAddress, label, mix, prefetchTarget, ...rest } = handle.props;
		return (
			<section
				{...rest}
				aria-label={label}
				data-slot="reel-feed"
				data-follow-address={followAddress ? "" : undefined}
				data-prefetch-target={prefetchTarget}
				mix={mergeMix([raw({ position: "relative", blockSize: HEIGHT, minInlineSize: "0" })], mix)}
			>
				<div
					role="feed"
					aria-label={label}
					data-slot="reel-feed-scroller"
					mix={[
						raw({
							blockSize: "100%",
							overflowX: "hidden",
							overflowY: "auto",
							overscrollBehavior: "contain",
							scrollSnapType: "y mandatory",
							scrollbarWidth: "none",
							outline: "none",
							"&::-webkit-scrollbar": { display: "none" },
						}),
						when("&:focus-visible", raw({ boxShadow: "inset 0 0 0 2px var(--ui-brand-ring)" })),
					]}
				>
					{children}
				</div>
				{controls}
				<ReelFeedSync />
			</section>
		);
	};
}

/**
 * One reel: a screen-high snap point holding a stage as tall as the feed and at most 9:16
 * wide, with the backdrop, the video, a full-stage play button and the overlay over it, and
 * a progress line along its foot.
 */
ReelFeed.Item = function ReelFeedItem(handle: Handle<ReelFeed.ItemProps>) {
	return () => {
		let { backdrop, children, href, label, labels, loopAt, mix, offset, sources, ...rest } =
			handle.props;
		let current = offset === 0;
		return (
			<article
				{...rest}
				aria-label={label}
				data-slot="reel-feed-item"
				data-href={href}
				{...{ [REEL_ACTIVE]: current ? "" : undefined }}
				mix={mergeMix(
					[
						raw({
							position: "relative",
							blockSize: "100%",
							containerType: "size",
							scrollSnapAlign: "start",
							scrollSnapStop: "always",
							display: "grid",
							placeItems: "center",
							overflow: "hidden",
						}),
						raw(current ? { scrollInitialTarget: "nearest" } : {}),
					],
					mix,
				)}
			>
				<div
					data-slot="reel-feed-stage"
					mix={[
						raw({
							position: "relative",
							blockSize: "100%",
							inlineSize: "min(100cqi, 56.25cqb)",
							overflow: "hidden",
							backgroundColor: "oklch(0.16 0.01 280)",
							borderRadius: "var(--ui-reel-feed-radius, 0)",
							isolation: "isolate",
						}),
					]}
				>
					{backdrop === undefined ? null : (
						<div aria-hidden="true" data-slot="reel-feed-backdrop" mix={[layer()]}>
							{backdrop}
						</div>
					)}
					<video
						data-reel-video=""
						data-loop-at={loopAt === undefined ? undefined : String(loopAt)}
						preload={reelPreload(offset)}
						poster={CLEAR_POSTER}
						autoplay={current}
						muted
						loop
						playsinline
						aria-hidden="true"
						mix={[layer(), raw({ objectFit: "cover" })]}
					>
						{sources.map((source) => (
							<source src={source.src} type={source.type} />
						))}
					</video>
					<button
						type="button"
						data-reel-toggle=""
						aria-label={labels.pause}
						aria-pressed="false"
						mix={[
							layer(),
							raw({
								display: "grid",
								placeItems: "center",
								padding: "0",
								border: "0",
								background: "transparent",
								color: "oklch(0.99 0 0)",
								cursor: "pointer",
								"& > svg": {
									inlineSize: "4rem",
									blockSize: "4rem",
									padding: "1rem",
									borderRadius: "999px",
									backgroundColor: "rgb(0 0 0 / 0.45)",
									opacity: "0",
									transform: "scale(0.85)",
									transition: "opacity 160ms ease, transform 160ms ease",
								},
							}),
							when(
								`[${REEL_PAUSED}] > [data-slot=reel-feed-stage] > & > svg`,
								raw({ opacity: "1", transform: "scale(1)" }),
							),
							when(
								"&:focus-visible",
								raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "-4px" }),
							),
							motionReduce(raw({ "& > svg": { transition: "none" } })),
						]}
					>
						<PlayIcon aria-hidden="true" fill="currentColor" />
					</button>
					{children === undefined ? null : (
						<div
							data-slot="reel-feed-overlay"
							mix={[layer(), raw({ pointerEvents: "none", "& > *": { pointerEvents: "auto" } })]}
						>
							{children}
						</div>
					)}
					<span
						aria-hidden="true"
						data-slot="reel-feed-progress"
						mix={[
							raw({
								position: "absolute",
								insetInline: "0",
								insetBlockEnd: "0",
								blockSize: "2px",
								backgroundColor: "rgb(255 255 255 / 0.85)",
								transformOrigin: "left",
								transform: "scaleX(var(--ui-reel-progress, 0))",
								pointerEvents: "none",
							}),
						]}
					/>
				</div>
				{offset === 1 ? <link rel="prefetch" href={href} data-reel-next="" /> : null}
			</article>
		);
	};
};

/** A layer filling the stage, stacked in source order. */
function layer() {
	return raw({ position: "absolute", inset: "0", inlineSize: "100%", blockSize: "100%" });
}

/**
 * The island inside every {@link ReelFeed}: a hidden marker that runs the feed. It loads from
 * `@sdxc/ui/video/reel-feed`, which the browser entry maps to an import.
 */
export const ReelFeedSync: EntryComponent<Record<never, never>> = clientEntry(
	"@sdxc/ui/video/reel-feed#ReelFeedSync",
	function ReelFeedSync() {
		return () => <span hidden mix={[reelFeedSync()]} />;
	},
);
