/**
 * The learning-path band and the swipeable row it shares with the exercises. On a wide band
 * the four steps sit on a rail of native radios, centred beside the screen they switch; on a
 * narrow one each step is a card with its own screen, in a row that scrolls sideways.
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
import { block, gap, grid, gridArea, hidden, vstack } from "@sdxc/u/layout";
import { motionSafe } from "@sdxc/u/responsive";
import { is, m, maxIs, mi, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { leading, text, weight } from "@sdxc/u/typography";
import { LandingHeader, LandingSection } from "@sdxc/ui/landing";

import type { ScreenName } from "~/resources/views/wakaba/parts";

import { PATH_ADVANCE_ANIMATION, PathAutoplay } from "~/resources/components/path-autoplay";
import { SwipeFade } from "~/resources/components/swipe-fade";
import { copyOf, Phone } from "~/resources/views/wakaba/parts";

/** The container width from which the band lays its tour out beside the screen. */
const WIDE = "@container (min-width: 48rem)";

/** Seconds each step of the tour stays before the next one takes over. */
const PATH_STEP_SECONDS = 7;

/** The steps in order, each with the radio value it switches on and its real screen. */
const STEPS = [
	{ value: "meet", screen: "new-word" },
	{ value: "practise", screen: "practice-feedback" },
	{ value: "exam", screen: "level-exam-path" },
	{ value: "review", screen: "oni-mistakes" },
] as const satisfies ReadonlyArray<{ value: string; screen: ScreenName }>;

/**
 * The band: the header, then the rail tour on a wide band or the step cards on a narrow
 * one. The autoplay island rides in the header and finds the tour by its slot.
 *
 * @returns The render function producing the band.
 */
export function PathBand(handle: Handle) {
	return () => {
		let t = copyOf(handle).path;
		return (
			<LandingSection
				id="path"
				mix={[raw({ contentVisibility: "auto", containIntrinsicSize: "auto 900px" })]}
			>
				<LandingHeader
					eyebrow={t.eyebrow}
					description={
						<>
							{t.description}
							<PathAutoplay />
						</>
					}
				>
					{t.title}
				</LandingHeader>
				<RailTour />
				<StepCards />
			</LandingSection>
		);
	};
}

/**
 * The wide tour: the steps as radios down a rail, vertically centred beside the screens,
 * which share one grid cell and show by `:has()` on the checked radio, so switching needs
 * no script and the band keeps one height.
 *
 * @returns The render function producing the tour.
 */
