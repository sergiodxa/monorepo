/**
 * Malfoid Stickers' landing at `/apps/malfoid`: the pack shown rather than described, led by
 * its real artwork: a hero of five stickers, a conversation she answers without a word, the six
 * moods, every one of the 60 stickers, privacy, installation, questions and the download.
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
import { gap, grid, gridTemplate, hstack, repeat, vstack } from "@sdxc/u/layout";
import { at, motionSafe } from "@sdxc/u/responsive";
import { is, m, maxIs, mi, p, pbs } from "@sdxc/u/size";
import { hover } from "@sdxc/u/state";
import { font, leading, text, weight } from "@sdxc/u/typography";
import { Accordion, Heading, HeadingScope, Link, LinkButton } from "@sdxc/ui";
import {
	CheckList,
	CheckRow,
	ClosingCta,
	FaqBand,
	LandingHeader,
	LandingHero,
	LandingSection,
} from "@sdxc/ui/landing";
import { landingCtaChrome } from "@sdxc/ui/styles";

import type { StickerId } from "~/resources/content/malfoid/stickers";

import { INSTALL_STEPS, MOODS, PRIVACY_FACTS, QUESTIONS } from "~/resources/content/malfoid/copy";
import { STICKER_CATEGORIES, STICKERS } from "~/resources/content/malfoid/stickers";
import { MalfoidLayout } from "~/resources/layouts/malfoid";
import { AppStoreCall, StickerImage } from "~/resources/views/malfoid/parts";
import routes from "~/routes/web";

/** The page's title, which also names it in search results and shared links. */
const TITLE = "Malfoid Stickers: Cute & Sassy Reactions for iMessage";

/** The page's description, for search results and the social card. */
const DESCRIPTION =
	"Meet Malfoid, your favorite grumpy blonde with an attitude: 60 free, textless iMessage stickers for iPhone and iPad. No ads, no subscriptions, no data collection.";

/** The promise every download call sits beside. */
const PRIVACY_LINE = "Completely free. No ads. No subscriptions. No data collection. Just Malfoid.";

/**
 * Lays a band's heavy content out only as it nears the viewport, holding its place with an
 * estimated height so the scrollbar stays still.
 */
function nearView(height: number) {
	return raw({ contentVisibility: "auto", containIntrinsicSize: `auto ${height}px` });
}

/**
 * The page, band by band.
 *
 * @returns View function rendering the landing.
 */
export function MalfoidLandingView() {
	return ({ assets }: { assets: DocumentAssets }) => (
		<MalfoidLayout
			assets={assets}
			title={TITLE}
			description={DESCRIPTION}
			path={routes.malfoid.landing.href()}
		>
			<MalfoidLandingContent />
		</MalfoidLayout>
	);
}

/**
 * The landing's `main`, every band in order, apart from the document so a browser test can
 * mount the page's content alone and measure it.
 *
 * @returns The render function producing the bands.
 */
export function MalfoidLandingContent() {
	return () => (
		<main>
			<HeadingScope>
				<Hero />
				<MeetMalfoid />
				<Moods />
				<Gallery />
				<Details />
				<Privacy />
				<Install />
				<Questions />
				<Download />
			</HeadingScope>
		</main>
	);
}

