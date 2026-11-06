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
import { bg, fg } from "@sdxc/u/color";
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
	vstack,
} from "@sdxc/u/layout";
import { at, motionSafe } from "@sdxc/u/responsive";
import { is, m, maxIs, mi, p, pbs } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { font, leading, text, weight } from "@sdxc/u/typography";
import { Accordion, HeadingScope, Link, LinkButton } from "@sdxc/ui";
import {
	AccentText,
	CheckList,
	CheckRow,
	ClosingCta,
	FaqBand,
	FeatureBand,
	LandingHeader,
	LandingHero,
	LandingSection,
	TabbedStage,
} from "@sdxc/ui/landing";
import { landingCtaChrome } from "@sdxc/ui/styles";

import type { MascotPose } from "~/resources/views/wakaba/parts";

import { PATH_ADVANCE_ANIMATION, PathAutoplay } from "~/resources/components/path-autoplay";
import { WakabaLayout } from "~/resources/layouts/wakaba";
import { BonsaiBand } from "~/resources/views/wakaba/bonsai";
import { AppStoreCall, Mascot, Phone, WAKABA_ASSETS } from "~/resources/views/wakaba/parts";
import routes from "~/routes/web";

/** Types used by the landing's renderer. */
export namespace WakabaLandingView {
	/** The landing renders from configuration alone, so its model is empty. */
	export interface Model {}
}

/** The landing's `<title>`, also its Open Graph title. */
export const WAKABA_TITLE = "Wakaba: Japanese vocabulary for iPhone and iPad";

/** The landing's meta description. */
export const WAKABA_DESCRIPTION =
	"Practise Japanese vocabulary a few minutes a day with flashcards, a ten-level path and four companions, while a bonsai grows with every day you practise. Free, with no ads, subscriptions or in-app purchases.";

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
	return ({ assets }: { model: WakabaLandingView.Model; assets: DocumentAssets }) => (
		<WakabaLayout
			assets={assets}
			title={WAKABA_TITLE}
			description={WAKABA_DESCRIPTION}
			path={routes.wakaba.href()}
		>
			<WakabaLandingContent />
		</WakabaLayout>
	);
}

/**
 * The landing's `main`, every band in order, apart from the document so a browser test can
 * mount the page's content alone and measure it.
 *
 * @returns The render function producing the bands.
 */
export function WakabaLandingContent() {
	return () => (
		<main>
			<HeadingScope>
				<Hero />
				<LearningPath />
				<Companions />
				<Flashcards />
				<Exercises />
				<KanaTracing />
				<BonsaiBand />
				<Widgets />
				<Privacy />
				<Questions />
				<Download />
			</HeadingScope>
		</main>
	);
}

/**
 * The first viewport: the tagline as the `h1`, who the app is for and what it holds, the App
 * Store call, and three real screens rising out of a vermilion sun.
 *
 * @returns The render function producing the hero.
 */
function Hero() {
	return () => (
		<LandingHero
			id="top"
			tone="plain"
			align="center"
			mediaPlacement="below"
			eyebrow="Japanese vocabulary for iPhone and iPad"
			title={
				<>
					Grow with every <AccentText variant="color">session</AccentText>.
				</>
			}
			description={
				<>
					For learners who know some grammar and want the words to stick: more than{" "}
					<strong>1,190 words and 2,100 sentences</strong> to read, hear, write and say, a few
					minutes at a time.
				</>
			}
			actions={
				<span
					mix={[hstack({ gap: 3, align: "center", justify: "center" }), raw({ flexWrap: "wrap" })]}
				>
					<AppStoreCall />
					<LinkButton href="#bonsai" variant="surface" mix={[landingCtaChrome()]}>
						Watch the tree grow
						<ArrowDownIcon size={16} aria-hidden="true" />
					</LinkButton>
				</span>
			}
			note="Free. No ads, subscriptions or in-app purchases. In English and Spanish."
			media={<HeroStage />}
		/>
	);
}

/**
 * The hero's picture: the learning path in front, a flashcard and a practice question fanned
 * behind it once the stage is wide enough, all real screens, over a vermilion sun cropped by
 * the stage's lower edge.
 *
 * @returns The render function producing the stage.
 */
