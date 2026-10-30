/**
 * An endless horizontal ticker for logo walls and short proof lines: the items scroll
 * past under edge-fade masks, stop on hover, focus or a pause toggle, and sit still in a
 * centered wrapping row for visitors who ask for reduced motion.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { keyframes } from "@sdxc/u/animation";
import { combine, raw } from "@sdxc/u/general";
import { motionSafe } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";

import { PauseToggle, pausedWhenChecked } from "../utils/pause-toggle.js";

/** Seconds one full pass takes when `duration` is omitted; slow enough to read a mark. */
const DEFAULT_DURATION = 40;

/** Space between items, and after the last one so the seam matches. */
const DEFAULT_GAP = "3rem";

/** Keyframes moving the track one copy of the items to the inline start. */
const SCROLL_KEYFRAMES = "ui-marquee-scroll";

/** Keyframes for right-to-left pages, moving the track the other way. */
const SCROLL_RTL_KEYFRAMES = "ui-marquee-scroll-rtl";

/** Width of each edge fade. */
const FADE = "5rem";

/**
 * Prop types for {@link Marquee}.
 */
export namespace Marquee {
	/**
	 * Props accepted by {@link Marquee}.
	 */
	export interface Props extends TagProps<"div"> {
		/** Seconds one pass of the items takes. Defaults to {@link DEFAULT_DURATION}. */
		duration?: number;
		/** Space between items, any CSS length. Defaults to {@link DEFAULT_GAP}. */
		gap?: string;
		/** Accessible name of the pause toggle. Defaults to "Pause the scrolling logos". */
		pauseLabel?: string;
		/**
		 * The items, each a direct child: logos, short quotes, badges. Image and SVG items
		 * take the marketing logo height. They render twice; the copy is `aria-hidden` and `inert`.
		 */
		children: RemixNode;
	}
}

/**
 * Renders the items twice on one track and scrolls it by exactly one copy, so the loop
 * has no visible seam. Reduced motion drops the copy, the masks and the toggle, leaving a
 * centered row that wraps.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the marquee's markup.
 * @example
 * <Marquee aria-label={t("proof.label")}>
 * 	<img src={acme} alt="Acme" />
 * 	<img src={globex} alt="Globex" />
 * </Marquee>
 */
export function Marquee(handle: Handle<Marquee.Props>) {
	return () => {
		let { children, duration, gap, mix, pauseLabel, ...rest } = handle.props;
		let seconds = duration ?? DEFAULT_DURATION;
		let space = gap ?? DEFAULT_GAP;

		return (
			<div
				{...rest}
				data-slot="marquee"
				mix={[
					raw({ display: "flex", alignItems: "center", gap: "1rem", inlineSize: "100%" }),
					pausedWhenChecked('[data-slot="marquee-viewport"]'),
					mix,
				]}
			>
				<div data-slot="marquee-viewport" mix={[viewport()]}>
					<div data-slot="marquee-track" mix={[track(seconds)]}>
						<div data-slot="marquee-group" mix={[group(space)]}>
							{children}
						</div>
						<div data-slot="marquee-group" aria-hidden="true" inert mix={[group(space), copy()]}>
							{children}
						</div>
					</div>
				</div>
				<PauseToggle label={pauseLabel ?? "Pause the scrolling logos"} />
			</div>
		);
	};
}

/** The clipping window, faded at both inline edges while the track moves. */
function viewport() {
	let mask = `linear-gradient(to right, transparent, #000 ${FADE}, #000 calc(100% - ${FADE}), transparent)`;

	return combine([
		raw({ flex: "1 1 auto", minInlineSize: "0", overflow: "hidden" }),
		motionSafe(raw({ maskImage: mask, WebkitMaskImage: mask })),
	]);
}

/**
 * The moving track: two copies side by side, translated by half its width per pass. On a
 * right-to-left page the copies lay out mirrored, so the track moves the other way.
 */
function track(seconds: number) {
	let motion = (name: string) =>
		raw({
			flexWrap: "nowrap",
			justifyContent: "flex-start",
			inlineSize: "max-content",
			animationName: name,
			animationDuration: `${seconds}s`,
			animationTimingFunction: "linear",
			animationIterationCount: "infinite",
		});

	return combine([
		keyframes(SCROLL_KEYFRAMES, { from: { translate: "0 0" }, to: { translate: "-50% 0" } }),
		keyframes(SCROLL_RTL_KEYFRAMES, { from: { translate: "0 0" }, to: { translate: "50% 0" } }),
		raw({ display: "flex", flexWrap: "wrap", justifyContent: "center" }),
		motionSafe(motion(SCROLL_KEYFRAMES)),
		when("&:dir(rtl)", motionSafe(raw({ animationName: SCROLL_RTL_KEYFRAMES }))),
	]);
}

/**
 * One copy of the items. Its trailing padding equals the gap, so half the track is exactly
 * one copy plus one gap and the seam spaces like every other pair.
 */
function group(space: string) {
	return combine([
		raw({
			display: "flex",
			flexWrap: "wrap",
			alignItems: "center",
			justifyContent: "center",
			columnGap: space,
			rowGap: "1.5rem",
		}),
		when("& > *", raw({ flexShrink: "0" })),
		when(
			"& > :is(img, svg)",
			raw({
				blockSize: "var(--ui-marketing-logo-height, 1.75rem)",
				inlineSize: "auto",
				objectFit: "contain",
			}),
		),
		motionSafe(raw({ flexWrap: "nowrap", paddingInlineEnd: space })),
	]);
}

/** The seam copy, shown only while the track moves. */
function copy() {
	return combine([raw({ display: "none" }), motionSafe(raw({ display: "flex" }))]);
}
