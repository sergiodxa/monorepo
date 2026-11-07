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

import { ArrowDownIcon, ChevronDownIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { gap, grid, gridTemplate, hidden, hstack, repeat, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { is, m, maxIs, mi, p, pbs, pi } from "@sdxc/u/size";
import { font, leading, text, weight } from "@sdxc/u/typography";
import { Accordion, HeadingScope, Link, LinkButton } from "@sdxc/ui";
import {
	CheckList,
	CheckRow,
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

import { inLanguage } from "~/config/encore";
import { PathAutoplay } from "~/resources/components/path-autoplay";
import { ENCORE_COPY } from "~/resources/content/encore";
import { EncoreLayout } from "~/resources/layouts/encore";
import { GuidedTour } from "~/resources/views/app-pages/guided-tour";
import { Swipeable } from "~/resources/views/app-pages/swipeable";
import {
	AppStoreCall,
	copyOf,
	EncoreLanguage,
	EncoreMark,
	Phone,
	PlayingCard,
	sparklePath,
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
 * The page, band by band: the promise over the game's screens, a round as a tour, the deck,
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
				<HeadingScope>
					<Hero />
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
						{sparkles.map(([x, y, r, color]) => (
							<path key={`${x}-${y}`} d={sparklePath(w * x, h * y, r * 1.6)} fill={color} />
						))}
					</g>
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
						borderRadius: "2rem 2rem 0 0",
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
					<PlayingCard card="a001" />
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

/** The cards the deck band lays out, hand-written ones around a combined challenge. */
const DECK: ReadonlyArray<CardId> = ["a001", "a002", "a060", "generated", "a100"];

/**
 * The deck: five cards drawn as the app draws them, in the page's language, in a row that
 * scrolls sideways on a phone and sits whole on a wide band.
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
				<Swipeable
					label={t.listLabel}
					column="min(70cqi, 16rem)"
					fitsFrom="60rem"
					fitColumn="minmax(0, 1fr)"
				>
					{DECK.map((card) => (
						<li key={card} mix={[raw({ minInlineSize: "0", paddingBlock: "0.5rem" })]}>
							<PlayingCard card={card} badge={t.generated} />
						</li>
					))}
				</Swipeable>
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

/** A keyboard key as macOS draws it in a menu or a key cap. */
function Key(handle: Handle<{ children: RemixNode }>) {
	return () => (
		<kbd
			mix={[
				raw({
					display: "inline-flex",
					alignItems: "center",
					justifyContent: "center",
					minInlineSize: "2.25rem",
					blockSize: "2.25rem",
					paddingInline: "0.5rem",
					borderRadius: "0.5rem",
					fontFamily: "var(--ui-font-sans)",
					fontSize: "1rem",
					fontWeight: "600",
					background: "var(--app-card)",
					boxShadow: "0 0 0 1px var(--ui-landing-hairline), 0 2px 0 var(--ui-landing-hairline)",
				}),
			]}
		>
			{handle.props.children}
		</kbd>
	);
}

/** A switch in the Settings app, drawn off, as both of Encore's start. */
function SettingsRow(handle: Handle<{ label: string }>) {
	return () => (
		<span mix={[hstack({ gap: 3, align: "center", justify: "between" }), text("sm")]}>
			{handle.props.label}
			<span
				aria-hidden="true"
				mix={[
					raw({
						inlineSize: "2.5rem",
						blockSize: "1.5rem",
						flexShrink: "0",
						borderRadius: "9999px",
						background: "color-mix(in srgb, currentColor 18%, transparent)",
						position: "relative",
						"&::after": {
							content: '""',
							position: "absolute",
							insetBlockStart: "2px",
							insetInlineStart: "2px",
							inlineSize: "1.25rem",
							blockSize: "1.25rem",
							borderRadius: "50%",
							background: "white",
							boxShadow: "0 1px 2px rgb(0 0 0 / 0.25)",
						},
					}),
				]}
			/>
		</span>
	);
}

/** The bento's cells in order, each naming the scene that shows it. */
const DETAILS = ["mac", "ipad", "languages", "undo", "feedback", "access"] as const;

/**
 * The scene leading one bento cell: the Game menu's shortcut, an iPad turned on its side,
 * the same card in each language, the undo shortcut, the two Settings switches, and the
 * VoiceOver label of a face-down card. Every word in it is the app's own.
 *
 * @param handle Runtime handle carrying which cell the scene leads.
 * @returns The render function producing the scene.
 */
function DetailScene(handle: Handle<{ detail: (typeof DETAILS)[number] }>) {
	return () => {
		let t = copyOf(handle);
		let app = t.details.app;
		let frame = [
			vstack({ gap: 2, align: "stretch" }),
			p(4),
			rounded("lg"),
			raw({ minBlockSize: "8.5rem", justifyContent: "center", background: "var(--app-card)" }),
		];
		switch (handle.props.detail) {
			case "mac":
				return (
					<div mix={frame}>
						<span mix={[text("xs"), weight("semibold"), fg("neutral")]}>{app.game}</span>
						<span mix={[hstack({ gap: 3, align: "center", justify: "between" })]}>
							<span mix={[text("sm"), weight("medium")]}>{app.shuffleDeck}</span>
							<span mix={[hstack({ gap: 1, align: "center" })]}>
								<Key>⌘</Key>
								<Key>R</Key>
							</span>
						</span>
					</div>
				);
			case "ipad":
				return (
					<div mix={[...frame, raw({ alignItems: "center" })]}>
						<div
							aria-hidden="true"
							mix={[
								raw({
									inlineSize: "9rem",
									aspectRatio: "4 / 3",
									padding: "0.375rem",
									borderRadius: "0.875rem",
									background: "var(--app-bezel)",
								}),
							]}
						>
							<div
								mix={[
									raw({
										blockSize: "100%",
										borderRadius: "0.5rem",
										background: "var(--encore-backdrop)",
										display: "grid",
										placeItems: "center",
									}),
								]}
							>
								<div mix={[raw({ inlineSize: "2.6rem" })]}>
									<PlayingCard faceDown />
								</div>
							</div>
						</div>
					</div>
				);
			case "languages":
				return (
					<ul
						mix={[
							...frame,
							m(0),
							raw({ listStyle: "none", fontFamily: "var(--encore-font-card)" }),
						]}
					>
						{(["en", "es-AR", "ja"] as const).map((language) => (
							<li key={language} lang={language} mix={[text("sm"), leading("snug")]}>
								{ENCORE_COPY[language].cards.a001.prompt}
							</li>
						))}
					</ul>
				);
			case "undo":
				return (
					<div mix={frame}>
						<span mix={[text("xs"), weight("semibold"), fg("neutral")]}>{app.previousCard}</span>
						<span mix={[hstack({ gap: 1, align: "center" })]}>
							<Key>⌘</Key>
							<Key>Z</Key>
						</span>
					</div>
				);
			case "feedback":
				return (
					<div mix={frame}>
						<span mix={[text("xs"), weight("semibold"), fg("neutral")]}>{app.feedback}</span>
						<SettingsRow label={app.haptics} />
						<SettingsRow label={app.sounds} />
					</div>
				);
			case "access":
				return (
					<div mix={[...frame, raw({ alignItems: "start" })]}>
						<span
							mix={[
								text("sm"),
								rounded("md"),
								raw({
									padding: "0.5rem 0.75rem",
									background: "color-mix(in srgb, var(--encore-violet) 14%, transparent)",
									boxShadow:
										"inset 0 0 0 2px color-mix(in srgb, var(--encore-violet) 60%, transparent)",
								}),
							]}
						>
							“{app.faceDown}”
						</span>
					</div>
				);
		}
	};
}

/**
 * The small things as a bento: six cells, each led by a small scene drawn with the app's own
 * labels, shown at every width so a phone reader sees them too.
 *
 * @returns The render function producing the band.
 */
function Details(handle: Handle) {
	return () => {
		let t = copyOf(handle).details;
		return (
			<LandingSection id="details" mix={[nearView(900)]}>
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
					{DETAILS.map((detail) => (
						<li
							key={detail}
							mix={[
								vstack({ gap: 2, align: "stretch" }),
								p(3),
								raw({ paddingBlockEnd: "1.5rem" }),
								rounded("xl"),
								raw({ background: "var(--ui-landing-band-tint)" }),
							]}
						>
							<DetailScene detail={detail} />
							<p
								mix={[
									m(0),
									pi(3),
									pbs(2),
									font("display"),
									text("xl"),
									weight("bold"),
									leading("tight"),
								]}
							>
								{t.items[detail].title}
							</p>
							<p mix={[m(0), pi(3), text("sm"), fg("neutral"), leading("relaxed")]}>
								{t.items[detail].body}
							</p>
						</li>
					))}
				</ul>
			</LandingSection>
		);
	};
}

/**
 * Privacy as plain facts, each one checked against the app's code: no account, no microphone,
 * no tracking, cards on the device and the Watch talking straight to the phone.
 *
 * @returns The render function producing the band.
 */
function Privacy(handle: Handle) {
	return () => {
		let t = copyOf(handle);
		return (
			<LandingSection id="privacy" tone="tinted" inset mix={[nearView(520)]}>
				<div
					mix={[
						grid(),
						gap(8),
						raw({
							alignItems: "center",
							"@container (min-width: 56rem)": {
								gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
							},
						}),
					]}
				>
					<LandingHeader
						eyebrow={t.privacy.eyebrow}
						description={
							<>
								{t.privacy.description}{" "}
								<Link href={inLanguage(routes.encorePrivacy.href(), t.locale)}>
									{t.privacy.policy}
								</Link>
							</>
						}
					>
						{t.privacy.title}
					</LandingHeader>
					<div
						mix={[p(6), rounded("xl"), raw({ backgroundColor: "var(--app-card)" }), at("md", p(8))]}
					>
						<CheckList>
							{t.privacy.checks.map((check) => (
								<CheckRow key={check}>{check}</CheckRow>
							))}
						</CheckList>
					</div>
				</div>
			</LandingSection>
		);
	};
}

/**
 * The questions band: two columns of disclosures on cards, one open at a time per column.
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
								name={`encore-faq-${index}`}
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