/**
 * The first viewport: the headline as the `h1`, who Malfoid is, the App Store call, and five
 * stickers standing in a row on a platinum-cream stage, the proudest in the middle.
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
			eyebrow="iMessage stickers for iPhone and iPad"
			title="A little cute. A little dramatic. A lot of attitude."
			description="Meet Malfoid, your favorite grumpy blonde with an attitude. Express yourself with 60 adorable, sarcastic, dramatic, and unapologetically sassy stickers."
			actions={
				<span
					mix={[hstack({ gap: 3, align: "center", justify: "center" }), raw({ flexWrap: "wrap" })]}
				>
					<AppStoreCall />
					<LinkButton href="#stickers" variant="surface" mix={[landingCtaChrome()]}>
						See all 60
						<ArrowDownIcon size={16} aria-hidden="true" />
					</LinkButton>
				</span>
			}
			note={PRIVACY_LINE}
			media={<HeroStage />}
			parts={{ media: [raw({ marginBlockStart: "0.5rem" })] }}
		/>
	);
}

/** The hero's five stickers, left to right, with each one's share of the row and its lean. */
const HERO_LINEUP: ReadonlyArray<{ id: StickerId; share: number; tilt: number; wide?: boolean }> = [
	{ id: "eye-roll", share: 19, tilt: -7, wide: true },
	{ id: "blushing-look-away", share: 22, tilt: -3 },
	{ id: "smug", share: 28, tilt: 0 },
	{ id: "dramatic-crying", share: 22, tilt: 4 },
	{ id: "hugging-heart", share: 19, tilt: 7, wide: true },
];

/**
 * The stage: a rounded platinum-cream panel the stickers stand on, overlapping its top edge
 * like stickers pressed onto a page. A phone shows the middle three, each larger.
 *
 * @returns The render function producing the stage.
 */
function HeroStage() {
	return () => (
		<div mix={[maxIs("68rem"), mi("auto"), is("full"), raw({ position: "relative" })]}>
			<div
				aria-hidden="true"
				mix={[
					raw({
						position: "absolute",
						insetInline: "0",
						insetBlock: "42% 0",
						borderRadius: "2rem",
						backgroundColor: "var(--app-stage)",
					}),
				]}
			/>
			<ul
				mix={[
					hstack({ gap: 0, align: "end", justify: "center" }),
					m(0),
					p(0),
					raw({
						listStyle: "none",
						position: "relative",
						paddingBlockEnd: "clamp(1rem, 3vw, 2rem)",
						paddingInline: "clamp(0.5rem, 2vw, 1.5rem)",
					}),
				]}
			>
				{HERO_LINEUP.map((pick, index) => (
					<li
						key={pick.id}
						mix={[
							raw({
								flex: `0 1 ${pick.share * 1.5}%`,
								rotate: `${pick.tilt}deg`,
								marginInline: "-3%",
								marginBlockEnd: index === 2 ? "2rem" : "0",
								"@media (min-width: 40rem)": { flexBasis: `${pick.share}%` },
							}),
							pick.wide
								? raw({ display: "none", "@media (min-width: 40rem)": { display: "block" } })
								: [],
						]}
					>
						<StickerImage id={pick.id} sizes="(min-width: 68rem) 320px, 45vw" eager />
					</li>
				))}
			</ul>
		</div>
	);
}

/**
 * Who Malfoid is, beside a conversation she answers without a word, so the pack is seen
 * doing its job: the stickers are the replies.
 *
 * @returns The render function producing the band.
 */
function MeetMalfoid() {
	return () => (
		<LandingSection id="meet">
			<div
				mix={[
					grid(),
					gap(10),
					raw({ alignItems: "center" }),
					at("lg", gridTemplate({ columns: repeat(2, "minmax(0, 1fr)") })),
				]}
			>
				<LandingHeader
					eyebrow="Meet Malfoid"
					description={
						<>
							Platinum hair, silver eyes, snake hairpin. Proud, sarcastic and determined to look
							composed.
							<span mix={[raw({ display: "block", marginBlockStart: "0.75rem" })]}>
								Her feelings have other plans.
							</span>
						</>
					}
				>
					Composed. Superior. Blushing anyway.
				</LandingHeader>
				<Conversation />
			</div>
		</LandingSection>
	);
}

namespace Bubble {
	/** Props of one incoming message. */
	export interface Props {
		children: RemixNode;
	}
}

/**
 * A friend's message, set as a quiet gray bubble on the left.
 *
 * @param handle Runtime handle carrying the message.
 * @returns The render function producing the bubble.
 */
