/**
 * Three phones on a landing stage: the front screen readable, two more fanned behind it
 * once the column is wide enough, floating on staggered bobs inside a pausable loop.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { keyframes } from "@sdxc/u/animation";
import { raw } from "@sdxc/u/general";
import { hidden, hstack } from "@sdxc/u/layout";
import { at, motionSafe } from "@sdxc/u/responsive";

import { MotionLoop } from "./motion-loop.js";

/** Container the fan queries so side phones appear only when the stage has room. */
const FAN_CONTAINER = "ui-landing-phone-fan";

/**
 * A slow bob that keeps a phone feeling held. Delay offsets neighbours so they never rise
 * together; reduced-motion visitors see the rest pose.
 *
 * @param name Unique keyframe name for this bob.
 * @param delay Negative delay so the loop is mid-cycle on first paint.
 * @param rise How far the host lifts at the peak.
 * @param rotate Resting tilt kept through the motion so float does not flatten it.
 */
function bob(name: string, delay: string, rise: string, rotate: string) {
	return [
		keyframes(name, {
			"0%, 100%": { translate: "0 0", rotate },
			"50%": { translate: `0 ${rise}`, rotate },
		}),
		motionSafe(
			raw({
				animationName: name,
				animationDuration: "5.5s",
				animationTimingFunction: "ease-in-out",
				animationIterationCount: "infinite",
				animationDelay: delay,
			}),
		),
	];
}

/**
 * Prop types for {@link PhoneFan}.
 */
export namespace PhoneFan {
	/**
	 * Props accepted by {@link PhoneFan}.
	 */
	export interface Props extends TagProps<"div"> {
		/** Accessible name of the stage as a whole. */
		label: string;
		/** Accessible name of the pause toggle. Forwarded to {@link MotionLoop}. */
		pauseLabel?: string;
		/** Phone behind the front on the inline start, tilted out. */
		start: RemixNode;
		/** Leading phone in the middle of the fan. */
		front: RemixNode;
		/** Phone behind the front on the inline end, tilted out. */
		end: RemixNode;
	}
}

/**
 * Lays three phone screens as a fan: side phones hide on a narrow column and tilt out from
 * `md`, all floating on staggered bobs that {@link MotionLoop} can pause.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the stage.
 * @example
 * <PhoneFan label={t("phones.label")} pauseLabel={t("pause")} start={left} front={hero} end={right} />
 */
export function PhoneFan(handle: Handle<PhoneFan.Props>) {
	return () => {
		let { end, front, label, mix, pauseLabel, start, ...rest } = handle.props;

		return (
			<MotionLoop pauseLabel={pauseLabel} mix={mix} {...rest}>
				<div
					role="img"
					aria-label={label}
					data-slot="phone-fan"
					mix={[
						raw({
							"--phone": "min(14rem, 58cqi)",
							position: "relative",
							isolation: "isolate",
							overflow: "visible",
							paddingBlock: "0.75rem 1.25rem",
							containerType: "inline-size",
							containerName: FAN_CONTAINER,
						}),
					]}
				>
					<div
						data-slot="phone-fan-row"
						mix={[hstack({ gap: 0, align: "start", justify: "center" })]}
					>
						<FannedPhone side="start">{start}</FannedPhone>
						<div
							data-slot="phone-fan-front"
							mix={[
								raw({
									inlineSize: "var(--phone)",
									flexShrink: "0",
									zIndex: "1",
									transformOrigin: "50% 100%",
								}),
								bob("ui-phone-fan-front", "-0.4s", "-0.55rem", "-1.5deg"),
							]}
						>
							{front}
						</div>
						<FannedPhone side="end">{end}</FannedPhone>
					</div>
				</div>
			</MotionLoop>
		);
	};
}

/**
 * A phone tilted out from behind the front screen once the stage is wide enough; on a
 * narrow column the front phone stands alone. The tilt is baked into its bob so the float
 * never erases it.
 */
function FannedPhone(handle: Handle<{ side: "start" | "end"; children: RemixNode }>) {
	return () => {
		let start = handle.props.side === "start";
		let rotate = start ? "-7deg" : "7deg";

		return (
			<div
				data-slot="phone-fan-side"
				data-side={handle.props.side}
				mix={[
					hidden(),
					at(
						"md",
						FAN_CONTAINER,
						raw({
							display: "block",
							flexShrink: "0",
							inlineSize: "var(--phone)",
							marginBlockStart: "calc(var(--phone) * 0.18)",
							marginInline: start ? "0 calc(var(--phone) * -0.12)" : "calc(var(--phone) * -0.12) 0",
							scale: "0.86",
							transformOrigin: start ? "100% 0%" : "0% 0%",
						}),
					),
					at(
						"md",
						FAN_CONTAINER,
						bob(
							start ? "ui-phone-fan-start" : "ui-phone-fan-end",
							start ? "-1.2s" : "-2.8s",
							"-0.4rem",
							rotate,
						),
					),
				]}
			>
				{handle.props.children}
			</div>
		);
	};
}
