/**
 * The guided tour an app landing walks through: on a wide band the steps sit on a rail of
 * native radios beside the screen they switch, playing on their own once the autoplay island
 * loads; on a narrow one each step is a card with its own screen in a row that scrolls sideways.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { keyframes } from "@sdxc/u/animation";
import { fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { block, grid, gridArea, hidden, vstack } from "@sdxc/u/layout";
import { motionSafe } from "@sdxc/u/responsive";
import { is, m, maxIs, mi, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { leading, text, weight } from "@sdxc/u/typography";

import { PATH_ADVANCE_ANIMATION } from "~/resources/components/path-autoplay";
import { Swipeable } from "~/resources/views/app-pages/swipeable";

/** The container width from which the tour lays its rail out beside the screen. */
const WIDE = "@container (min-width: 48rem)";

/** One stop of the tour: the radio value it switches on, its words and its screen. */
export interface TourStep {
	value: string;
	title: string;
	body: string;
	/** The screen the step shows, usually a framed phone. */
	screen: RemixNode;
}

/** Props of the tour. */
export interface GuidedTourProps {
	/** The radio group's name, unique on the page; each radio's id is `<name>-<value>`. */
	name: string;
	/** Names the rail's fieldset and the narrow row for assistive technology. */
	label: string;
	steps: ReadonlyArray<TourStep>;
	/** Seconds each step stays before the next takes over while the tour plays. */
	seconds?: number;
}

/**
 * The tour, both layouts at once: CSS shows the rail from the `WIDE` band width and the cards
 * below it. Place the autoplay island in the same section to have the rail advance on its own.
 * Colours come from `--app-rail`, `--app-card`, `--app-accent` and `--app-stage`.
 *
 * @param handle Runtime handle carrying the steps.
 * @returns The render function producing the tour.
 */
export function GuidedTour(handle: Handle<GuidedTourProps>) {
	return () => (
		<>
			<RailTour {...handle.props} />
			<StepCards {...handle.props} />
		</>
	);
}

/**
 * The wide tour: the steps as radios down a rail, vertically centred beside the screens,
 * which share one grid cell and show by `:has()` on the checked radio, so switching needs
 * no script and the band keeps one height.
 *
 * @returns The render function producing the tour.
 */
function RailTour(handle: Handle<GuidedTourProps>) {
	return () => {
		let { label, name, seconds = 7, steps } = handle.props;
		return (
			<div
				data-slot="tabbed-stage"
				data-tour=""
				mix={[
					raw({
						display: "none",
						[WIDE]: {
							display: "grid",
							gridTemplateColumns: "minmax(0, 5fr) minmax(0, 7fr)",
							columnGap: "3rem",
							alignItems: "center",
						},
					}),
				]}
			>
				<fieldset mix={[m(0), p(0), raw({ border: "0", minInlineSize: "0" })]}>
					<legend mix={[visuallyHidden()]}>{label}</legend>
					{steps.map((step, index) => (
						<div
							key={step.value}
							mix={[raw({ position: "relative" }), stepLine(index === steps.length - 1, seconds)]}
						>
							<input
								type="radio"
								name={name}
								id={`${name}-${step.value}`}
								value={step.value}
								defaultChecked={index === 0}
								mix={[visuallyHidden()]}
							/>
							<label
								htmlFor={`${name}-${step.value}`}
								mix={[
									raw({
										position: "relative",
										display: "block",
										paddingBlock: "0.75rem",
										paddingInlineStart: "1.5rem",
										paddingInlineEnd: "0.75rem",
										borderInlineStart: "1px solid var(--app-rail)",
										cursor: "pointer",
										"&::before": {
											content: '""',
											position: "absolute",
											insetInlineStart: "-3.5px",
											insetBlockStart: "calc(1.625rem - 3px)",
											inlineSize: "6px",
											blockSize: "6px",
											backgroundColor: "var(--app-card)",
											boxShadow: "0 0 0 1px var(--app-rail)",
										},
										":is(input:checked) + &::before": {
											backgroundColor: "var(--app-accent)",
											boxShadow: "none",
										},
										":is(input:focus-visible) + &": {
											outline: "2px solid var(--app-accent)",
											outlineOffset: "-2px",
										},
									}),
								]}
							>
								<span
									mix={[
										text("lg"),
										weight("medium"),
										fg("neutral"),
										block(),
										when(":is(input:checked) + label &", fg("neutral.emphasis")),
									]}
								>
									{step.title}
								</span>
								<span
									mix={[
										text("sm"),
										fg("neutral"),
										leading("relaxed"),
										raw({ marginBlockStart: "0.25rem" }),
										hidden(),
										when(":is(input:checked) + label &", block()),
									]}
								>
									{step.body}
								</span>
							</label>
						</div>
					))}
				</fieldset>
				<div mix={[grid()]}>
					{steps.map((step) => (
						<div
							key={step.value}
							mix={[
								gridArea("1 / 1"),
								hidden(),
								when(`[data-tour]:has(input[value="${step.value}"]:checked) &`, block()),
							]}
						>
							<StepScreen>{step.screen}</StepScreen>
						</div>
					))}
				</div>
			</div>
		);
	};
}

