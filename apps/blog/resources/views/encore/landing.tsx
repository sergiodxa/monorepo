/**
 * Encore's landing at `/apps/encore`: the game shown rather than described, its cards drawn
 * with the app's own words and ornaments, the round as a tour of its screens, and the Watch
 * remote, in the app's plum-and-gold look on its own shell.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { Handle, RemixNode } from "remix/component";

import { ArrowDownIcon, CheckIcon, ChevronDownIcon } from "@sdxc/icons";
import { keyframes } from "@sdxc/u/animation";
import { fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { block, gap, grid, gridTemplate, hidden, hstack, repeat, vstack } from "@sdxc/u/layout";
import { at, motionSafe } from "@sdxc/u/responsive";
import { is, m, maxIs, mi, p, pbs, pi } from "@sdxc/u/size";
import { font, leading, text, weight } from "@sdxc/u/typography";
import { Accordion, HeadingScope, Link, LinkButton } from "@sdxc/ui";
import {
	ClosingCta,
	FaqBand,
	FeatureBand,
	LandingHeader,
	LandingHero,
	LandingSection,
} from "@sdxc/ui/landing";
import { landingCtaChrome } from "@sdxc/ui/styles";

import type { EncoreLocale } from "~/config/encore";
import type { CardId } from "~/resources/content/encore/copy";

import { ENCORE_APP_STORE_URL, inLanguage } from "~/config/encore";
import { EncoreDraw } from "~/resources/components/encore-draw";
import { EncorePageSounds } from "~/resources/components/encore-page-sounds";
import { PathAutoplay } from "~/resources/components/path-autoplay";
import { ENCORE_COPY } from "~/resources/content/encore";
import { EncoreLayout } from "~/resources/layouts/encore";
import { GuidedTour } from "~/resources/views/app-pages/guided-tour";
import { PlayingCard, sparklePath } from "~/resources/views/encore/card";
import {
	AppStoreCall,
	copyOf,
	DeckCard,
	EncoreLanguage,
	EncoreMark,
	FlipCard,
	Phone,
	Watch,
} from "~/resources/views/encore/parts";
import routes from "~/routes/web";

/** Types used by the landing's renderer. */
export namespace EncoreLandingView {
	/** Data required to render the page. */
	export interface Model {
		/** The language the page is written in. */
		locale: EncoreLocale;
	}
}

/**
 * Lays a band's heavy content out only as it nears the viewport, holding its place with an
 * estimated height so the scrollbar stays still.
 */
function nearView(height: number) {
	return raw({ contentVisibility: "auto", containIntrinsicSize: `auto ${height}px` });
}

/**
 * The page, band by band: the promise over the game's screens, a card to play, a round as a tour, the deck,
 * the Watch remote, the small things, privacy, the questions a group
 * asks first, and the download once more.
 *
 * @returns View function rendering the landing.
 */
export function EncoreLandingView() {
	return ({ model, assets }: { model: EncoreLandingView.Model; assets: DocumentAssets }) => {
		let copy = ENCORE_COPY[model.locale];
		return (
			<EncoreLayout
				assets={assets}
				locale={model.locale}
				title={copy.meta.title}
				description={copy.meta.description}
				path={routes.encore.href()}
				sparkles={64}
			>
				<EncoreLandingContent locale={model.locale} />
			</EncoreLayout>
		);
	};
}

/**
 * The landing's `main`, every band in order, apart from the document so a browser test can
 * mount the page's content alone and measure it.
 *
 * @returns The render function producing the bands.
 */
export function EncoreLandingContent(handle: Handle<{ locale?: EncoreLocale }>) {
	return () => (
		<EncoreLanguage copy={ENCORE_COPY[handle.props.locale ?? "en"]}>
			<main>
				<EncorePageSounds />
				<HeadingScope>
					<Hero />
					<YourTurn />
					<Round />
					<Deck />
					<WatchBand />
					<Details />
					<Privacy />
					<Questions />
					<Download />
				</HeadingScope>
			</main>
		</EncoreLanguage>
	);
}

/**
 * The first viewport: the campaign's promise as the `h1`, what the game is and what it costs,
 * the App Store badge, and the game on its stage.
 *
 * @returns The render function producing the hero.
 */
