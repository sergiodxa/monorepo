/**
 * Wakaba's landing at `/apps/wakaba`: the app shown rather than described, in real screens
 * framed as phones, its four companions, the bonsai that grows with practice and the widgets,
 * in the app's cream-and-vermilion look on its own shell.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { Handle, RemixNode } from "remix/component";

import { ArrowDownIcon, ChevronDownIcon } from "@sdxc/icons";
import { keyframes } from "@sdxc/u/animation";
import { fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import {
	block,
	container,
	gap,
	grid,
	gridTemplate,
	hidden,
	hstack,
	repeat,
	shrink,
	vstack,
} from "@sdxc/u/layout";
import { at, motionSafe } from "@sdxc/u/responsive";
import { is, m, maxIs, mi, p, pbe, pbs, pi } from "@sdxc/u/size";
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
	MotionLoop,
} from "@sdxc/ui/landing";
import { landingCtaChrome } from "@sdxc/ui/styles";

import type { PageLocale } from "~/app/services/page-locale";
import type { MascotPose } from "~/resources/views/wakaba/parts";

import { inLanguage } from "~/resources/content/wakaba/pages";
import { WakabaLayout } from "~/resources/layouts/wakaba";
import { BonsaiBand } from "~/resources/views/wakaba/bonsai";
import {
	AppStoreCall,
	copyOf,
	Mascot,
	Phone,
	WAKABA_ASSETS,
	WAKABA_COPY,
	WakabaLanguage,
} from "~/resources/views/wakaba/parts";
import { PathBand, Swipeable } from "~/resources/views/wakaba/path";
import routes from "~/routes/web";

/** Types used by the landing's renderer. */
export namespace WakabaLandingView {
	/** Data required to render the page. */
	export interface Model {
		/** The language the page is written in. */
		locale: PageLocale;
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
 * The page, band by band: the promise over three real screens, a tour of the path, the
 * companions, the flashcards, the exercises, kana tracing, the bonsai, the widgets, privacy,
 * the questions a learner asks first, and the download once more.
 *
 * @returns View function rendering the landing.
 */
export function WakabaLandingView() {
	return ({ model, assets }: { model: WakabaLandingView.Model; assets: DocumentAssets }) => {
		let copy = WAKABA_COPY[model.locale];
		return (
			<WakabaLayout
				assets={assets}
				copy={copy}
				bilingual
				title={copy.meta.title}
				description={copy.meta.description}
				path={routes.wakaba.href()}
			>
				<WakabaLandingContent locale={model.locale} />
			</WakabaLayout>
		);
	};
}

/**
 * The landing's `main`, every band in order, apart from the document so a browser test can
 * mount the page's content alone and measure it.
 *
 * @returns The render function producing the bands.
 */
export function WakabaLandingContent(handle: Handle<{ locale?: PageLocale }>) {
	return () => (
		<WakabaLanguage copy={WAKABA_COPY[handle.props.locale ?? "en"]}>
			<main>
				<HeadingScope>
					<Hero />
					<PathBand />
					<Companions />
					<Flashcards />
					<Exercises />
					<KanaTracing />
					<Details />
					<BonsaiBand />
					<Widgets />
					<Privacy />
					<Questions />
					<Download />
				</HeadingScope>
			</main>
		</WakabaLanguage>
	);
}

/**
 * The first viewport: the tagline as the `h1`, who the app is for and what it holds, the App
 * Store call, and three real screens rising out of a vermilion sun.
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
						<LinkButton href="#bonsai" variant="surface" mix={[landingCtaChrome()]}>
							{t.hero.watch}
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
 * A slow vertical drift for something floating in the hero, offset by `delay` so neighbours
 * never move together. It runs only for readers who allow motion.
 */
function drift(delay: string) {
	let name = "wakaba-drift";
	return [
		keyframes(name, {
			"0%, 100%": { translate: "0 0" },
			"50%": { translate: "0 -0.5rem" },
		}),
		motionSafe(
			raw({
				animationName: name,
				animationDuration: "6s",
				animationTimingFunction: "ease-in-out",
				animationIterationCount: "infinite",
				animationDelay: delay,
			}),
		),
	];
}

/**
 * The hero's picture: the learning path in front, a flashcard and a practice question fanned
 * behind it once the stage is wide enough, all real screens, over a vermilion sun cropped by
 * the stage's lower edge, with Kitsune and Tanuki beside them. On a wide stage the two
 * widgets' content floats past, paused by the frame's toggle.
 *
 * @returns The render function producing the stage.
 */
function HeroStage(handle: Handle) {
	return () => {
		let t = copyOf(handle).hero;
		return (
			<div mix={[container("wakaba-hero"), is("full"), raw({ marginBlockStart: "-1.5rem" })]}>
				<MotionLoop
					pauseLabel={t.pause}
					mix={[
						raw({
							"--phone": "min(16.5rem, 64cqi)",
							position: "relative",
							isolation: "isolate",
							overflow: "hidden",
							blockSize: "calc(var(--phone) * 1.62)",
							paddingBlockStart: "0.75rem",
							borderRadius: "2rem 2rem 0 0",
						}),
					]}
				>
					<div
						aria-hidden="true"
						mix={[
							raw({
								position: "absolute",
								zIndex: "-1",
								insetInline: "0",
								marginInline: "auto",
								insetBlockStart: "calc(var(--phone) * 0.2)",
								inlineSize: "min(100%, calc(var(--phone) * 2.6))",
								aspectRatio: "1",
								borderRadius: "50%",
								backgroundColor: "var(--wakaba-sun)",
							}),
						]}
					/>
					<div mix={[hstack({ gap: 0, align: "start", justify: "center" })]}>
						<FannedPhone side="start">
							<Phone screen="flashcards-fish" eager />
						</FannedPhone>
						<div mix={[raw({ inlineSize: "var(--phone)", flexShrink: "0", zIndex: "1" })]}>
							<Phone screen="path-kitsune" eager />
						</div>
						<FannedPhone side="end">
							<Phone screen="practice" eager />
						</FannedPhone>
					</div>
					<div
						mix={[
							raw({
								position: "absolute",
								zIndex: "2",
								insetBlockEnd: "-0.5rem",
								insetInlineStart:
									"max(0rem, calc(50% - var(--phone) * 0.5 - min(9rem, 27cqi) * 0.72))",
								inlineSize: "min(9rem, 27cqi)",
							}),
						]}
					>
						<Mascot pose="kitsune-pointing" size="fill" tilt={-4} />
					</div>
					<div
						mix={[
							raw({
								position: "absolute",
								zIndex: "2",
								insetBlockEnd: "-0.5rem",
								insetInlineEnd:
									"max(0rem, calc(50% - var(--phone) * 0.5 - min(8rem, 24cqi) * 0.72))",
								inlineSize: "min(8rem, 24cqi)",
							}),
						]}
					>
						<Mascot pose="tanuki-wave" size="fill" tilt={5} />
					</div>
					<FloatingCard side="start">
						<picture mix={[block(), shrink(0), raw({ inlineSize: "2.75rem" })]}>
							<source
								media="(prefers-color-scheme: dark)"
								srcSet={`${WAKABA_ASSETS}/bonsai/dark/05-day-030.webp`}
								width={480}
								height={455}
							/>
							<img
								src={`${WAKABA_ASSETS}/bonsai/light/05-day-030.webp`}
								alt=""
								width={480}
								height={455}
								mix={[block(), is("full"), raw({ blockSize: "auto" })]}
							/>
						</picture>
						<span mix={[vstack({ gap: 0, align: "start" })]}>
							<span mix={[text("sm"), weight("semibold"), leading("snug")]}>{t.streak.title}</span>
							<span mix={[text("xs"), fg("neutral")]}>{t.streak.detail}</span>
						</span>
					</FloatingCard>
					<FloatingCard side="end">
						<span lang="ja" mix={[font("serif"), text("3xl"), fg("brand"), leading("none")]}>
							機
						</span>
						<span mix={[vstack({ gap: 0, align: "start" })]}>
							<span mix={[text("xs"), weight("semibold"), fg("brand")]}>{t.word.label}</span>
							<span mix={[text("sm"), weight("semibold"), leading("snug")]}>{t.word.reading}</span>
						</span>
					</FloatingCard>
				</MotionLoop>
			</div>
		);
	};
}

namespace FloatingCard {
	/** Props of a card floating beside the hero's phones. */
	export interface Props {
		/** Which side of the phones it floats on. */
		side: "start" | "end";
		children: RemixNode;
	}
}

/**
 * A raised card drifting beside the phones, shown once the stage is wide enough to hold it
 * clear of the fanned screens. Decorative: the widgets band shows the real captures.
 *
 * @param handle Runtime handle carrying the side and the card's content.
 * @returns The render function producing the card.
 */
function FloatingCard(handle: Handle<FloatingCard.Props>) {
	return () => {
		let start = handle.props.side === "start";
		return (
			<div
				aria-hidden="true"
				mix={[
					raw({
						display: "none",
						position: "absolute",
						zIndex: "3",
						insetBlockStart: start ? "30%" : "52%",
						insetInlineStart: start ? "3%" : "auto",
						insetInlineEnd: start ? "auto" : "3%",
						alignItems: "center",
						gap: "0.75rem",
						"@container wakaba-hero (min-width: 64rem)": { display: "flex" },
					}),
					pi(4),
					raw({
						paddingBlock: "0.75rem",
						borderRadius: "1.25rem",
						backgroundColor: "var(--wakaba-card)",
						boxShadow: "0 0 0 1px rgb(60 40 20 / 0.06), 0 18px 36px -16px rgb(60 40 20 / 0.3)",
					}),
					drift(start ? "-1s" : "-4s"),
				]}
			>
				{handle.props.children}
			</div>
		);
	};
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
						"wakaba-hero",
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

/** The four companions in the order the path introduces them, each with the role it plays. */
const COMPANIONS = [
	{
		id: "kitsune",
		pose: "kitsune-pointing",
		name: "Kitsune",
		kanji: "狐",
	},
	{
		id: "oni",
		pose: "oni-correction",
		name: "Aka Oni",
		kanji: "赤鬼",
	},
	{
		id: "tanuki",
		pose: "tanuki-applause",
		name: "Tanuki",
		kanji: "狸",
	},
	{
		id: "tengu",
		pose: "tengu-teaching",
		name: "Tengu",
		kanji: "天狗",
	},
] as const;

/**
 * The companions: four characters from Japanese folklore on cards tinted after each one,
 * every card naming the moment the character appears, shown at every width so a phone
 * reader meets them too.
 *
 * @returns The render function producing the band.
 */
function Companions(handle: Handle) {
	return () => {
		let t = copyOf(handle);
		return (
			<LandingSection id="companions" tone="tinted" inset mix={[nearView(760)]}>
				<LandingHeader eyebrow={t.companions.eyebrow} description={t.companions.description}>
					{t.companions.title}
				</LandingHeader>
				<ul
					mix={[
						grid(),
						gap(4),
						m(0),
						p(0),
						raw({ listStyle: "none" }),
						at("md", gridTemplate({ columns: repeat(2, "minmax(0, 1fr)") })),
						at("xl", gridTemplate({ columns: repeat(4, "minmax(0, 1fr)") })),
					]}
				>
					{COMPANIONS.map((companion) => (
						<li
							key={companion.id}
							mix={[
								vstack({ gap: 2, align: "start" }),
								p(5),
								rounded("xl"),
								raw({ backgroundColor: `var(--wakaba-${companion.id})` }),
							]}
						>
							<img
								src={`${WAKABA_ASSETS}/characters/${companion.pose}.webp`}
								alt={t.companions.roles[companion.id].alt}
								width={360}
								height={360}
								loading="lazy"
								decoding="async"
								mix={[block(), raw({ inlineSize: "9rem", blockSize: "9rem" }), mi("auto")]}
							/>
							<p mix={[m(0), hstack({ gap: 2, align: "baseline" }), pbs(2)]}>
								<span mix={[font("display"), text("xl"), weight("bold")]}>{companion.name}</span>
								<span lang="ja" mix={[font("serif"), text("lg"), fg("brand")]}>
									{companion.kanji}
								</span>
							</p>
							<p mix={[m(0), text("sm"), weight("semibold"), fg("neutral")]}>
								{t.companions.roles[companion.id].title}
							</p>
							<p mix={[m(0), text("sm"), leading("relaxed")]}>
								{t.companions.roles[companion.id].body}
							</p>
						</li>
					))}
				</ul>
			</LandingSection>
		);
	};
}

/**
 * The flashcards: a card for 水 and the back of one with its conjugations, the two faces of
 * the same deck, beside what every card carries.
 *
 * @returns The render function producing the band.
 */
function Flashcards(handle: Handle) {
	return () => {
		let t = copyOf(handle);
		return (
			<FeatureBand
				id="flashcards"
				mix={[nearView(780)]}
				layout="split"
				lean="media"
				eyebrow={t.flashcards.eyebrow}
				title={t.flashcards.title}
				description={t.flashcards.description}
				media={
					<div
						mix={[
							grid(),
							gap(4),
							gridTemplate({ columns: repeat(2, "minmax(0, 1fr)") }),
							maxIs("30rem"),
							mi("auto"),
							is("full"),
							raw({ alignItems: "start" }),
						]}
					>
						<Phone screen="flashcards-water" />
						<div mix={[pbs(10)]}>
							<Phone screen="conjugations" />
						</div>
					</div>
				}
			>
				<ul>
					{t.flashcards.items.map((item) => (
						<li key={item}>{item}</li>
					))}
				</ul>
			</FeatureBand>
		);
	};
}

/** The real screen of each kind of question, in the order the copy lists them. */
const EXERCISE_SCREENS = [
	"listening",
	"speaking",
	"build-sentence",
	"conjugation-practice",
	"oni-correction",
] as const;

/**
 * The exercises side by side: five real screens in a row that scrolls sideways on narrow
 * screens with each phone snapping into place, and sits whole on a wide one.
 *
 * @returns The render function producing the band.
 */
function Exercises(handle: Handle) {
	return () => {
		let t = copyOf(handle);
		return (
			<LandingSection id="exercises" mix={[nearView(820)]}>
				<LandingHeader eyebrow={t.exercises.eyebrow} description={t.exercises.description}>
					{t.exercises.title}
				</LandingHeader>
				<Swipeable
					label={t.exercises.listLabel}
					column="min(78cqi, 16rem)"
					fitsFrom="60rem"
					fitColumn="minmax(0, 1fr)"
				>
					{EXERCISE_SCREENS.map((screen, index) => (
						<li
							key={screen}
							mix={[
								vstack({ gap: 3, align: "stretch" }),
								maxIs("16rem"),
								mi("auto"),
								is("full"),
								raw({ minInlineSize: "0" }),
							]}
						>
							<Phone screen={screen} />
							<span mix={[vstack({ gap: 1, align: "start" }), text("sm")]}>
								<span mix={[weight("semibold"), text("base")]}>
									{t.exercises.items[index]?.title}
								</span>
								<span mix={[fg("neutral")]}>{t.exercises.items[index]?.body}</span>
							</span>
						</li>
					))}
				</Swipeable>
			</LandingSection>
		);
	};
}

/**
 * Kana tracing: a stroke drawn over the guide beside the stroke-order guide for 水, on an
 * inset band, with the Apple Pencil named where it applies.
 *
 * @returns The render function producing the band.
 */
function KanaTracing(handle: Handle) {
	return () => {
		let t = copyOf(handle);
		return (
			<FeatureBand
				id="writing"
				mix={[nearView(760)]}
				layout="split"
				tone="tinted"
				inset
				eyebrow={t.writing.eyebrow}
				title={t.writing.title}
				description={t.writing.description}
				media={
					<div
						mix={[
							grid(),
							gap(4),
							gridTemplate({ columns: repeat(2, "minmax(0, 1fr)") }),
							maxIs("30rem"),
							mi("auto"),
							is("full"),
							raw({ alignItems: "start" }),
						]}
					>
						<Phone screen="kana-tracing" />
						<div mix={[pbs(10)]}>
							<Phone screen="stroke-guide" />
						</div>
					</div>
				}
			>
				<ul>
					{t.writing.items.map((item) => (
						<li key={item}>{item}</li>
					))}
				</ul>
			</FeatureBand>
		);
	};
}

/**
 * The smaller features, each with the real screen that shows it, the block it sits on and the
 * part of the screen the card shows. The languages card shows the app in the page's other
 * language, since a reader already sees their own on every other screen.
 */
const DETAILS = [
	{ key: "kanji-index", screen: "kanji-index", tint: "tengu", focus: "0%" },
	{ key: "particle", screen: "particle", tint: "kitsune", focus: "0%" },
	{ key: "phrases", screen: "phrases", tint: "sky", focus: "0%" },
	{ key: "kana-tables", screen: "hiragana", tint: "plum", focus: "0%" },
	{ key: "languages", screen: "flashcards-water", tint: "oni", focus: "55%" },
	{ key: "add-word", screen: "add-word", tint: "tanuki", focus: "0%" },
] as const;

namespace DetailScreen {
	/** Props of one bento card's screen. */
	export interface Props {
		screen: string;
		/** The folder of the language the capture was shot in. */
		captures: "en" | "es";
		/** Which part of the screen the card shows, as a vertical position. */
		focus: string;
		alt: string;
	}
}

/**
 * The real screen leading a bento card: the top of a full screenshot cropped to one height
 * and fading out below.
 *
 * @param handle Runtime handle carrying the screen, its crop and its alt text.
 * @returns The render function producing the screen.
 */
function DetailScreen(handle: Handle<DetailScreen.Props>) {
	return () => {
		let { alt, captures, focus, screen } = handle.props;
		let src = `${WAKABA_ASSETS}/screenshots/${captures}/${screen}.webp`;

		return (
			<div mix={[raw({ paddingInline: "12%", paddingBlockStart: "1.5rem" })]}>
				<img
					src={src}
					alt={alt}
					width={560}
					height={1218}
					loading="lazy"
					decoding="async"
					mix={[
						block(),
						is("full"),
						raw({
							blockSize: "14rem",
							objectFit: "cover",
							objectPosition: `50% ${focus}`,
							borderRadius: "1.25rem 1.25rem 0 0",
							maskImage: "linear-gradient(to bottom, black 70%, transparent)",
						}),
					]}
				/>
			</div>
		);
	};
}

/** The capture folder of the language a page is not written in. */
function otherCaptures(captures: "en" | "es"): "en" | "es" {
	return captures === "en" ? "es" : "en";
}

/**
 * The small things as a bento: six colour blocks, each led by the top of the real screen
 * that shows the feature, fading out below, and shown at every width so a phone reader sees
 * the screens too.
 *
 * @returns The render function producing the band.
 */
function Details(handle: Handle) {
	return () => {
		let t = copyOf(handle);
		return (
			<LandingSection id="details" mix={[nearView(1100)]}>
				<LandingHeader eyebrow={t.details.eyebrow} description={t.details.description}>
					{t.details.title}
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
							key={detail.key}
							mix={[
								vstack({ gap: 2, align: "stretch" }),
								pbe(6),
								rounded("xl"),
								raw({ overflow: "hidden", backgroundColor: `var(--wakaba-${detail.tint})` }),
							]}
						>
							<DetailScreen
								screen={detail.screen}
								captures={detail.key === "languages" ? otherCaptures(t.captures) : t.captures}
								focus={detail.focus}
								alt={t.details.items[detail.key].alt}
							/>
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
								{t.details.items[detail.key].title}
							</p>
							<p mix={[m(0), pi(6), text("sm"), fg("neutral"), leading("relaxed")]}>
								{t.details.items[detail.key].body}
							</p>
						</li>
					))}
				</ul>
			</LandingSection>
		);
	};
}

