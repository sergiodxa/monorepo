/**
 * A frame for any looping illustration that runs longer than five seconds: an animated
 * diagram, a drifting backdrop, an endless rotating word. It adds a pause toggle in a
 * corner that freezes every animation inside, which WCAG 2.2.2 asks of such motion.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";

import { PauseToggle, pausedWhenChecked } from "../utils/pause-toggle.js";

/** Corner {@link MotionLoop} puts its toggle in when `placement` is omitted. */
const DEFAULT_PLACEMENT: MotionLoop.Placement = "end-end";

/** How far the toggle sits from the frame's edges. */
const INSET = "0.75rem";

/**
 * Prop types for {@link MotionLoop}.
 */
export namespace MotionLoop {
	/**
	 * Corner the toggle sits in, as block then inline edge, so right-to-left pages mirror.
	 * `inline` puts it after the content on the same line, for a loop inside a sentence.
	 */
	export type Placement = "start-start" | "start-end" | "end-start" | "end-end" | "inline";

	/**
	 * Props accepted by {@link MotionLoop}.
	 */
	export interface Props extends TagProps<"div"> {
		/** Accessible name of the toggle. Defaults to "Pause the animation". */
		pauseLabel?: string;
		/** Toggle corner. Defaults to {@link DEFAULT_PLACEMENT}. */
		placement?: Placement;
		/** The looping content. */
		children: RemixNode;
	}
}

/**
 * Wraps looping content and pauses all of it, pseudo-elements included, while its toggle
 * is checked or the pointer rests on it. Under reduced motion the toggle hides, since the
 * content is expected to hold still.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the frame's markup.
 * @example
 * <MotionLoop pauseLabel={t("hero.pause")}>
 * 	<PipelineDiagram />
 * </MotionLoop>
 */
export function MotionLoop(handle: Handle<MotionLoop.Props>) {
	return () => {
		let { children, mix, pauseLabel, placement, ...rest } = handle.props;
		let resolvedPlacement = placement ?? DEFAULT_PLACEMENT;
		let isInline = resolvedPlacement === "inline";

		return (
			<div
				{...rest}
				data-slot="motion-loop"
				data-placement={resolvedPlacement}
				mix={[
					isInline
						? raw({ display: "inline-flex", alignItems: "center", gap: "0.75rem" })
						: raw({ position: "relative" }),
					pausedWhenChecked('[data-slot="motion-loop-content"]'),
					mix,
				]}
			>
				<div data-slot="motion-loop-content">{children}</div>
				<PauseToggle
					label={pauseLabel ?? "Pause the animation"}
					mix={[resolvedPlacement === "inline" ? [] : corner(resolvedPlacement)]}
				/>
			</div>
		);
	};
}

/** Pins the toggle to its corner with logical insets. */
function corner(placement: Exclude<MotionLoop.Placement, "inline">) {
	let [block, inline] = placement.split("-") as ["start" | "end", "start" | "end"];

	return raw({
		position: "absolute",
		zIndex: "1",
		[block === "start" ? "insetBlockStart" : "insetBlockEnd"]: INSET,
		[inline === "start" ? "insetInlineStart" : "insetInlineEnd"]: INSET,
	});
}
