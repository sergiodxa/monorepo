/**
 * The bonsai band, Wakaba's signature: the tree growing through its ten stages as a CSS
 * time-lapse over a timeline of practised days, beside a missed weekend showing the streak
 * reset while the tree stays. It needs no script, and holds still under reduced motion.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { keyframes } from "@sdxc/u/animation";
import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { block, gap, grid, gridArea, gridTemplate, repeat, vstack } from "@sdxc/u/layout";
import { at, motionSafe } from "@sdxc/u/responsive";
import { bs, is, m, maxIs, p, pb, pi } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { font, leading, tabularNums, text, weight } from "@sdxc/u/typography";
import { LandingHeader, LandingSection, MotionLoop } from "@sdxc/ui/landing";

import { copyOf, Mascot, WAKABA_ASSETS } from "~/resources/views/wakaba/parts";

/**
 * The practised days each stage begins at, in growth order. Distinct days count, so several
 * sessions on one day add one; a missed day adds none and takes none away.
 */
export const BONSAI_STAGES = [0, 4, 8, 12, 16, 30, 60, 90, 180, 365] as const;

/**
 * The band: the header's claim, the tree growing through its ten stages on its own, and the
 * missed-weekend card beside it.
 *
 * @returns The render function producing the band.
 */
export function BonsaiBand(handle: Handle) {
	return () => {
		let t = copyOf(handle).bonsai;
		return (
			<LandingSection
				id="bonsai"
				mix={[raw({ contentVisibility: "auto", containIntrinsicSize: "auto 900px" })]}
			>
				<LandingHeader eyebrow={t.eyebrow} description={t.description}>
					{t.title}
				</LandingHeader>
				<div
					mix={[
						grid(),
						gap(6),
						at("lg", gridTemplate({ columns: "minmax(0, 1fr) minmax(0, 1fr)" })),
						raw({ alignItems: "end" }),
					]}
				>
					<BonsaiTimelapse />
					<MissedWeekend />
				</div>
			</LandingSection>
		);
	};
}

/** A stage's file name under `bonsai/light/` and `bonsai/dark/`: its index and first day. */
function stageFile(index: number, days: number): string {
	return `${String(index).padStart(2, "0")}-day-${String(days).padStart(3, "0")}`;
}

/** Seconds each stage before the last holds the stage. */
const STEP = 3;

/** Seconds the full-grown tree holds before the loop starts over. */
const HOLD = 6;

/** Seconds a stage takes to fade into the next. */
const FADE = 0.8;

/** One loop of the time-lapse: nine steps, then the hold at a year. */
const CYCLE = STEP * (BONSAI_STAGES.length - 1) + HOLD;

/** A moment of the loop as a keyframe offset. */
function offset(seconds: number): string {
	return `${((seconds / CYCLE) * 100).toFixed(3)}%`;
}

/**
 * When stage `index` is on screen, as opacity keyframes: it fades in over the stage before,
 * holds for its step and fades out under the next. The first stage also fades in under the
 * last as the loop wraps, so the pot never stands empty.
 */
function stageFrames(index: number): Record<string, { opacity: string }> {
	let last = BONSAI_STAGES.length - 1;
	let start = index * STEP;
	if (index === 0) {
		return {
			"0%": { opacity: "1" },
			[offset(STEP)]: { opacity: "1" },
			[offset(STEP + FADE)]: { opacity: "0" },
			[offset(CYCLE - FADE)]: { opacity: "0" },
			"100%": { opacity: "1" },
		};
	}
	if (index === last) {
		return {
			"0%": { opacity: "0" },
			[offset(start)]: { opacity: "0" },
			[offset(start + FADE)]: { opacity: "1" },
			[offset(CYCLE - FADE)]: { opacity: "1" },
			"100%": { opacity: "0" },
		};
	}
	return {
		"0%": { opacity: "0" },
		[offset(start)]: { opacity: "0" },
		[offset(start + FADE)]: { opacity: "1" },
		[offset(start + STEP)]: { opacity: "1" },
		[offset(start + STEP + FADE)]: { opacity: "0" },
		"100%": { opacity: "0" },
	};
}

