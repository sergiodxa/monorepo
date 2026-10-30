/**
 * Rooftree's first viewport: a centered claim over the store badges and the rating, then
 * three phones fanned on a sunny colour block with live notifications drifting beside
 * them, and the press mastheads scrolling past in a marquee to close the band.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { CheckIcon, RepeatIcon, StarIcon } from "@sdxc/icons";
import { keyframes } from "@sdxc/u/animation";
import { fg } from "@sdxc/u/color";
import { combine, raw } from "@sdxc/u/general";
import { container, hstack, vstack } from "@sdxc/u/layout";
import { at, dark, motionSafe } from "@sdxc/u/responsive";
import { leading, text, weight } from "@sdxc/u/typography";
import { LogoCloud } from "@sdxc/ui";
import { AccentText, LandingHero, MotionLoop } from "@sdxc/ui/patterns";

import { Masthead, MASTHEADS } from "~/resources/views/demos/app/brand";
import { Initials } from "~/resources/views/demos/app/phone";
import { ChoresScreen, MealsScreen, TodayScreen } from "~/resources/views/demos/app/screens";
import { StoreBadges } from "~/resources/views/demos/app/store-badges";

/** Container the phone stage sizes its phones and notifications against. */
const STAGE = "rooftree-hero-stage";

/** Keyframes the drifting notifications bob on. */
const DRIFT_KEYFRAMES = "rooftree-hero-drift";

/**
 * The hero band: pill eyebrow, claim, lead, badges, the free-plan note and the rating,
 * centered over the phone stage.
 *
 * @returns The render function producing the hero.
 */
export function Hero() {
	return () => (
		<LandingHero
			id="top"
			tone="plain"
			align="center"
			mediaPlacement="below"
			entrance
			eyebrow="New: meal plans that fill the grocery list"
			eyebrowVariant="pill"
			eyebrowHref="#features"
			title={
				<>
					The whole household, on <AccentText variant="highlight">one list</AccentText>
				</>
			}
			description={
				<>
					Groceries, chores, the family calendar and tonight's dinner, shared by everyone under your
					roof. <strong>A tick on one phone shows on every phone in under a second.</strong>
				</>
			}
			actions={<StoreBadges align="center" />}
			note={
				<>
					Free for up to four people. Also on{" "}
					<a href="#platforms" mix={[fg("neutral.emphasis"), weight("medium")]}>
						Mac, Windows and the web
					</a>
					.
				</>
			}
			proof={<RatingProof />}
			media={<PhoneStage />}
			below={<PressMarquee />}
		/>
	);
}

/**
 * The rating under the badges: four household faces, five stars and the review count,
 * the proof a store page leads with.
 *
 * @returns The render function producing the rating row.
 */
function RatingProof() {
	return () => (
		<div mix={[hstack({ gap: 3, align: "center", justify: "center" })]}>
			<span mix={[hstack({ gap: 0, align: "center" }), raw({ paddingInlineStart: "0.375rem" })]}>
				{(["maya", "jonah", "ari", "leo"] as const).map((person) => (
					<span
						key={person}
						mix={[
							raw({
								marginInlineStart: "-0.375rem",
								display: "inline-flex",
								borderRadius: "9999px",
								boxShadow: "0 0 0 2px var(--ui-bg)",
							}),
						]}
					>
						<Initials person={person} size={2} />
					</span>
				))}
			</span>
			<span mix={[vstack({ gap: 0.5, align: "start" })]}>
				<span
					role="img"
					aria-label="Rated 4.9 out of 5"
					mix={[hstack({ gap: 0.5, align: "center" }), raw({ color: "oklch(0.78 0.16 80)" })]}
				>
					{[1, 2, 3, 4, 5].map((star) => (
						<StarIcon key={star} size={15} fill="currentColor" strokeWidth={0} />
					))}
				</span>
				<span mix={[text("sm"), fg("neutral")]}>
					<strong mix={[fg("neutral.emphasis"), weight("semibold")]}>4.9</strong> from 38,000
					reviews
				</span>
			</span>
		</div>
	);
}