/**
 * The widgets, as captured in the iOS widget gallery with sample progress: the bonsai with a
 * 23-day streak, and the word of the day. On a wide band each caption stands on its outer
 * side with a companion, so the two phones sit together in the middle.
 *
 * @returns The render function producing the band.
 */
function Widgets(handle: Handle) {
	return () => {
		let t = copyOf(handle);
		return (
			<LandingSection id="widgets" tone="tinted" inset mix={[nearView(900)]}>
				<LandingHeader
					align="center"
					eyebrow={t.widgets.eyebrow}
					description={t.widgets.description}
				>
					{t.widgets.title}
				</LandingHeader>
				<div
					mix={[
						mi("auto"),
						is("full"),
						raw({
							maxInlineSize: "36rem",
							"@container (min-width: 60rem)": { maxInlineSize: "64rem" },
						}),
					]}
				>
					<Swipeable
						label={t.widgets.title}
						column="min(82cqi, 16rem)"
						fitsFrom="35rem"
						fitColumn="minmax(0, 1fr)"
					>
						<li mix={[raw({ minInlineSize: "0" })]}>
							<WidgetShot
								side="start"
								mascot="tanuki-celebrate"
								screen="widget-progress"
								title={t.widgets.progress.title}
								sizes={t.widgets.progress.sizes}
								body={t.widgets.progress.body}
							/>
						</li>
						<li mix={[raw({ minInlineSize: "0" })]}>
							<WidgetShot
								side="end"
								mascot="tengu-teaching"
								screen="widget-word"
								title={t.widgets.word.title}
								sizes={t.widgets.word.sizes}
								body={t.widgets.word.body}
							/>
						</li>
					</Swipeable>
				</div>
			</LandingSection>
		);
	};
}