function Hero(handle: Handle) {
	return () => {
		let t = copyOf(handle);
		return (
			<LandingHero
				id="top"
				tone="plain"
				align="center"
				mediaPlacement="below"
				eyebrow={t.hero.eyebrow}
				title={t.hero.title}
				description={t.hero.description}
				actions={
					<span
						mix={[
							hstack({ gap: 3, align: "center", justify: "center" }),
							raw({ flexWrap: "wrap" }),
						]}
					>
						<AppStoreCall />
						<LinkButton href="#round" variant="surface" mix={[landingCtaChrome()]}>
							{t.hero.tour}
							<ArrowDownIcon size={16} aria-hidden="true" />
						</LinkButton>
					</span>
				}
				note={t.hero.note}
				media={<HeroStage />}
			/>
		);
	};
}

/** The music notes drifting up off the stage: where each starts, its size and colour. */
const NOTES = [
	{ x: 0.2, y: 0.78, size: 1.3, color: "var(--encore-coral)" },
	{ x: 0.79, y: 0.62, size: 1.1, color: "var(--encore-gold)" },
	{ x: 0.66, y: 0.9, size: 0.9, color: "var(--encore-violet)" },
] as const;

/**
 * A sparkle's slow twinkle, offset by its place in the row so no two pulse together. Only
 * for readers who allow motion; the others see the sparkles still.
 */
function twinkle(index: number) {
	return [
		keyframes("encore-twinkle", {
			"0%, 100%": { scale: "1", opacity: "1" },
			"50%": { scale: "0.55", opacity: "0.5" },
		}),
		raw({ transformBox: "fill-box", transformOrigin: "center" }),
		motionSafe(
			raw({
				animationName: "encore-twinkle",
				animationDuration: `${2.6 + (index % 3) * 0.7}s`,
				animationDelay: `${-index * 0.9}s`,
				animationTimingFunction: "ease-in-out",
				animationIterationCount: "infinite",
			}),
		),
	];
}

/**
 * A note's drift: it rises and sways a little, fading out at the top, then starts again,
 * offset by its place so the notes never move together. Hidden for readers who ask for less
 * motion, since a still note floating mid-air reads as a mistake.
 */
function floatUp(index: number) {
	return [
		keyframes("encore-note", {
			"0%": { translate: "0 0", rotate: "-8deg", opacity: "0" },
			"15%": { opacity: "0.55" },
			"70%": { opacity: "0.4" },
			"100%": { translate: "1.5rem -9rem", rotate: "10deg", opacity: "0" },
		}),
		raw({ opacity: "0", transformBox: "fill-box", transformOrigin: "center" }),
		motionSafe(
			raw({
				animationName: "encore-note",
				animationDuration: `${7 + index * 1.5}s`,
				animationDelay: `${-index * 2.4}s`,
				animationTimingFunction: "ease-out",
				animationIterationCount: "infinite",
			}),
		),
	];
}

/**
 * The game's backdrop, from the app: oversized ribbons sweeping in from both edges in violet,
 * coral and gold, and six sparkles, over the scheme's gradient and its stage-light glow.
 * Decorative; it slices to whatever the stage's shape is.
 *
 * @param handle Runtime handle, whose id keeps the gradient unique on the page.
 * @returns The render function producing the backdrop.
 */