/**
 * The timeline's fill as `scale` keyframes: one steady line from the first tick to the last,
 * reaching each tick as its tree fades in, then holding full until the loop starts over.
 */
function fillFrames(): Record<string, { scale: string }> {
	let growth = STEP * (BONSAI_STAGES.length - 1);
	return {
		"0%": { scale: "0 1" },
		[offset(growth)]: { scale: "1 1" },
		[offset(CYCLE - FADE)]: { scale: "1 1" },
		"100%": { scale: "0 1" },
	};
}

/**
 * The time-lapse: every stage's picture in one grid cell, each fading in on its turn, over
 * a timeline of the ten day counts that fills as the tree grows. It runs once the reader
 * allows motion and pauses from its toggle; under reduced motion it holds the full tree.
 *
 * @returns The render function producing the time-lapse.
 */
function BonsaiTimelapse(handle: Handle) {
	return () => {
		let t = copyOf(handle).bonsai;
		return (
			<MotionLoop
				pauseLabel={t.pause}
				placement="start-end"
				mix={[p(4), rounded("xl"), raw({ backgroundColor: "var(--wakaba-card)" }), at("md", p(8))]}
			>
				<div mix={[vstack({ gap: 5, align: "stretch" })]}>
					<div mix={[grid(), raw({ placeItems: "center" })]}>
						<div
							aria-hidden="true"
							mix={[
								gridArea("1 / 1"),
								is("full"),
								maxIs("14rem"),
								raw({
									aspectRatio: "1",
									borderRadius: "50%",
									backgroundColor: "var(--wakaba-sun)",
								}),
							]}
						/>
						{BONSAI_STAGES.map((days, index) => {
							let final = index === BONSAI_STAGES.length - 1;
							let name = `wakaba-bonsai-${index}`;
							return (
								<div
									key={days}
									data-stage={days}
									aria-hidden={final ? undefined : "true"}
									mix={[
										gridArea("1 / 1"),
										vstack({ gap: 2, align: "center" }),
										m(0),
										is("full"),
										maxIs("16rem"),
										raw({ opacity: final ? "1" : "0" }),
										keyframes(name, stageFrames(index)),
										motionSafe(
											raw({
												animationName: name,
												animationDuration: `${CYCLE}s`,
												animationTimingFunction: "linear",
												animationIterationCount: "infinite",
											}),
										),
									]}
								>
									<picture mix={[block(), is("full")]}>
										<source
											media="(prefers-color-scheme: dark)"
											srcSet={`${WAKABA_ASSETS}/bonsai/dark/${stageFile(index, days)}.webp`}
											width={480}
											height={455}
										/>
										<img
											src={`${WAKABA_ASSETS}/bonsai/light/${stageFile(index, days)}.webp`}
											alt={final ? t.grownAlt : ""}
											width={480}
											height={455}
											loading="lazy"
											decoding="async"
											mix={[block(), is("full"), raw({ blockSize: "auto" })]}
										/>
									</picture>
								</div>
							);
						})}
					</div>
					<div aria-hidden="true" mix={[vstack({ gap: 2, align: "stretch" })]}>
						<div
							mix={[
								raw({ marginInline: "5%", blockSize: "0.375rem", borderRadius: "9999px" }),
								bg(),
								raw({ overflow: "hidden" }),
							]}
						>
							<div
								mix={[
									bs("full"),
									bg("brand.solid"),
									raw({ transformOrigin: "0 50%", scale: "1 1" }),
									keyframes("wakaba-bonsai-fill", fillFrames()),
									motionSafe(
										raw({
											animationName: "wakaba-bonsai-fill",
											animationDuration: `${CYCLE}s`,
											animationTimingFunction: "linear",
											animationIterationCount: "infinite",
										}),
									),
								]}
							/>
						</div>
						<div
							mix={[
								grid(),
								gridTemplate({ columns: repeat(BONSAI_STAGES.length, "minmax(0, 1fr)") }),
								text("xs"),
								fg("neutral"),
								tabularNums(),
								raw({ textAlign: "center" }),
							]}
						>
							{BONSAI_STAGES.map((days) => (
								<span key={days}>{days}</span>
							))}
						</div>
					</div>
					<p mix={[m(0), text("xs"), fg("neutral.muted"), raw({ textAlign: "center" })]}>
						{t.timeline}
					</p>
				</div>
			</MotionLoop>
		);
	};
}

