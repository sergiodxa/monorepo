/**
 * The page-load entrance for a landing hero: each part fades and rises 8px in turn, and
 * the product media settles from 98% a beat later. It runs only when the visitor allows
 * motion, so a reduced-motion visitor sees the finished hero on first paint.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, MixinDescriptor } from "remix/component";

import { keyframes } from "@sdxc/u/animation";
import { combine, raw } from "@sdxc/u/general";
import { motionSafe } from "@sdxc/u/responsive";

import type { CSSStyles } from "../utils/css-styles.js";

/** Keyframes for copy: eyebrow, title, lead and actions. */
const RISE_KEYFRAMES = "ui-entrance-rise";

/** Keyframes for media: a screenshot, a stage, a device. */
const SETTLE_KEYFRAMES = "ui-entrance-settle";

/** Milliseconds between one part's start and the next. */
const STAGGER_MS = 70;

/** Extra delay media waits, so it lands after the copy it illustrates. */
const MEDIA_DELAY_MS = 200;

/**
 * Options accepted by {@link entrance}.
 */
export namespace Entrance {
	/**
	 * Which part of the hero enters: `copy` rises, `media` settles in scale.
	 */
	export type Kind = "copy" | "media";

	/**
	 * Options accepted by {@link entrance}.
	 */
	export interface Options {
		/** Position in the sequence, from 0; each step starts 70ms after the previous. */
		order?: number;
		/** What enters. Defaults to `"copy"`. */
		kind?: Kind;
	}
}

/**
 * Plays the hero entrance on its host once, on load: 600ms on a decelerating curve,
 * delayed by `order` steps. Hosts keep their final state, so nothing flashes afterwards.
 *
 * @param options The host's place in the sequence and what kind of part it is.
 * @returns A `css()` mixin ready for a hero part's `mix` prop.
 * @example
 * <h1 mix={[entrance({ order: 1 })]}>{t("hero.title")}</h1>
 * @example
 * <ProductFrame mix={[entrance({ order: 4, kind: "media" })]}>{shot}</ProductFrame>
 */
export function entrance<Node extends Element = Element>(
	options: Entrance.Options = {},
): MixinDescriptor<Node, [styles: CSSStyles], ElementProps> {
	let order = options.order ?? 0;
	let isMedia = options.kind === "media";
	let delay = order * STAGGER_MS + (isMedia ? MEDIA_DELAY_MS : 0);

	return combine<Node>([
		keyframes<Node>(RISE_KEYFRAMES, {
			from: { opacity: "0", translate: "0 8px" },
			to: { opacity: "1", translate: "0 0" },
		}),
		keyframes<Node>(SETTLE_KEYFRAMES, {
			from: { opacity: "0", scale: "0.98" },
			to: { opacity: "1", scale: "1" },
		}),
		motionSafe<Node>(
			raw<Node>({
				animationName: isMedia ? SETTLE_KEYFRAMES : RISE_KEYFRAMES,
				animationDuration: "600ms",
				animationTimingFunction: "cubic-bezier(.2,.7,.2,1)",
				animationDelay: `${delay}ms`,
				animationFillMode: "both",
			}),
		),
	]);
}