function Backdrop(handle: Handle) {
	return () => {
		let id = `encore-backdrop-${handle.id}`;
		let w = 1000;
		let h = 640;
		let ribbons = [-1, 1].map((side) => {
			let x = (fraction: number) => w / 2 + w * fraction * side;
			return {
				key: side,
				d: `M${x(0.68)} -30 C${x(0.22)} ${h * 0.1} ${x(0.78)} ${h * 0.27} ${x(0.47)} ${h * 0.46} C${x(0.12)} ${h * 0.68} ${x(0.8)} ${h * 0.84} ${x(0.66)} ${h + 30}`,
			};
		});
		let sparkles = [
			[0.12, 0.16, 7, "var(--encore-gold)"],
			[0.88, 0.19, 5, "var(--encore-coral)"],
			[0.09, 0.68, 5, "var(--encore-violet)"],
			[0.91, 0.72, 7, "var(--encore-gold)"],
			[0.18, 0.88, 4, "var(--encore-coral)"],
			[0.82, 0.09, 4, "var(--encore-violet)"],
		] as const;
		return (
			<div
				aria-hidden="true"
				mix={[
					raw({
						position: "absolute",
						inset: "0",
						zIndex: "-1",
						background:
							"radial-gradient(closest-side, var(--encore-glow), transparent), var(--encore-backdrop)",
					}),
				]}
			>
				<svg
					viewBox={`0 0 ${w} ${h}`}
					preserveAspectRatio="xMidYMid slice"
					mix={[raw({ position: "absolute", inset: "0", inlineSize: "100%", blockSize: "100%" })]}
				>
					<defs>
						<linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
							<stop offset="0" stopColor="var(--encore-violet)" />
							<stop offset="0.5" stopColor="var(--encore-coral)" />
							<stop offset="1" stopColor="var(--encore-gold)" />
						</linearGradient>
					</defs>
					<g mix={[raw({ opacity: "var(--encore-ribbon-opacity)" })]}>
						{ribbons.map((ribbon) => (
							<path
								key={ribbon.key}
								d={ribbon.d}
								fill="none"
								stroke={`url(#${id})`}
								strokeWidth={30}
								strokeLinecap="round"
							/>
						))}
					</g>
					<g mix={[raw({ opacity: "var(--encore-sparkle-opacity)" })]}>
						{sparkles.map(([x, y, r, color], index) => (
							<path
								key={`${x}-${y}`}
								d={sparklePath(w * x, h * y, r * 1.6)}
								fill={color}
								mix={[twinkle(index)]}
							/>
						))}
					</g>
					{NOTES.map((note, index) => (
						<g
							key={note.x}
							transform={`translate(${w * note.x} ${h * note.y}) scale(${note.size})`}
						>
							<path
								d="M0 0V-22L14 -26V-6M0 0a5 4 0 1 1 -10 0a5 4 0 1 1 10 0ZM14 -6a5 4 0 1 1 -10 0a5 4 0 1 1 10 0Z"
								fill={note.color}
								stroke={note.color}
								strokeWidth={2.5}
								strokeLinejoin="round"
								mix={[floatUp(index)]}
							/>
						</g>
					))}
				</svg>
			</div>
		);
	};
}

/**
 * The hero's stage: the revealed challenge in front, the face-down card and a combined
 * challenge fanned behind it once the stage is wide enough, on the game's own backdrop; on a
 * wide stage two drawn cards, one face down and one face up, stand on either side.
 *
 * @returns The render function producing the stage.
 */
function HeroStage() {
	return () => (
		<div mix={[raw({ containerType: "inline-size", containerName: "encore-hero" }), is("full")]}>
			<div
				mix={[
					raw({
						"--phone": "min(16.5rem, 64cqi)",
						position: "relative",
						isolation: "isolate",
						overflow: "hidden",
						blockSize: "calc(var(--phone) * 1.62)",
						paddingBlockStart: "1.75rem",
						borderRadius: "2rem",
					}),
				]}
			>
				<Backdrop />
				<div mix={[hstack({ gap: 0, align: "start", justify: "center" })]}>
					<FannedPhone side="start">
						<Phone screen="card-back" eager />
					</FannedPhone>
					<div mix={[raw({ inlineSize: "var(--phone)", flexShrink: "0", zIndex: "1" })]}>
						<Phone screen="challenge" eager />
					</div>
					<FannedPhone side="end">
						<Phone screen="generated" eager />
					</FannedPhone>
				</div>
				<StageCard side="start">
					<PlayingCard faceDown />
				</StageCard>
				<StageCard side="end">
					<DeckCard card="a001" />
				</StageCard>
			</div>
		</div>
	);
}

namespace FannedPhone {
	/** Props of a phone leaning out from behind the hero's front screen. */
	export interface Props {
		side: "start" | "end";
		children: RemixNode;
	}
}

/**
 * A phone tilted out from behind the front screen, shown from the `md` stage where the three
 * fit side by side; on a phone the front screen stands alone at a readable size.
 *
 * @param handle Runtime handle carrying the side and the phone.
 * @returns The render function producing the tilted phone.
 */
function FannedPhone(handle: Handle<FannedPhone.Props>) {
	return () => {
		let start = handle.props.side === "start";
		return (
			<div
				mix={[
					hidden(),
					at(
						"md",
						"encore-hero",
						raw({
							display: "block",
							flexShrink: "0",
							inlineSize: "var(--phone)",
							marginBlockStart: "calc(var(--phone) * 0.18)",
							marginInline: start ? "0 calc(var(--phone) * -0.12)" : "calc(var(--phone) * -0.12) 0",
							scale: "0.86",
							rotate: start ? "-6deg" : "6deg",
							transformOrigin: start ? "100% 0%" : "0% 0%",
						}),
					),
				]}
			>
				{handle.props.children}
			</div>
		);
	};
}

/**
 * A drawn card standing beside the phones, tilted outward, shown only once the stage is wide
 * enough to hold it clear of the fanned screens. Decorative: the phones carry the screens.
 *
 * @param handle Runtime handle carrying the side and the card.
 * @returns The render function producing the card.
 */