function HeroStage() {
	return () => (
		<div mix={[container("wakaba-hero"), is("full")]}>
			<div
				mix={[
					raw({
						"--phone": "min(16.5rem, 64cqi)",
						position: "relative",
						isolation: "isolate",
						overflow: "hidden",
						blockSize: "calc(var(--phone) * 1.62)",
						paddingBlockStart: "clamp(2rem, 6cqi, 4rem)",
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
					<Mascot pose="kitsune" size="fill" tilt={-4} />
				</div>
				<div
					mix={[
						raw({
							position: "absolute",
							zIndex: "2",
							insetBlockEnd: "-0.5rem",
							insetInlineEnd: "max(0rem, calc(50% - var(--phone) * 0.5 - min(8rem, 24cqi) * 0.72))",
							inlineSize: "min(8rem, 24cqi)",
						}),
					]}
				>
					<Mascot pose="tanuki-wave" size="fill" tilt={5} />
				</div>
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

/**
 * The learning path as a tour: the four moments a word goes through, each beside its own
 * real screen, switched with native radios so the band keeps one height.
 *
 * @returns The render function producing the band.
 */
function LearningPath() {
	return () => (
		<FeatureBand
			id="path"
			mix={[nearView(900)]}
			layout="stage"
			stageName="wakaba-path"
			stageLabel="How a word moves along the learning path"
			eyebrow="The learning path"
			title="Ten levels, a few minutes at a time"
			description={
				<>
					Each session is short and the path always shows the next one.{" "}
					<strong>Kanji and katakana arrive gradually</strong>, as you're ready for them.
					<PathAutoplay />
				</>
			}
		>
			<TabbedStage.Item
				mix={[pathStep(false)]}
				value="meet"
				defaultChecked
				label="Meet the word"
				description="A new word is introduced, read aloud and shown in every spelling before anything asks you for it."
			>
				<StageScreen>
					<Phone screen="new-word" />
				</StageScreen>
			</TabbedStage.Item>
			<TabbedStage.Item
				mix={[pathStep(false)]}
				value="practise"
				label="Practise it in short sessions"
				description="Meaning, reading, writing and listening, with speaking if you turn it on."
			>
				<StageScreen>
					<Phone screen="practice-feedback" />
				</StageScreen>
			</TabbedStage.Item>
			<TabbedStage.Item
				mix={[pathStep(false)]}
				value="exam"
				label="Pass the level exam"
				description="Each of the ten levels ends with an exam before the next one opens."
			>
				<StageScreen>
					<Phone screen="level-exam-path" />
				</StageScreen>
			</TabbedStage.Item>
			<TabbedStage.Item
				mix={[pathStep(true)]}
				value="review"
				label="Review what slipped"
				description="Spaced repetition brings words back, and Aka Oni offers a review of earlier mistakes."
			>
				<StageScreen>
					<Phone screen="oni-mistakes" />
				</StageScreen>
			</TabbedStage.Item>
		</FeatureBand>
	);
}

/** The four companions in the order the path introduces them, each with the role it plays. */
const COMPANIONS = [
	{
		id: "kitsune",
		name: "Kitsune",
		kanji: "狐",
		role: "The guide",
		body: "Points you to the recommended session on the path, studies alongside you and cheers a right answer.",
		alt: "Kitsune, a fox in a red scarf, pointing the way.",
	},
	{
		id: "oni",
		name: "Aka Oni",
		kanji: "赤鬼",
		role: "The corrector",
		body: "Turns up after a wrong answer to explain the right one, and offers a review of earlier mistakes.",
		alt: "Aka Oni, a red oni, holding up a card marked with a cross.",
	},
	{
		id: "tanuki",
		name: "Tanuki",
		kanji: "狸",
		role: "The cheerleader",
		body: "Applauds the effort, celebrates a finished session and offers listening practice with words you know.",
		alt: "Tanuki in a straw hat, clapping.",
	},
	{
		id: "tengu",
		name: "Tengu",
		kanji: "天狗",
		role: "The teacher",
		body: "Introduces new activities and offers kana practice from the path, reading and tracing.",
		alt: "Tengu, a red-faced teacher in a robe, holding a page.",
	},
] as const;

/**
 * The companions: four characters from Japanese folklore on cards tinted after each one,
 * every card naming the moment the character appears, shown at every width so a phone
 * reader meets them too.
 *
 * @returns The render function producing the band.
 */
function Companions() {
	return () => (
		<LandingSection id="companions" tone="tinted" inset mix={[nearView(760)]}>
			<LandingHeader
				eyebrow="Companions"
				description="Four characters from Japanese folklore keep you company, and each one turns up for a reason."
			>
				Four friends, one job each
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
							src={`${WAKABA_ASSETS}/characters/${companion.id}.webp`}
							alt={companion.alt}
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
						<p mix={[m(0), text("sm"), weight("semibold"), fg("neutral")]}>{companion.role}</p>
						<p mix={[m(0), text("sm"), leading("relaxed")]}>{companion.body}</p>
					</li>
				))}
			</ul>
		</LandingSection>
	);
}

/**
 * The flashcards: a card for 水 and the back of one with its conjugations, the two faces of
 * the same deck, beside what every card carries.
 *
 * @returns The render function producing the band.
 */
function Flashcards() {
	return () => (
		<FeatureBand
			id="flashcards"
			mix={[nearView(780)]}
			layout="split"
			lean="media"
			eyebrow="Flashcards"
			title="Every way to write a word, on one card"
			description={
				<>
					Swipe through the deck in your own time. <strong>Flip a card</strong> for its details and,
					for a verb, its conjugations.
				</>
			}
			media={
				<div
					mix={[
						grid(),
						gap(4),
						gridTemplate({ columns: repeat(2, "minmax(0, 1fr)") }),
						maxIs("30rem"),
						mi("auto"),
						is("full"),
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
				<li>Kanji with furigana, hiragana, katakana and romaji</li>
				<li>The meaning in English or Spanish</li>
				<li>Pronounced by your device's own Japanese voices</li>
				<li>Add your own words and edit any card</li>
			</ul>
		</FeatureBand>
	);
}

/** The five kinds of question, each with its real screen and what it asks of the learner. */
const EXERCISES = [
	{
		screen: "listening",
		title: "Listen and choose",
		body: "Hear the word in a Japanese voice and pick its meaning.",
	},
	{
		screen: "speaking",
		title: "Say it aloud",
		body: "Optional, and recognised on your device itself.",
	},
	{
		screen: "build-sentence",
		title: "Build the sentence",
		body: "Put a real sentence back together from its words.",
	},
	{
		screen: "conjugation-practice",
		title: "Conjugate the verb",
		body: "Turn たべる into the form the question asks for.",
	},
	{
		screen: "oni-correction",
		title: "Learn from a mistake",
		body: "Aka Oni shows the right answer and what set it apart.",
	},
] as const;

/**
 * The exercises side by side: five real screens in a row that scrolls sideways on narrow
 * screens with each phone snapping into place, and sits whole on a wide one.
 *
 * @returns The render function producing the band.
 */
function Exercises() {
	return () => (
		<LandingSection id="exercises" mix={[nearView(820)]}>
			<LandingHeader
				eyebrow="Practice"
				description={
					<>
						A session mixes the questions, so you recognise a word, recall it, hear it and use it in
						a sentence. <strong>Mistakes come back</strong> until they stop being mistakes.
					</>
				}
			>
				One word, asked five ways
			</LandingHeader>
			<ul
				aria-label="Wakaba's exercises"
				mix={[
					grid(),
					gap(4),
					m(0),
					p(0),
					raw({
						listStyle: "none",
						gridAutoFlow: "column",
						gridAutoColumns: "minmax(11rem, 1fr)",
						overflowX: "auto",
						scrollSnapType: "x mandatory",
						scrollPaddingInline: "0",
						paddingBlockEnd: "0.5rem",
					}),
				]}
			>
				{EXERCISES.map((exercise) => (
					<li
						key={exercise.screen}
						mix={[
							vstack({ gap: 3, align: "stretch" }),
							raw({ scrollSnapAlign: "start", minInlineSize: "0" }),
						]}
					>
						<Phone screen={exercise.screen} />
						<span mix={[vstack({ gap: 1, align: "start" }), text("sm")]}>
							<span mix={[weight("semibold"), text("base")]}>{exercise.title}</span>
							<span mix={[fg("neutral")]}>{exercise.body}</span>
						</span>
					</li>
				))}
			</ul>
		</LandingSection>
	);
}

/** Seconds each step of the path tour stays before the next one takes over. */
const PATH_STEP_SECONDS = 7;

/**
 * The progress line a path step grows down the rail while it is active, from its dot to the
 * next one, in the brand ink. It runs only while the tour plays on screen and the reader
 * allows motion, and holds still while the pointer or focus is in the tour; its end is what
 * advances the tour.
 *
 * @param last Whether the step is the last, whose line stops at the end of the rail.
 */
function pathStep(last: boolean) {
	let line = `[data-autoplay] & > input:checked + label::after`;
	return [
		keyframes(PATH_ADVANCE_ANIMATION, {
			from: { scale: "1 0" },
			to: { scale: "1 1" },
		}),
		motionSafe(
			when(line, [
				bg("brand.solid"),
				raw({
					content: '""',
					position: "absolute",
					insetInlineStart: "-1.5px",
					inlineSize: "2px",
					insetBlockStart: "1.625rem",
					insetBlockEnd: last ? "0" : "-1.625rem",
					transformOrigin: "50% 0",
					animationName: PATH_ADVANCE_ANIMATION,
					animationDuration: `${PATH_STEP_SECONDS}s`,
					animationTimingFunction: "linear",
					animationFillMode: "forwards",
				}),
			]),
		),
		when(
			`[data-slot="tabbed-stage"]:is(:hover, :focus-within) & > input:checked + label::after`,
			raw({ animationPlayState: "paused" }),
		),
	];
}

/**
 * Sets a tour screen on a sun-tinted panel at a phone's width, so every stop of the tour
 * fills the stage at the same size.
 *
 * @param handle Runtime handle carrying the framed screen.
 * @returns The render function producing the centered screen.
 */
function StageScreen(handle: Handle<{ children: RemixNode }>) {
	return () => (
		<div
			mix={[
				is("full"),
				rounded("xl"),
				raw({
					paddingBlock: "clamp(1.5rem, 5cqi, 3rem)",
					paddingInline: "clamp(2rem, 12cqi, 6rem)",
					backgroundColor: "var(--wakaba-sun)",
				}),
			]}
		>
			<div mix={[maxIs("16rem"), mi("auto"), is("full")]}>{handle.props.children}</div>
		</div>
	);
}

/**
 * Kana tracing: a stroke drawn over the guide beside the stroke-order guide for 水, on an
 * inset band, with the Apple Pencil named where it applies.
 *
 * @returns The render function producing the band.
 */
function KanaTracing() {
	return () => (
		<FeatureBand
			id="writing"
			mix={[nearView(760)]}
			layout="split"
			tone="tinted"
			inset
			eyebrow="Writing"
			title="Trace kana with Apple Pencil"
			description={
				<>
					Write hiragana and katakana with a finger on iPhone or with Apple Pencil on iPad.{" "}
					<strong>Each stroke is checked against its stroke order</strong> as you draw.
				</>
			}
			media={
				<div
					mix={[
						grid(),
						gap(4),
						gridTemplate({ columns: repeat(2, "minmax(0, 1fr)") }),
						maxIs("30rem"),
						mi("auto"),
						is("full"),
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
				<li>Animated stroke order for every kana and kanji</li>
				<li>Kana and particle tables to look things up</li>
				<li>A kanji reference ordered by stroke count</li>
			</ul>
		</FeatureBand>
	);
}

/**
 * The widgets, as captured in the iOS widget gallery with sample progress: the bonsai with a
 * 23-day streak, and the word of the day. On a wide band each caption stands on its outer
 * side with a companion, so the two phones sit together in the middle.
 *
 * @returns The render function producing the band.
 */
function Widgets() {
	return () => (
		<LandingSection id="widgets" tone="tinted" inset mix={[nearView(900)]}>
			<LandingHeader
				align="center"
				eyebrow="Widgets"
				description="Put the bonsai and a word on your Home Screen. Tap the word to open its flashcard."
			>
				Practice, one glance away
			</LandingHeader>
			<div
				mix={[
					grid(),
					gap(6),
					gridTemplate({ columns: repeat(2, "minmax(0, 1fr)") }),
					mi("auto"),
					is("full"),
					raw({
						maxInlineSize: "36rem",
						"@container (min-width: 60rem)": { maxInlineSize: "64rem", columnGap: "1.5rem" },
					}),
				]}
			>
				<WidgetShot
					side="start"
					mascot="tanuki-celebrate"
					screen="widget-progress"
					title="Practice bonsai"
					sizes="Small and medium"
					body="Your tree, the streak, whether you practised today and the words you've learned."
				/>
				<WidgetShot
					side="end"
					mascot="tengu"
					screen="widget-word"
					title="Word of the day"
					sizes="Small, medium and large"
					body="Its Japanese spelling, its reading, the meaning and the romaji. Tap it for the flashcard."
				/>
			</div>
		</LandingSection>
	);
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
							"@container (min-width: 60rem)": { order: start ? "2" : "1" },
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
 * Privacy as plain facts, each one checked against the app's code: no account, practice on
 * the device, progress in the learner's own iCloud and speech recognised on the device.
 *
 * @returns The render function producing the band.
 */
function Privacy() {
	return () => (
		<LandingSection id="privacy" mix={[nearView(520)]}>
			<div
				mix={[
					grid(),
					gap(8),
					at("lg", gridTemplate({ columns: "minmax(0, 1fr) minmax(0, 1fr)" })),
					raw({ alignItems: "center" }),
				]}
			>
				<LandingHeader
					eyebrow="Privacy"
					description={
						<>
							No account and nothing to sign in to. Wakaba keeps your practice on your device and
							your progress in your own iCloud.{" "}
							<Link href={routes.wakabaPrivacy.href()}>Read the privacy policy</Link>.
						</>
					}
				>
					Your practice stays yours
				</LandingHeader>
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
							raw({ position: "absolute", insetBlockStart: "-3.5rem", insetInlineEnd: "1rem" }),
						]}
					>
						<Mascot pose="kitsune-study" size="md" tilt={3} />
					</div>
					<CheckList>
						<CheckRow>No ads, analytics or tracking</CheckRow>
						<CheckRow>Practice runs on your iPhone or iPad</CheckRow>
						<CheckRow>Progress syncs through your private iCloud</CheckRow>
						<CheckRow>Speaking practice is recognised on the device</CheckRow>
					</CheckList>
				</div>
			</div>
		</LandingSection>
	);
}

/** The questions a learner asks before downloading, answered from what the app does. */
const QUESTIONS: ReadonlyArray<ReadonlyArray<readonly [string, RemixNode]>> = [
	[
		[
			"Who is Wakaba for?",
			"People who already know some Japanese grammar and want to remember words, recognise them when they hear them and use them in context. It doesn't teach the whole language from scratch.",
		],
		[
			"How much does it cost?",
			"Nothing. Wakaba is free, with no ads, subscriptions or in-app purchases.",
		],
		[
			"Which devices does it run on?",
			"iPhone and iPad with iOS or iPadOS 17 or later. Your progress follows you between them through iCloud.",
		],
	],
	[
		[
			"Which languages does it speak?",
			"The app and every translation come in English and Spanish.",
		],
		[
			"What happens if I miss a day?",
			"Your streak starts over the next time you practise. The bonsai counts every day you've practised, so it stays exactly as it was.",
		],
		[
			"Can I add my own words?",
			"Yes. Add words to your library, edit any entry, and practise them alongside the built-in vocabulary.",
		],
	],
];

/**
 * The questions band: two columns of disclosures on white cards, one open at a time per
 * column.
 *
 * @returns The render function producing the band.
 */
function Questions() {
	return () => (
		<FaqBand
			id="faq"
			columns={2}
			eyebrow="Questions"
			title={
				<span mix={[hstack({ gap: 3, align: "end" })]}>
					Before you download
					<Mascot pose="tengu-welcome" size="sm" tilt={6} />
				</span>
			}
		>
			{QUESTIONS.map((column, index) => (
				<Accordion
					key={index}
					mix={[
						vstack({ gap: 3, align: "stretch" }),
						raw({ "--ui-neutral-border": "transparent" }),
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
}

/**
 * The closing call: the first stage of the tree, a calm invitation and the same App Store
 * call as the hero.
 *
 * @returns The render function producing the band.
 */
function Download() {
	return () => (
		<ClosingCta
			id="download"
			tone="tinted"
			inset
			eyebrow={<CelebratingCompanions />}
			title="Plant the tree with one session"
			description="Wakaba is free on iPhone and iPad, in English and Spanish."
			actions={
				<span mix={[vstack({ gap: 4, align: "center" })]}>
					<AppStoreCall />
					<Link href={routes.wakabaSupport.index.href()} mix={[text("sm")]}>
						Questions? Write to support
					</Link>
				</span>
			}
		/>
	);
}

/**
 * The four companions over the closing call: three celebrating and Aka Oni with folded arms,
 * waiting to see the first session before he cheers.
 *
 * @returns The render function producing the row.
 */
function CelebratingCompanions() {
	return () => (
		<span mix={[hstack({ gap: 0, align: "end", justify: "center" }), pbs(2)]}>
			<Mascot pose="kitsune-celebrate" size="sm" tilt={-8} />
			<Mascot pose="tanuki-celebrate" size="sm" tilt={4} />
			<Mascot pose="oni-checkpoint" size="sm" />
			<Mascot pose="tengu-celebrate" size="sm" tilt={8} />
		</span>
	);
}
