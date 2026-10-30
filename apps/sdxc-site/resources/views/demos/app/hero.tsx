/**
 * Rooftree's first viewport: the claim and the store badges beside a phone on today's
 * screen, slow rings turning behind it, and the rating under the badges. The press
 * marks and figures follow in the proof strip directly under it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { StarIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { text, weight } from "@sdxc/u/typography";
import { LogoCloud, StatStrip } from "@sdxc/ui";
import { AccentText, LandingHero, ProofStrip } from "@sdxc/ui/patterns";
import { marketingSlowSpin } from "@sdxc/ui/styles";

import { Masthead, MASTHEADS } from "~/resources/views/demos/app/brand";
import { Initials } from "~/resources/views/demos/app/phone";
import { TodayScreen } from "~/resources/views/demos/app/screens";
import { StoreBadges } from "~/resources/views/demos/app/store-badges";

/** The rings' radii, innermost first, in the backdrop's 800-unit box. */
const RING_RADII = [170, 240, 310, 380] as const;

/**
 * The hero band: claim, lead, badges, the free-plan note and the rating on the copy side,
 * today's screen on the media side.
 *
 * @returns The render function producing the hero.
 */
export function Hero() {
	return () => (
		<LandingHero
			id="top"
			tone="plain"
			mediaPlacement="end"
			eyebrow="New: meal plans that fill the grocery list"
			eyebrowHref="#features"
			title={
				<>
					Run the whole household from <AccentText>one list</AccentText>
				</>
			}
			description={
				<>
					Groceries, chores, the family calendar and tonight's dinner, shared by everyone under your
					roof. <strong>A tick on one phone shows on every phone in under a second.</strong>
				</>
			}
			actions={<StoreBadges />}
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
			backdrop={<HeroRings />}
			media={<TodayScreen />}
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
		<div mix={[hstack({ gap: 3, align: "center" })]}>
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
					mix={[hstack({ gap: 0.5, align: "center" }), raw({ color: "oklch(0.8 0.15 80)" })]}
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
 * Concentric rings with one brand arc each, turning slowly behind the phone; the turn
 * stops under reduced motion, and the hero hides the drawing from assistive technology.
 *
 * @returns The render function producing the rings.
 */
function HeroRings() {
	return () => (
		<svg
			viewBox="0 0 800 800"
			mix={[
				marketingSlowSpin(),
				raw({
					inlineSize: "min(48rem, 150%)",
					blockSize: "auto",
					maskImage: "radial-gradient(closest-side, black 70%, transparent)",
				}),
			]}
		>
			<defs>
				<linearGradient id="rooftree-ring-arc" x1="0" y1="0" x2="1" y2="1">
					<stop offset="0" stop-color="var(--ui-color-brand-400)" />
					<stop offset="1" stop-color="var(--ui-color-brand-400)" stop-opacity="0" />
				</linearGradient>
			</defs>
			{RING_RADII.map((radius, index) => (
				<g key={radius}>
					<circle
						cx="400"
						cy="400"
						r={radius}
						fill="none"
						stroke="var(--ui-neutral-fg-emphasis)"
						stroke-opacity="0.09"
					/>
					<circle
						cx="400"
						cy="400"
						r={radius}
						fill="none"
						stroke="url(#rooftree-ring-arc)"
						stroke-width="3"
						stroke-linecap="round"
						stroke-dasharray={`${radius * 1.1} ${radius * 7}`}
						transform={`rotate(${index * 80} 400 400)`}
					/>
				</g>
			))}
		</svg>
	);
}

/**
 * The proof strip under the hero: the invented outlets that reviewed Rooftree, then the
 * four figures a download decision weighs.
 *
 * @returns The render function producing the strip.
 */
export function Proof() {
	return () => (
		<ProofStrip tone="tinted">
			<LogoCloud layout="spread" label="As written about in" muted>
				{MASTHEADS.map((mark) => (
					<Masthead key={mark.name} {...mark} />
				))}
			</LogoCloud>
			<StatStrip>
				<StatStrip.Item label="App Store rating">4.9</StatStrip.Item>
				<StatStrip.Item label="Households sharing a list">1.2M</StatStrip.Item>
				<StatStrip.Item label="Items ticked off last month">38M</StatStrip.Item>
				<StatStrip.Item label="Median sync between phones">0.4s</StatStrip.Item>
			</StatStrip>
		</ProofStrip>
	);
}