function StageCard(handle: Handle<{ side: "start" | "end"; children: RemixNode }>) {
	return () => {
		let start = handle.props.side === "start";
		return (
			<div
				aria-hidden="true"
				mix={[
					raw({
						display: "none",
						position: "absolute",
						zIndex: "2",
						inlineSize: "min(12rem, 15cqi)",
						insetBlockStart: start ? "34%" : "26%",
						insetInlineStart: start ? "4%" : "auto",
						insetInlineEnd: start ? "auto" : "4%",
						rotate: start ? "-9deg" : "8deg",
						"@container encore-hero (min-width: 64rem)": { display: "block" },
					}),
				]}
			>
				{handle.props.children}
			</div>
		);
	};
}

/** The sample the playable card deals: three real cards no other band shows, never the deck. */
const SAMPLE: ReadonlyArray<CardId> = ["a024", "a008", "a090"];

/**
 * The reader's turn: three real cards, face down on the game's backdrop, to flip, sing and
 * draw again before the page explains anything else, ending on the App Store for the rest.
 *
 * @returns The render function producing the band.
 */
function YourTurn(handle: Handle) {
	return () => {
		let t = copyOf(handle);
		return (
			<LandingSection id="play" align="center">
				<LandingHeader align="center" eyebrow={t.play.eyebrow} description={t.play.description}>
					{t.play.title}
				</LandingHeader>
				<div
					mix={[
						rounded("xl"),
						raw({
							inlineSize: "100%",
							position: "relative",
							isolation: "isolate",
							overflow: "hidden",
							paddingBlock: "clamp(3.75rem, 8cqi, 5rem) clamp(1.25rem, 4cqi, 2.5rem)",
							paddingInline: "clamp(1.5rem, 6cqi, 4rem)",
						}),
					]}
				>
					<Backdrop />
					<EncoreDraw
						cards={SAMPLE.map((card) => t.cards[card])}
						store={{ href: ENCORE_APP_STORE_URL, label: t.appStore, language: t.badge }}
						labels={{
							reveal: t.deck.reveal,
							draw: t.play.draw,
							shuffle: t.play.shuffle,
							left: t.play.left,
							end: t.play.end,
						}}
					/>
				</div>
			</LandingSection>
		);
	};
}

/** The four moves of a round, each with its radio value and the screen it produces. */
const ROUND = [
	{ value: "reveal", screen: "card-back" },
	{ value: "sing", screen: "challenge" },
	{ value: "swipe", screen: "swipe" },
	{ value: "shuffle", screen: "shuffle" },
] as const;

/**
 * A round as a guided tour: tap, sing, swipe and shake, each beside its screen, the rail
 * advancing on its own while it is on screen.
 *
 * @returns The render function producing the band.
 */
function Round(handle: Handle) {
	return () => {
		let t = copyOf(handle).tour;
		return (
			<LandingSection id="round" mix={[nearView(900)]}>
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
				<GuidedTour
					name="encore-round"
					label={t.stageLabel}
					steps={ROUND.map((step, index) => ({
						value: step.value,
						title: t.steps[index]?.title ?? "",
						body: t.steps[index]?.body ?? "",
						screen: <Phone screen={step.screen} />,
					}))}
				/>
			</LandingSection>
		);
	};
}

/** The cards the deck band deals face down, hand-written ones around a combined challenge, each with its lean. */
const DECK: ReadonlyArray<{ card: CardId; tilt: number }> = [
	{ card: "a001", tilt: -3 },
	{ card: "a002", tilt: 2 },
	{ card: "a060", tilt: -1.5 },
	{ card: "generated", tilt: 3 },
	{ card: "a100", tilt: -2 },
];

/**
 * The deck: five cards face down, turning over at a tap to show a real challenge. On a phone
 * they lie in one pile whose top card flips in place, the rest staying face down beneath it;
 * on a wide band they sit in a row, each one flippable.
 *
 * @returns The render function producing the band.
 */