function Bubble(handle: Handle<Bubble.Props>) {
	return () => (
		<p
			mix={[
				m(0),
				text("base"),
				leading("snug"),
				raw({
					alignSelf: "start",
					maxInlineSize: "80%",
					padding: "0.625rem 1rem",
					borderRadius: "1.25rem 1.25rem 1.25rem 0.375rem",
					backgroundColor: "var(--ui-neutral-bg-tint)",
				}),
			]}
		>
			{handle.props.children}
		</p>
	);
}

namespace Reply {
	/** Props of one sticker sent as a reply. */
	export interface Props {
		id: StickerId;
		tilt: number;
	}
}

/**
 * A sticker sent as a reply, on the right, the way Messages shows one: no bubble, just the art.
 *
 * @param handle Runtime handle carrying the sticker and its lean.
 * @returns The render function producing the reply.
 */
function Reply(handle: Handle<Reply.Props>) {
	return () => (
		<div
			mix={[
				raw({
					alignSelf: "end",
					inlineSize: "clamp(7rem, 30%, 9.5rem)",
					rotate: `${handle.props.tilt}deg`,
				}),
			]}
		>
			<StickerImage id={handle.props.id} sizes="152px" />
		</div>
	);
}

/**
 * A short exchange on an ivory card: a confession, a death stare, an apology, a smile she
 * hides behind her sleeve. Labelled as an example, so nobody reads it as a screenshot.
 *
 * @returns The render function producing the conversation.
 */
function Conversation() {
	return () => (
		<figure
			mix={[
				m(0),
				p(6),
				rounded("xl"),
				vstack({ gap: 3, align: "stretch" }),
				raw({ backgroundColor: "var(--app-card)", boxShadow: "var(--ui-shadow-stage)" }),
				at("md", p(8)),
			]}
		>
			<Bubble>I ate the last slice of your cake.</Bubble>
			<Reply id="death-stare" tilt={3} />
			<Bubble>…I’ll bake you a whole new one?</Bubble>
			<Reply id="hiding-smile" tilt={-3} />
			<figcaption mix={[text("xs"), fg("neutral"), pbs(2)]}>
				An example conversation. Every reply is a Malfoid sticker.
			</figcaption>
		</figure>
	);
}

/**
 * The six moods as a table of contents: each card names a mood, says what it's for, shows the
 * sticker that stands for it and jumps to its ten stickers in the gallery.
 *
 * @returns The render function producing the band.
 */
function Moods() {
	return () => (
		<LandingSection id="moods" tone="tinted" inset mix={[nearView(900)]}>
			<LandingHeader
				eyebrow="Six moods, ten stickers each"
				description="Pride, rage, embarrassment, joy, despair and the everyday in between."
			>
				For every mood—even the ones you’re pretending not to have.
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
				{STICKER_CATEGORIES.map((category) => {
					let mood = MOODS[category];
					return (
						<li
							key={category}
							mix={[
								grid(),
								gap(4),
								p(5),
								rounded("xl"),
								raw({
									gridTemplateColumns: "5.5rem minmax(0, 1fr)",
									alignItems: "center",
									backgroundColor: "var(--app-card)",
								}),
							]}
						>
							<StickerImage id={mood.cover} sizes="88px" decorative />
							<div mix={[vstack({ gap: 1.5, align: "start" })]}>
								<Heading mix={[m(0), font("display"), text("xl"), weight("semibold")]}>
									{mood.name}
								</Heading>
								<p mix={[m(0), text("sm"), leading("relaxed"), fg("neutral")]}>{mood.body}</p>
								<Link href={`#${category}`} mix={[text("sm")]}>
									See all 10
								</Link>
							</div>
						</li>
					);
				})}
			</ul>
		</LandingSection>
	);
}

/**
 * Every sticker in the pack, grouped by mood under a heading the mood cards link to. Each sits
 * on an ivory tile, as it would in the sticker drawer, and loads only as it nears the viewport.
 *
 * @returns The render function producing the band.
 */