/**
 * The colour block the phones stand in: sunshine in light, deep grape in dark, cropped
 * at the bottom so the phones read as rising out of it. Today's screen leads in the
 * middle; the rota and the meal plan fan out behind it once the stage is wide enough.
 *
 * @returns The render function producing the stage.
 */
function PhoneStage() {
	return () => (
		<div mix={[container(STAGE), raw({ inlineSize: "100%", textAlign: "start" })]}>
			<div
				mix={[
					raw({
						"--phone": "min(17.5rem, 80cqi)",
						position: "relative",
						isolation: "isolate",
						overflow: "hidden",
						blockSize: "calc(var(--phone) * 1.5 + clamp(2.5rem, 7cqi, 4.5rem))",
						paddingBlockStart: "clamp(2.5rem, 7cqi, 4.5rem)",
						borderRadius: "var(--ui-marketing-band-radius, 2rem)",
						backgroundColor: "oklch(0.9 0.13 92)",
						backgroundImage: [
							"radial-gradient(circle at 50% 62%, oklch(1 0 0 / 0.55) 0 calc(var(--phone) * 0.78), transparent calc(var(--phone) * 0.78 + 1px))",
							"linear-gradient(170deg, oklch(0.94 0.1 98), oklch(0.86 0.15 82))",
						].join(", "),
					}),
					dark(
						raw({
							backgroundColor: "var(--ui-color-brand-900)",
							backgroundImage: [
								"radial-gradient(circle at 50% 62%, oklch(1 0 0 / 0.06) 0 calc(var(--phone) * 0.78), transparent calc(var(--phone) * 0.78 + 1px))",
								"linear-gradient(170deg, var(--ui-color-brand-800), var(--ui-color-brand-950))",
							].join(", "),
						}),
					),
				]}
			>
				<div mix={[hstack({ gap: 0, align: "start", justify: "center" })]}>
					<FannedPhone side="start">
						<ChoresScreen staged={false} />
					</FannedPhone>
					<div mix={[raw({ inlineSize: "var(--phone)", flexShrink: "0", zIndex: "1" })]}>
						<TodayScreen />
					</div>
					<FannedPhone side="end">
						<MealsScreen staged={false} />
					</FannedPhone>
				</div>
				<MotionLoop
					pauseLabel="Pause the drifting notifications"
					mix={[
						combine([
							raw({ display: "none" }),
							at(
								"xl",
								STAGE,
								raw({ display: "block", position: "absolute", inset: "0", zIndex: "2" }),
							),
						]),
					]}
				>
					<Notification
						side="start"
						icon={<CheckIcon size={14} strokeWidth={3} />}
						title="Oat milk"
						detail="Ticked off by Jonah · just now"
						person="jonah"
					/>
					<Notification
						side="end"
						icon={<RepeatIcon size={14} strokeWidth={2.5} />}
						title="Your turn: recycling"
						detail="Leo passed it on · bins out by 8"
						person="leo"
					/>
				</MotionLoop>
			</div>
		</div>
	);
}

namespace FannedPhone {
	/** Props of a phone fanned out behind the leading one. */
	export interface Props {
		/** Which side of the leading phone it leans out from. */
		side: "start" | "end";
		/** The screen. */
		children: RemixNode;
	}
}

/**
 * A phone tilted out from behind today's screen, scaled down whole so its screen keeps
 * the leading phone's layout; it appears from the `md` stage, bleeding off the block's
 * edges until the stage is wide enough to hold all three.
 *
 * @param handle Runtime handle carrying the side and the screen.
 * @returns The render function producing the tilted phone.
 */