function Deck(handle: Handle) {
	return () => {
		let t = copyOf(handle).deck;
		return (
			<LandingSection id="deck" tone="tinted" inset mix={[nearView(760)]}>
				<LandingHeader eyebrow={t.eyebrow} description={t.description}>
					{t.title}
				</LandingHeader>
				<div mix={[raw({ containerType: "inline-size" })]}>
					<ul
						aria-label={t.listLabel}
						mix={[
							m(0),
							p(0),
							raw({
								"--card": "min(72cqi, 16rem)",
								listStyle: "none",
								display: "grid",
								justifyContent: "center",
								gridTemplateColumns: "var(--card)",
								"& > li": { gridArea: "1 / 1", position: "relative" },
								"& > li:not(:last-child)": { pointerEvents: "none" },
								"@container (min-width: 60rem)": {
									gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
									justifyContent: "stretch",
									gap: "1rem",
									"& > li": { gridArea: "auto" },
									"& > li:not(:last-child)": { pointerEvents: "auto" },
								},
							}),
						]}
					>
						{DECK.map(({ card, tilt }, index) => (
							<li
								key={card}
								mix={[
									raw({
										paddingBlock: "0.5rem",
										"@container (max-width: 59.99rem)": {
											translate: `0 ${(DECK.length - 1 - index) * -0.35}rem`,
										},
									}),
								]}
							>
								<FlipCard card={card} badge={t.generated} tilt={tilt} />
							</li>
						))}
					</ul>
				</div>
			</LandingSection>
		);
	};
}

/**
 * The Watch remote: the card ready on the wrist and the challenge revealed, beside what the
 * Watch can do and what it needs.
 *
 * @returns The render function producing the band.
 */
function WatchBand(handle: Handle) {
	return () => {
		let t = copyOf(handle).watch;
		return (
			<FeatureBand
				id="watch"
				mix={[nearView(700)]}
				layout="split"
				eyebrow={t.eyebrow}
				title={t.title}
				description={t.description}
				media={
					<div
						mix={[
							grid(),
							gap(5),
							gridTemplate({ columns: repeat(2, "minmax(0, 1fr)") }),
							maxIs("26rem"),
							mi("auto"),
							is("full"),
							raw({ alignItems: "start" }),
						]}
					>
						<Watch screen="watch-ready" />
						<div mix={[pbs(10)]}>
							<Watch screen="watch-challenge" />
						</div>
					</div>
				}
			>
				<ul>
					{t.items.map((item) => (
						<li key={item}>{item}</li>
					))}
				</ul>
			</FeatureBand>
		);
	};
}

/** The bento's nights in order, each with the real card that fits it and the block it sits on. */
const NIGHTS = [
	{ key: "karaoke", card: "a015", tint: "var(--encore-violet)", tilt: -4 },
	{ key: "road", card: "a033", tint: "var(--encore-gold)", tilt: 3 },
	{ key: "holiday", card: "a080", tint: "var(--encore-coral)", tilt: -2 },
	{ key: "abroad", card: "a104", tint: "var(--encore-pink)", tilt: 4 },
	{ key: "newYear", card: "a045", tint: "var(--encore-gold)", tilt: -3 },
	{ key: "everyone", card: "a011", tint: "var(--encore-violet)", tilt: 2 },
] as const;

/**
 * The nights as a bento: six colour blocks, each led by the real card from the deck that
 * belongs to that night, tilted as if just dealt, shown at every width.
 *
 * @returns The render function producing the band.
 */
function Details(handle: Handle) {
	return () => {
		let t = copyOf(handle).details;
		return (
			<LandingSection id="nights" mix={[nearView(1100)]}>
				<LandingHeader eyebrow={t.eyebrow} description={t.description}>
					{t.title}
				</LandingHeader>
				<ul
					mix={[
						grid(),
						gap(4),
						m(0),
						p(0),
						raw({ listStyle: "none" }),
						at("md", gridTemplate({ columns: repeat(2, "minmax(0, 1fr)") })),
						at("xl", gridTemplate({ columns: repeat(3, "minmax(0, 1fr)") })),
					]}
				>
					{NIGHTS.map((night) => (
						<li
							key={night.key}
							mix={[
								vstack({ gap: 2, align: "stretch" }),
								rounded("xl"),
								raw({
									overflow: "hidden",
									paddingBlockEnd: "1.5rem",
									background: `linear-gradient(160deg, color-mix(in srgb, ${night.tint} 22%, transparent), transparent 70%), var(--ui-landing-band-tint)`,
								}),
							]}
						>
							<div
								mix={[
									raw({
										inlineSize: "min(13rem, 70%)",
										marginInline: "auto",
										paddingBlock: "1.75rem 0.5rem",
										rotate: `${night.tilt}deg`,
									}),
								]}
							>
								<DeckCard card={night.card} />
							</div>
							<p
								mix={[
									m(0),
									pi(6),
									pbs(2),
									font("display"),
									text("xl"),
									weight("bold"),
									leading("tight"),
								]}
							>
								{t.items[night.key].title}
							</p>
							<p mix={[m(0), pi(6), text("sm"), fg("neutral"), leading("relaxed")]}>
								{t.items[night.key].body}
							</p>
						</li>
					))}
				</ul>
			</LandingSection>
		);
	};
}