function Gallery() {
	return () => (
		<LandingSection id="stickers" mix={[nearView(2600)]}>
			<LandingHeader
				eyebrow="The whole pack"
				description="All 60 stickers, exactly as they appear in Messages: transparent, outlined and ready to stick on any bubble."
			>
				Every last one of her
			</LandingHeader>
			<div mix={[vstack({ gap: 10, align: "stretch" })]}>
				{STICKER_CATEGORIES.map((category) => (
					<section key={category} id={category} aria-labelledby={`${category}-title`}>
						<Heading
							id={`${category}-title`}
							mix={[m(0), font("display"), text("2xl"), weight("semibold"), pbs(0)]}
						>
							{MOODS[category].name}
						</Heading>
						<ul
							mix={[
								grid(),
								gap(2),
								m(0),
								p(0),
								raw({
									listStyle: "none",
									marginBlockStart: "1rem",
									gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
									"@media (min-width: 40rem)": { gap: "0.75rem" },
									"@media (min-width: 64rem)": {
										gridTemplateColumns: "repeat(10, minmax(0, 1fr))",
									},
								}),
							]}
						>
							{STICKERS.filter((entry) => entry.category === category).map((entry) => (
								<li
									key={entry.id}
									mix={[
										p(1),
										at("md", p(2)),
										rounded("lg"),
										raw({ backgroundColor: "var(--malfoid-tile)" }),
										motionSafe(raw({ transition: "transform 160ms ease" })),
										hover(raw({ transform: "rotate(-3deg) scale(1.04)" })),
									]}
								>
									<StickerImage id={entry.id} sizes="(min-width: 64rem) 112px, 20vw" />
								</li>
							))}
						</ul>
					</section>
				))}
			</div>
		</LandingSection>
	);
}

/** The pack's three practical facts, each a short title and the sentence behind it. */
const DETAILS = [
	{
		title: "Speaks every language",
		body: "No text on any sticker, so every reaction lands wherever your friends are.",
	},
	{
		title: "Works offline",
		body: "All the artwork ships inside the app. Nothing to download later.",
	},
	{
		title: "iPhone and iPad",
		body: "A native iMessage sticker pack that lives right inside Messages.",
	},
] as const;

/**
 * The practical facts in a quiet row of three, each under a short blush rule.
 *
 * @returns The render function producing the band.
 */
function Details() {
	return () => (
		<LandingSection id="details" spacing="compact">
			<ul
				mix={[
					grid(),
					gap(8),
					m(0),
					p(0),
					raw({ listStyle: "none" }),
					at("md", gridTemplate({ columns: repeat(3, "minmax(0, 1fr)") })),
				]}
			>
				{DETAILS.map((detail) => (
					<li key={detail.title} mix={[vstack({ gap: 2, align: "start" })]}>
						<span
							aria-hidden="true"
							mix={[
								raw({
									inlineSize: "2.5rem",
									blockSize: "0.25rem",
									borderRadius: "9999px",
									backgroundColor: "var(--malfoid-blush)",
								}),
							]}
						/>
						<Heading mix={[m(0), font("display"), text("xl"), weight("semibold"), pbs(2)]}>
							{detail.title}
						</Heading>
						<p mix={[m(0), leading("relaxed"), fg("neutral")]}>{detail.body}</p>
					</li>
				))}
			</ul>
		</LandingSection>
	);
}

/**
 * Privacy as plain facts on an ivory card, with Malfoid's arms crossed on its corner: she
 * isn't interested in your data.
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
					raw({ alignItems: "center" }),
					at("lg", gridTemplate({ columns: repeat(2, "minmax(0, 1fr)") })),
				]}
			>
				<LandingHeader
					eyebrow="Privacy"
					description={
						<>
							{PRIVACY_LINE} The app collects nothing at all.{" "}
							<Link href={routes.malfoid.privacy.href()}>Read the privacy policy</Link>
						</>
					}
				>
					She isn’t interested in your data.
				</LandingHeader>
				<div
					mix={[
						p(6),
						rounded("xl"),
						raw({
							backgroundColor: "var(--app-card)",
							position: "relative",
							paddingBlockStart: "3rem",
						}),
						at("md", p(8)),
					]}
				>
					<div
						mix={[
							raw({
								position: "absolute",
								insetBlockStart: "-3.25rem",
								insetInlineEnd: "1rem",
								inlineSize: "6.5rem",
								rotate: "6deg",
							}),
						]}
					>
						<StickerImage id="arms-crossed" sizes="104px" decorative />
					</div>
					<CheckList>
						{PRIVACY_FACTS.map((fact) => (
							<CheckRow key={fact}>{fact}</CheckRow>
						))}
					</CheckList>
				</div>
			</div>
		</LandingSection>
	);
}

/**
 * Installation in four numbered steps, from the App Store to a sticker stuck on a bubble,
 * with the support page one link away for anyone who gets lost.
 *
 * @returns The render function producing the band.
 */