function FannedPhone(handle: Handle<FannedPhone.Props>) {
	return () => {
		let isStart = handle.props.side === "start";
		return (
			<div
				aria-hidden="true"
				mix={[
					combine([
						raw({ display: "none" }),
						at(
							"md",
							STAGE,
							raw({
								display: "block",
								flexShrink: "0",
								inlineSize: "var(--phone)",
								marginBlockStart: "calc(var(--phone) * 0.16)",
								marginInline: isStart
									? "0 calc(var(--phone) * -0.1)"
									: "calc(var(--phone) * -0.1) 0",
								scale: "0.86",
								rotate: isStart ? "-7deg" : "7deg",
								transformOrigin: isStart ? "100% 0%" : "0% 0%",
								filter: "saturate(0.9)",
							}),
						),
					]),
				]}
			>
				{handle.props.children}
			</div>
		);
	};
}

namespace Notification {
	/** Props of one drifting notification. */
	export interface Props {
		/** Which edge of the stage it floats beside. */
		side: "start" | "end";
		/** The glyph on the brand chip. */
		icon: RemixNode;
		/** The notification's first line. */
		title: string;
		/** The muted second line. */
		detail: string;
		/** Who it came from. */
		person: "maya" | "jonah" | "ari" | "leo";
	}
}

/**
 * A notification card drifting beside the phones, the live sync the lead promises shown
 * as it arrives; it bobs only for visitors who allow motion, inside the overlay that
 * appears from the `xl` stage, where it clears the phones and the toggle can pause it.
 *
 * @param handle Runtime handle carrying the side, glyph, copy and sender.
 * @returns The render function producing the card.
 */
function Notification(handle: Handle<Notification.Props>) {
	return () => {
		let { detail, icon, person, side, title } = handle.props;
		let isStart = side === "start";
		return (
			<div
				aria-hidden="true"
				mix={[
					keyframes(DRIFT_KEYFRAMES, {
						"0%, 100%": { translate: "0 0" },
						"50%": { translate: "0 -0.5rem" },
					}),
					raw({
						position: "absolute",
						insetBlockStart: isStart ? "34%" : "56%",
						insetInlineStart: isStart ? "4%" : "auto",
						insetInlineEnd: isStart ? "auto" : "4%",
					}),
					hstack({ gap: 3, align: "center" }),
					raw({
						inlineSize: "max-content",
						maxInlineSize: "20rem",
						padding: "0.75rem 1rem 0.75rem 0.75rem",
						borderRadius: "1.25rem",
						backgroundColor: "var(--ui-surface-raised)",
						boxShadow: "var(--ui-shadow-stage)",
					}),
					motionSafe(
						raw({
							animationName: DRIFT_KEYFRAMES,
							animationDuration: "6s",
							animationTimingFunction: "ease-in-out",
							animationIterationCount: "infinite",
							animationDelay: isStart ? "0s" : "-3s",
						}),
					),
				]}
			>
				<span
					mix={[
						raw({
							display: "inline-grid",
							placeItems: "center",
							flexShrink: "0",
							inlineSize: "2.25rem",
							blockSize: "2.25rem",
							borderRadius: "0.75rem",
							color: "white",
							backgroundColor: "var(--ui-brand-bg-solid)",
						}),
					]}
				>
					{icon}
				</span>
				<span mix={[vstack({ gap: 0, align: "start" }), raw({ flex: "1", minInlineSize: "0" })]}>
					<span mix={[text("sm"), weight("semibold"), fg("neutral.emphasis"), leading("snug")]}>
						{title}
					</span>
					<span mix={[text("xs"), fg("neutral.muted")]}>{detail}</span>
				</span>
				<Initials person={person} size={1.75} />
			</div>
		);
	};
}

/**
 * The press line closing the hero: the invented outlets that reviewed Rooftree, scrolling
 * past slowly and holding still as a wrapped row for visitors who ask for less motion.
 *
 * @returns The render function producing the marquee.
 */
function PressMarquee() {
	return () => (
		<div
			mix={[raw({ inlineSize: "100%", paddingBlockStart: "clamp(3rem, 2.5rem + 2cqi, 4.5rem)" })]}
		>
			<LogoCloud layout="marquee" label="As written about in" muted>
				{MASTHEADS.map((mark) => (
					<Masthead key={mark.name} {...mark} />
				))}
			</LogoCloud>
		</div>
	);
}