/** Friday's and Monday's practised days in the missed-weekend card, the same figures in every language. */
const PRACTISED_DAYS = ["41", "42"] as const;

/**
 * A missed weekend, Friday against Monday: the streak starts over, the practised days carry
 * on and the tree is the same tree. Sample figures, in the app's own counting.
 *
 * @returns The render function producing the card.
 */
function MissedWeekend(handle: Handle) {
	return () => {
		let t = copyOf(handle).bonsai;
		return (
			<div mix={[vstack({ gap: 4, align: "stretch" })]}>
				<div mix={[raw({ display: "flex", alignItems: "end", gap: "0.75rem" })]}>
					<Mascot pose="kitsune-wave" size="sm" tilt={-6} />
					<p mix={[m(0), font("display"), text("2xl"), weight("bold"), leading("tight")]}>
						{t.weekend.title}
					</p>
				</div>
				<p mix={[m(0), fg("neutral")]}>{t.weekend.body}</p>
				<dl
					mix={[
						grid(),
						m(0),
						gridTemplate({ columns: "auto minmax(0, 1fr) minmax(0, 1fr)" }),
						raw({ columnGap: "1rem" }),
						rounded("xl"),
						pb(2),
						pi(4),
						border({ width: 1, color: "neutral" }),
						raw({ backgroundColor: "var(--wakaba-card)" }),
						text("sm"),
						tabularNums(),
					]}
				>
					<WeekendRow label={t.weekend.rows.day} values={t.weekend.days} heading />
					<WeekendRow label={t.weekend.rows.streak} values={t.weekend.streaks} highlight />
					<WeekendRow label={t.weekend.rows.practised} values={PRACTISED_DAYS} />
					<WeekendRow label={t.weekend.rows.bonsai} values={[t.weekend.stage, t.weekend.stage]} />
				</dl>
			</div>
		);
	};
}

namespace WeekendRow {
	/** Props of one row of the missed-weekend card. */
	export interface Props {
		label: string;
		/** Friday's value, then Monday's. */
		values: ReadonlyArray<string>;
		/** Sets the row as the card's column heads, the two day names. */
		heading?: boolean;
		/** Marks Monday's value in the accent, the change the card is about. */
		highlight?: boolean;
	}
}

/**
 * One row of the missed-weekend card, laid on the card's three columns through `contents`,
 * so the labels and both days align across rows.
 *
 * @param handle Runtime handle carrying the row's label, its two values and whether it heads the card.
 * @returns The render function producing the row.
 */
function WeekendRow(handle: Handle<WeekendRow.Props>) {
	return () => {
		let { heading, highlight, label, values } = handle.props;
		return (
			<div
				mix={[
					raw({ display: "contents" }),
					when("& > *", [
						pb(2.5),
						raw({ borderBlockStart: heading ? "0" : "1px solid currentColor" }),
						raw({ borderBlockStartColor: "color-mix(in srgb, currentColor 10%, transparent)" }),
					]),
				]}
			>
				<dt mix={[fg("neutral")]}>
					{heading ? <span mix={[visuallyHidden()]}>{label}</span> : label}
				</dt>
				{values.map((value, index) => (
					<dd
						key={index}
						mix={[
							m(0),
							heading ? [fg("neutral.muted"), weight("medium")] : [weight("semibold")],
							!heading && index === 1 && highlight ? fg("brand") : [],
						]}
					>
						{value}
					</dd>
				))}
			</div>
		);
	};
}