namespace WidgetShot {
	/** Props of one widget capture and its caption. */
	export interface Props {
		/** Which side of the pair the capture stands on; its caption faces outward from it. */
		side: "start" | "end";
		mascot: MascotPose;
		screen: "widget-progress" | "widget-word";
		title: string;
		/** The widget sizes iOS offers for it. */
		sizes: string;
		body: string;
	}
}

/**
 * One widget gallery capture in a phone with its caption: under the phone on a narrow band,
 * and beside it on the outer side once the band is wide, led by the companion that fits it.
 *
 * @param handle Runtime handle carrying the capture, its side, companion and caption.
 * @returns The render function producing the captioned capture.
 */
function WidgetShot(handle: Handle<WidgetShot.Props>) {
	return () => {
		let { body, mascot, screen, side, sizes, title } = handle.props;
		let start = side === "start";
		return (
			<figure
				mix={[
					m(0),
					raw({
						minInlineSize: "0",
						display: "flex",
						flexDirection: "column",
						gap: "0.75rem",
						"@container (min-width: 60rem)": {
							display: "grid",
							alignItems: "center",
							gap: "1.5rem",
							gridTemplateColumns: start ? "minmax(0, 1fr) 15rem" : "15rem minmax(0, 1fr)",
						},
					}),
				]}
			>
				<div
					mix={[
						raw({
							inlineSize: "100%",
							maxInlineSize: "16rem",
							marginInline: "auto",
							"@container (min-width: 60rem)": { order: start ? "2" : "1", maxInlineSize: "none" },
						}),
					]}
				>
					<Phone screen={screen} />
				</div>
				<figcaption
					mix={[
						text("sm"),
						raw({
							display: "flex",
							flexDirection: "column",
							alignItems: "start",
							gap: "0.25rem",
							"@container (min-width: 60rem)": {
								order: start ? "1" : "2",
								alignItems: start ? "end" : "start",
								textAlign: start ? "end" : "start",
							},
						}),
					]}
				>
					<span
						mix={[
							raw({
								display: "none",
								"@container (min-width: 60rem)": { display: "block", paddingBlockEnd: "0.5rem" },
							}),
						]}
					>
						<Mascot pose={mascot} size="md" tilt={start ? -6 : 6} />
					</span>
					<span mix={[weight("semibold"), text("lg"), font("display")]}>{title}</span>
					<span mix={[text("xs"), weight("semibold"), fg("brand")]}>{sizes}</span>
					<span mix={[fg("neutral"), raw({ maxInlineSize: "20rem" })]}>{body}</span>
				</figcaption>
			</figure>
		);
	};
}