/**
 * Privacy as plain facts, each one checked against the app's code, set as a centered row of
 * checked pills under the promise: no account, no microphone, no tracking, cards on the
 * device and the Watch talking straight to the phone.
 *
 * @returns The render function producing the band.
 */
function Privacy(handle: Handle) {
	return () => {
		let t = copyOf(handle);
		return (
			<LandingSection id="privacy" tone="tinted" inset align="center" mix={[nearView(520)]}>
				<LandingHeader
					align="center"
					eyebrow={t.privacy.eyebrow}
					description={
						<>
							{t.privacy.description}
							<span mix={[block(), raw({ marginBlockStart: "0.75rem" })]}>
								<Link href={inLanguage(routes.encorePrivacy.href(), t.locale)}>
									{t.privacy.policy}
								</Link>
							</span>
						</>
					}
				>
					{t.privacy.title.split("\n").map((line) => (
						<span key={line} mix={[block()]}>
							{line}
						</span>
					))}
				</LandingHeader>
				<ul
					mix={[
						hstack({ gap: 3, align: "center", justify: "center" }),
						raw({ flexWrap: "wrap", maxInlineSize: "52rem", marginInline: "auto" }),
						m(0),
						p(0),
						raw({ listStyle: "none" }),
					]}
				>
					{t.privacy.checks.map((check) => (
						<li
							key={check}
							mix={[
								hstack({ gap: 2, align: "center" }),
								rounded("full"),
								text("sm"),
								raw({
									paddingBlock: "0.5rem",
									paddingInline: "0.875rem 1rem",
									backgroundColor: "var(--app-card)",
									boxShadow: "inset 0 0 0 1px var(--ui-landing-hairline)",
								}),
							]}
						>
							<CheckIcon size={16} aria-hidden="true" mix={[raw({ color: "var(--app-accent)" })]} />
							{check}
						</li>
					))}
				</ul>
			</LandingSection>
		);
	};
}

/**
 * The questions band: two columns of disclosures on cards, each opening on its own, so a
 * phone reader who sees one list can keep several answers open at once.
 *
 * @returns The render function producing the band.
 */
function Questions(handle: Handle) {
	return () => {
		let t = copyOf(handle);
		return (
			<FaqBand id="faq" columns={2} eyebrow={t.faq.eyebrow} title={t.faq.title}>
				{t.faq.columns.map((column, index) => (
					<Accordion
						key={index}
						mix={[
							vstack({ gap: 3, align: "stretch" }),
							raw({ borderBlockStartWidth: "0" }),
							index > 0
								? raw({
										paddingBlockStart: "0.75rem",
										"@container ui-landing-faq (min-width: 64rem)": { paddingBlockStart: "0" },
									})
								: [],
						]}
					>
						{column.map(([question, answer]) => (
							<Accordion.Item
								key={question}
								mix={[
									raw({ paddingInline: "1.25rem", backgroundColor: "var(--app-card)" }),
									rounded("xl"),
								]}
							>
								<Accordion.Trigger>
									{question}
									<ChevronDownIcon data-slot="icon" aria-hidden="true" />
								</Accordion.Trigger>
								<Accordion.Content>
									<p>{answer}</p>
								</Accordion.Content>
							</Accordion.Item>
						))}
					</Accordion>
				))}
			</FaqBand>
		);
	};
}

/**
 * The closing call: the app's burst over the campaign's last line and the same badge as the
 * hero, with the way to support.
 *
 * @returns The render function producing the band.
 */
function Download(handle: Handle) {
	return () => {
		let t = copyOf(handle);
		return (
			<ClosingCta
				id="download"
				spacing="compact"
				eyebrow={
					<span mix={[raw({ display: "inline-flex", color: "var(--encore-gold-ink)" })]}>
						<EncoreMark size={44} />
					</span>
				}
				title={t.closing.title}
				description={t.closing.description}
				actions={
					<span mix={[vstack({ gap: 4, align: "center" })]}>
						<AppStoreCall />
						<Link href={inLanguage(routes.encoreSupport.index.href(), t.locale)} mix={[text("sm")]}>
							{t.closing.support}
						</Link>
					</span>
				}
			/>
		);
	};
}