/**
 * The progress line a step grows down the rail while it is active, from its dot to the next
 * one. It runs only while the tour plays on screen and the reader allows motion, and holds
 * still while the pointer or focus is in the tour; its end is what advances the tour.
 *
 * @param last Whether the step is the last, whose line stops at the end of the rail.
 * @param seconds How long the line takes to grow.
 */
function stepLine(last: boolean, seconds: number) {
	return [
		keyframes(PATH_ADVANCE_ANIMATION, { from: { scale: "1 0" }, to: { scale: "1 1" } }),
		motionSafe(
			when("[data-autoplay] & > input:checked + label::after", [
				raw({
					content: '""',
					position: "absolute",
					insetInlineStart: "-1.5px",
					inlineSize: "2px",
					insetBlockStart: "1.625rem",
					insetBlockEnd: last ? "0" : "-1.625rem",
					backgroundColor: "var(--app-accent)",
					transformOrigin: "50% 0",
					animationName: PATH_ADVANCE_ANIMATION,
					animationDuration: `${seconds}s`,
					animationTimingFunction: "linear",
					animationFillMode: "forwards",
				}),
			]),
		),
		when(
			"[data-tour]:is(:hover, :focus-within) & > input:checked + label::after",
			raw({ animationPlayState: "paused" }),
		),
	];
}

/**
 * The narrow tour: each step a card with its title, its sentence and its screen, side by
 * side in a row that snaps card by card, so a phone reader swipes instead of scrolling
 * between a list and a screen.
 *
 * @returns The render function producing the cards.
 */
function StepCards(handle: Handle<GuidedTourProps>) {
	return () => {
		let { label, steps } = handle.props;
		return (
			<div mix={[raw({ [WIDE]: { display: "none" } })]}>
				<Swipeable label={label} column="82cqi">
					{steps.map((step, index) => (
						<li
							key={step.value}
							mix={[vstack({ gap: 3, align: "stretch" }), raw({ minInlineSize: "0" })]}
						>
							<StepScreen>{step.screen}</StepScreen>
							<span mix={[vstack({ gap: 1, align: "start" }), text("sm")]}>
								<span mix={[weight("semibold"), text("base")]}>
									{index + 1}. {step.title}
								</span>
								<span mix={[fg("neutral")]}>{step.body}</span>
							</span>
						</li>
					))}
				</Swipeable>
			</div>
		);
	};
}

/**
 * A step's screen on a tinted panel at a phone's width, the same size for every step so
 * switching never changes the band's height.
 *
 * @param handle Runtime handle carrying the screen.
 * @returns The render function producing the panel.
 */
function StepScreen(handle: Handle<{ children: RemixNode }>) {
	return () => (
		<div
			mix={[
				is("full"),
				rounded("xl"),
				raw({
					paddingBlock: "clamp(1.25rem, 5cqi, 3rem)",
					paddingInline: "clamp(1.5rem, 10cqi, 6rem)",
					background: "var(--app-stage)",
				}),
			]}
		>
			<div mix={[maxIs("16rem"), mi("auto"), is("full")]}>{handle.props.children}</div>
		</div>
	);
}