/**
 * The band width from which the privacy copy and its card sit side by side, wide enough that
 * the Kitsune sitting on the card's corner clears the first line of the list.
 */
const PRIVACY_SIDE_BY_SIDE = "@container (min-width: 64rem)";

/**
 * Privacy as plain facts, each one checked against the app's code: no account, practice on
 * the device, progress in the learner's own iCloud and speech recognised on the device.
 * Kitsune sits on the card's corner on a wide band and beside the title on a narrow one.
 *
 * @returns The render function producing the band.
 */
function Privacy(handle: Handle) {
	return () => {
		let t = copyOf(handle);
		return (
			<LandingSection id="privacy" mix={[nearView(520)]}>
				<div
					mix={[
						grid(),
						gap(8),
						raw({
							alignItems: "center",
							[PRIVACY_SIDE_BY_SIDE]: { gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" },
						}),
					]}
				>
					<div
						mix={[
							raw({
								display: "flex",
								alignItems: "start",
								gap: "1rem",
								"--ui-landing-header-end": "0",
							}),
						]}
					>
						<LandingHeader
							eyebrow={t.privacy.eyebrow}
							description={
								<>
									{t.privacy.description}{" "}
									<Link href={inLanguage(routes.wakabaPrivacy.href(), t.locale)}>
										{t.header.privacy}
									</Link>
								</>
							}
						>
							{t.privacy.title}
						</LandingHeader>
						<div
							mix={[
								raw({
									flexShrink: "0",
									paddingBlockStart: "1.5rem",
									inlineSize: "clamp(4.5rem, 20cqi, 7.5rem)",
									[PRIVACY_SIDE_BY_SIDE]: { display: "none" },
								}),
							]}
						>
							<Mascot pose="kitsune-study" size="fill" tilt={3} />
						</div>
					</div>
					<div
						mix={[
							p(6),
							rounded("xl"),
							raw({ backgroundColor: "var(--wakaba-card)", position: "relative" }),
							at("md", p(8)),
						]}
					>
						<div
							mix={[
								raw({
									display: "none",
									position: "absolute",
									insetBlockStart: "-3.5rem",
									insetInlineEnd: "1rem",
									[PRIVACY_SIDE_BY_SIDE]: { display: "block" },
								}),
							]}
						>
							<Mascot pose="kitsune-study" size="md" tilt={3} />
						</div>
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
 * The questions band: two columns of disclosures on white cards, one open at a time per
 * column.
 *
 * @returns The render function producing the band.
 */
function Questions(handle: Handle) {
	return () => {
		let t = copyOf(handle);
		return (
			<FaqBand
				id="faq"
				columns={2}
				eyebrow={t.faq.eyebrow}
				title={
					<span mix={[raw({ display: "inline-flex", alignItems: "center", gap: "0.75rem" })]}>
						{t.faq.title}
						<span mix={[raw({ flexShrink: "0", marginBlock: "-1rem" })]}>
							<Mascot pose="tengu-welcome" size="sm" tilt={6} />
						</span>
					</span>
				}
			>
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
								name={`wakaba-faq-${index}`}
								mix={[
									raw({ paddingInline: "1.25rem", backgroundColor: "var(--wakaba-card)" }),
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
 * The closing call: the first stage of the tree, a calm invitation and the same App Store
 * call as the hero.
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
				tone="tinted"
				inset
				eyebrow={<CelebratingCompanions />}
				title={t.closing.title}
				description={t.closing.description}
				actions={
					<span mix={[vstack({ gap: 4, align: "center" })]}>
						<AppStoreCall />
						<Link href={inLanguage(routes.wakabaSupport.index.href(), t.locale)} mix={[text("sm")]}>
							{t.closing.support}
						</Link>
					</span>
				}
			/>
		);
	};
}

/**
 * The four companions over the closing call: three celebrating and Aka Oni with folded arms,
 * waiting to see the first session before he cheers.
 *
 * @returns The render function producing the row.
 */
function CelebratingCompanions() {
	return () => (
		<span
			mix={[
				hstack({ gap: 0, align: "end", justify: "center" }),
				pbs(2),
				raw({ marginBlockEnd: "1rem" }),
			]}
		>
			<Mascot pose="kitsune-celebrate" size="sm" tilt={-8} />
			<Mascot pose="tanuki-celebrate" size="sm" tilt={4} />
			<Mascot pose="oni-checkpoint" size="sm" />
			<Mascot pose="tengu-celebrate" size="sm" tilt={8} />
		</span>
	);
}