function RailTour(handle: Handle) {
	return () => {
		let t = copyOf(handle).path;
		return (
			<div
				data-slot="tabbed-stage"
				data-path-tour=""
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
					<legend mix={[visuallyHidden()]}>{t.stageLabel}</legend>
					{STEPS.map((step, index) => (
						<div
							key={step.value}
							mix={[raw({ position: "relative" }), pathLine(index === STEPS.length - 1)]}
						>
							<input
								type="radio"
								name="wakaba-path"
								id={`wakaba-path-${step.value}`}
								value={step.value}
								defaultChecked={index === 0}
								mix={[visuallyHidden()]}
							/>
							<label
								htmlFor={`wakaba-path-${step.value}`}
								mix={[
									raw({
										position: "relative",
										display: "block",
										paddingBlock: "0.75rem",
										paddingInlineStart: "1.5rem",
										paddingInlineEnd: "0.75rem",
										borderInlineStart: "1px solid var(--wakaba-rail)",
										cursor: "pointer",
										"&::before": {
											content: '""',
											position: "absolute",
											insetInlineStart: "-3.5px",
											insetBlockStart: "calc(1.625rem - 3px)",
											inlineSize: "6px",
											blockSize: "6px",
											backgroundColor: "var(--wakaba-card)",
											boxShadow: "0 0 0 1px var(--wakaba-rail)",
										},
										":is(input:checked) + &::before": {
											backgroundColor: "var(--wakaba-accent)",
											boxShadow: "none",
										},
										":is(input:focus-visible) + &": {
											outline: "2px solid var(--wakaba-accent)",
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
									{t.steps[index]?.title}
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
									{t.steps[index]?.body}
								</span>
							</label>
						</div>
					))}
				</fieldset>
				<div mix={[grid()]}>
					{STEPS.map((step) => (
						<div
							key={step.value}
							mix={[
								gridArea("1 / 1"),
								hidden(),
								when(`[data-path-tour]:has(input[value="${step.value}"]:checked) &`, block()),
							]}
						>
							<StepScreen screen={step.screen} />
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
 */
function pathLine(last: boolean) {
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
					backgroundColor: "var(--wakaba-accent)",
					transformOrigin: "50% 0",
					animationName: PATH_ADVANCE_ANIMATION,
					animationDuration: `${PATH_STEP_SECONDS}s`,
					animationTimingFunction: "linear",
					animationFillMode: "forwards",
				}),
			]),
		),
		when(
			"[data-path-tour]:is(:hover, :focus-within) & > input:checked + label::after",
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
function StepCards(handle: Handle) {
	return () => {
		let t = copyOf(handle).path;
		return (
			<div mix={[raw({ [WIDE]: { display: "none" } })]}>
				<Swipeable label={t.stageLabel} column="82cqi">
					{STEPS.map((step, index) => (
						<li
							key={step.value}
							mix={[vstack({ gap: 3, align: "stretch" }), raw({ minInlineSize: "0" })]}
						>
							<StepScreen screen={step.screen} />
							<span mix={[vstack({ gap: 1, align: "start" }), text("sm")]}>
								<span mix={[weight("semibold"), text("base")]}>
									{index + 1}. {t.steps[index]?.title}
								</span>
								<span mix={[fg("neutral")]}>{t.steps[index]?.body}</span>
							</span>
						</li>
					))}
				</Swipeable>
			</div>
		);
	};
}

namespace StepScreen {
	/** Props of a step's screen. */
	export interface Props {
		screen: ScreenName;
	}
}

/**
 * A step's real screen on a sun-tinted panel at a phone's width, the same size for every
 * step so switching never changes the band's height.
 *
 * @param handle Runtime handle carrying the screen.
 * @returns The render function producing the panel.
 */
function StepScreen(handle: Handle<StepScreen.Props>) {
	return () => (
		<div
			mix={[
				is("full"),
				rounded("xl"),
				raw({
					paddingBlock: "clamp(1.25rem, 5cqi, 3rem)",
					paddingInline: "clamp(1.5rem, 10cqi, 6rem)",
					backgroundColor: "var(--wakaba-sun)",
				}),
			]}
		>
			<div mix={[maxIs("16rem"), mi("auto"), is("full")]}>
				<Phone screen={handle.props.screen} />
			</div>
		</div>
	);
}

namespace Swipeable {
	/** Props of a row that scrolls sideways. */
	export interface Props {
		/** Names the list for assistive technology. */
		label: string;
		/**
		 * Each item's width while the row scrolls, in `cqi` of the row: most of it so one card
		 * reads at a time, and no wider than its content so cards sit the row's gap apart.
		 */
		column: string;
		/** The row's width from which every item fits and the row stops scrolling. */
		fitsFrom?: string;
		/** Each item's width once they all fit. Defaults to `column`. */
		fitColumn?: string;
		/** The row's `li` items. */
		children: RemixNode;
	}
}

/**
 * The fade a row's mask draws for each pair of edges with cards past them, each as wide as
 * the gutter `peek` leaves beside the centred card, so only the neighbours ever fade.
 */
function fades(peek: string) {
	return {
		end: `linear-gradient(to right, black calc(100% - ${peek}), transparent)`,
		start: `linear-gradient(to right, transparent, black ${peek})`,
		both: `linear-gradient(to right, transparent, black ${peek}, black calc(100% - ${peek}), transparent)`,
	};
}

/**
 * A row of cards that scrolls sideways one card at a time: each card is most of the row's
 * width and snaps to its centre, so one card is readable and its neighbours peek in the
 * equal gutters at either edge, all a fade ever covers. The row is its own size container,
 * so its gutters and `fitsFrom` measure the row; from `fitsFrom` it becomes a grid.
 *
 * @param handle Runtime handle carrying the label, the item widths and the items.
 * @returns The render function producing the row.
 */
export function Swipeable(handle: Handle<Swipeable.Props>) {
	return () => {
		let { children, column, fitColumn, fitsFrom, label } = handle.props;
		let fits = fitsFrom ? `@container (min-width: ${fitsFrom})` : undefined;
		let peek = `calc((100cqi - ${column}) / 2)`;
		let fade = fades(peek);
		return (
			<div mix={[raw({ containerType: "inline-size" })]}>
				<ul
					aria-label={label}
					data-swipe=""
					mix={[
						grid(),
						gap(4),
						m(0),
						p(0),
						raw({
							listStyle: "none",
							gridAutoFlow: "column",
							gridAutoColumns: column,
							overflowX: "auto",
							scrollSnapType: "x mandatory",
							paddingBlockEnd: "0.5rem",
							paddingInline: peek,
							"& > li": { scrollSnapAlign: "center" },
							maskImage: fade.end,
							'&[data-fade="start"]': { maskImage: fade.start },
							'&[data-fade="both"]': { maskImage: fade.both },
							'&[data-fade="none"]': { maskImage: "none" },
							...(fits
								? {
										[fits]: {
											maskImage: "none",
											overflowX: "visible",
											paddingInline: "0",
											gridAutoColumns: fitColumn ?? column,
										},
									}
								: {}),
						}),
					]}
				>
					{children}
				</ul>
				<SwipeFade />
			</div>
		);
	};
}