function Install() {
	return () => (
		<LandingSection id="install" tone="tinted" inset mix={[nearView(640)]}>
			<div
				mix={[
					grid(),
					gap(4),
					raw({ gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "end" }),
				]}
			>
				<LandingHeader
					eyebrow="Getting started"
					description={
						<>
							No setup, no account. Can’t find her?{" "}
							<Link href={routes.malfoid.support.index.href()}>The support page can help</Link>.
						</>
					}
				>
					From the App Store to the group chat
				</LandingHeader>
				<div
					mix={[
						raw({
							inlineSize: "clamp(5rem, 18vw, 9rem)",
							rotate: "-5deg",
							marginBlockEnd: "var(--ui-landing-header-space)",
						}),
					]}
				>
					<StickerImage id="using-phone" sizes="144px" decorative />
				</div>
			</div>
			<ol
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
				{INSTALL_STEPS.map((step, index) => (
					<li
						key={step.title}
						mix={[
							vstack({ gap: 2, align: "start" }),
							p(5),
							rounded("xl"),
							raw({ backgroundColor: "var(--app-card)" }),
						]}
					>
						<span
							aria-hidden="true"
							mix={[
								font("display"),
								text("lg"),
								weight("semibold"),
								raw({
									display: "grid",
									placeItems: "center",
									inlineSize: "2.25rem",
									blockSize: "2.25rem",
									borderRadius: "9999px",
									color: "var(--malfoid-on-emerald)",
									backgroundColor: "var(--malfoid-emerald)",
								}),
							]}
						>
							{index + 1}
						</span>
						<Heading mix={[m(0), font("display"), text("xl"), weight("semibold"), pbs(2)]}>
							{step.title}
						</Heading>
						<p mix={[m(0), text("sm"), leading("relaxed"), fg("neutral")]}>{step.body}</p>
					</li>
				))}
			</ol>
		</LandingSection>
	);
}

/**
 * The questions band: two columns of disclosures on ivory cards, one open at a time per column.
 *
 * @returns The render function producing the band.
 */
function Questions() {
	return () => {
		let half = Math.ceil(QUESTIONS.length / 2);
		let columns = [QUESTIONS.slice(0, half), QUESTIONS.slice(half)];
		return (
			<FaqBand id="faq" columns={2} eyebrow="Questions" title="Before you ask">
				{columns.map((column, index) => (
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
								name={`malfoid-faq-${index}`}
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
 * The closing call: Malfoid waving, a short invitation and the same App Store call as the hero.
 *
 * @returns The render function producing the band.
 */
function Download() {
	return () => (
		<ClosingCta
			id="download"
			spacing="compact"
			tone="tinted"
			inset
			eyebrow={
				<span mix={[raw({ display: "block", inlineSize: "7rem", marginInline: "auto" })]}>
					<StickerImage id="waving-hello" sizes="112px" decorative />
				</span>
			}
			title="Let her into your group chat."
			description="Free on iPhone and iPad. She’ll pretend she doesn’t care."
			actions={
				<span mix={[vstack({ gap: 4, align: "center" })]}>
					<AppStoreCall />
					<Link href={routes.malfoid.support.index.href()} mix={[text("sm")]}>
						Need help? Visit support
					</Link>
				</span>
			}
		/>
	);
}
