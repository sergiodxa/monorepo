/**
 * Malfoid Stickers' landing at `/apps/malfoid`, in English or Spanish: the pack shown rather
 * than described, led by its real artwork: a hero of five stickers, a conversation she answers
 * without a word, the six moods, every sticker in a viewer, privacy, installation and questions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { Handle, RemixNode } from "remix/component";

import { ArrowDownIcon, ChevronDownIcon } from "@sdxc/icons";
import { bg, fg } from "@sdxc/u/color";
import { rounded, shadow } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { gap, grid, gridTemplate, hstack, repeat, vstack } from "@sdxc/u/layout";
import { at, motionSafe } from "@sdxc/u/responsive";
import { is, m, maxIs, mi, p, pb, pbs, pi } from "@sdxc/u/size";
import { hover } from "@sdxc/u/state";
import { font, leading, text, weight } from "@sdxc/u/typography";
import { Accordion, Heading, HeadingScope, Lightbox, Link, LinkButton } from "@sdxc/ui";
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

import type { PageLocale } from "~/app/services/page-locale";
import type { LandingCopy } from "~/resources/content/malfoid/landing";
import type { StickerId } from "~/resources/content/malfoid/stickers";

import { LANDING_COPY, MOOD_COVERS } from "~/resources/content/malfoid/landing";
import { STICKER_CATEGORIES, STICKERS } from "~/resources/content/malfoid/stickers";
import { MalfoidLayout } from "~/resources/layouts/malfoid";
import { AppStoreCall, StickerImage } from "~/resources/views/malfoid/parts";
import routes from "~/routes/web";

/** The id of the viewer every gallery tile opens. */
const VIEWER_ID = "malfoid-stickers";

/** Types used by the landing's renderer. */
export namespace MalfoidLandingView {
	/** Data required to render the page. */
	export interface Model {
		/** The language the page is written in. */
		locale: PageLocale;
	}
}

/** Props every band receives: the page's words. */
interface BandProps {
	t: LandingCopy;
}

/**
 * Lays a band's heavy content out only as it nears the viewport, holding its place with an
 * estimated height so the scrollbar stays still.
 */
function nearView(height: number) {
	return raw({ contentVisibility: "auto", containIntrinsicSize: `auto ${height}px` });
}

/**
 * The page, band by band, in the reader's language.
 *
 * @returns View function rendering the landing.
 */
export function MalfoidLandingView() {
	return ({ model, assets }: { model: MalfoidLandingView.Model; assets: DocumentAssets }) => {
		let t = LANDING_COPY[model.locale];
		return (
			<MalfoidLayout
				assets={assets}
				copy={t}
				bilingual
				title={t.meta.title}
				description={t.meta.description}
				path={routes.malfoid.landing.href()}
			>
				<MalfoidLandingContent locale={model.locale} />
			</MalfoidLayout>
		);
	};
}

/**
 * The landing's `main`, every band in order, apart from the document so a browser test can
 * mount the page's content alone and measure it.
 *
 * @param handle Runtime handle carrying the page's language, English by default.
 * @returns The render function producing the bands.
 */
export function MalfoidLandingContent(handle: Handle<{ locale?: PageLocale }>) {
	return () => {
		let t = LANDING_COPY[handle.props.locale ?? "en"];
		return (
			<main>
				<HeadingScope>
					<Hero t={t} />
					<MeetMalfoid t={t} />
					<Moods t={t} />
					<Gallery t={t} />
					<Details t={t} />
					<Privacy t={t} />
					<Install t={t} />
					<Questions t={t} />
					<Download t={t} />
				</HeadingScope>
			</main>
		);
	};
}

/**
 * The first viewport: the headline as the `h1`, who Malfoid is, the App Store call, and five
 * stickers standing in a row on a platinum-cream stage, the proudest in the middle.
 *
 * @param handle Runtime handle carrying the page's words.
 * @returns The render function producing the hero.
 */
function Hero(handle: Handle<BandProps>) {
	return () => {
		let { t } = handle.props;
		return (
			<LandingHero
				id="top"
				tone="plain"
				align="center"
				mediaPlacement="below"
				eyebrow={t.hero.eyebrow}
				title={
					<>
						<span mix={[raw({ "@media (max-width: 40rem)": { display: "none" } })]}>
							{t.hero.title}
						</span>
						<span mix={[raw({ "@media (min-width: 40.01rem)": { display: "none" } })]}>
							{t.hero.shortTitle}
						</span>
					</>
				}
				description={t.hero.description}
				actions={
					<span
						mix={[
							hstack({ gap: 3, align: "center", justify: "center" }),
							raw({ flexWrap: "wrap" }),
						]}
					>
						<AppStoreCall copy={t} />
						<LinkButton href="#stickers" variant="surface" mix={[landingCtaChrome()]}>
							{t.hero.seeAll}
							<ArrowDownIcon size={16} aria-hidden="true" />
						</LinkButton>
					</span>
				}
				note={t.privacyLine}
				media={<HeroStage locale={t.locale} />}
				parts={{ media: [pbs(2)] }}
			/>
		);
	};
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
 * @param handle Runtime handle carrying the language of the stickers' alt text.
 * @returns The render function producing the stage.
 */
function HeroStage(handle: Handle<{ locale: PageLocale }>) {
	return () => (
		<div mix={[maxIs("68rem"), mi("auto"), is("full"), raw({ position: "relative" })]}>
			<div
				aria-hidden="true"
				mix={[
					rounded("3xl"),
					raw({
						position: "absolute",
						insetInline: "0",
						insetBlock: "42% 0",
						backgroundColor: "var(--app-stage)",
					}),
				]}
			/>
			<ul
				mix={[
					hstack({ gap: 0, align: "end", justify: "center" }),
					m(0),
					p(0),
					pi(2),
					raw({
						listStyle: "none",
						position: "relative",
						paddingBlockEnd: "clamp(1rem, 3vw, 2rem)",
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
						<StickerImage
							id={pick.id}
							locale={handle.props.locale}
							sizes="(min-width: 68rem) 320px, 45vw"
							eager
						/>
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
 * @param handle Runtime handle carrying the page's words.
 * @returns The render function producing the band.
 */
function MeetMalfoid(handle: Handle<BandProps>) {
	return () => {
		let { t } = handle.props;
		return (
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
						eyebrow={t.meet.eyebrow}
						description={
							<>
								{t.meet.body[0]}
								<span mix={[raw({ display: "block" }), pbs(3)]}>{t.meet.body[1]}</span>
							</>
						}
					>
						{t.meet.title}
					</LandingHeader>
					<figure
						mix={[
							m(0),
							p(6),
							rounded("xl"),
							vstack({ gap: 3, align: "stretch" }),
							shadow("lg"),
							raw({ backgroundColor: "var(--app-card)" }),
							at("md", p(8)),
						]}
					>
						<Bubble>{t.meet.conversation[0]}</Bubble>
						<Reply id="death-stare" locale={t.locale} tilt={3} />
						<Bubble>{t.meet.conversation[1]}</Bubble>
						<Reply id="hiding-smile" locale={t.locale} tilt={-3} />
						<figcaption mix={[text("xs"), fg("neutral"), pbs(2)]}>{t.meet.caption}</figcaption>
					</figure>
				</div>
			</LandingSection>
		);
	};
}

namespace Bubble {
	/** Props of one incoming message. */
	export interface Props {
		children: RemixNode;
	}
}

/**
 * A friend's message, set as a quiet gray bubble on the left with its own ink, so it reads the
 * same on the page and in the dark sticker viewer.
 *
 * @param handle Runtime handle carrying the message.
 * @returns The render function producing the bubble.
 */
function Bubble(handle: Handle<Bubble.Props>) {
	return () => (
		<p
			mix={[
				m(0),
				pb(2.5),
				pi(4),
				text("base"),
				leading("snug"),
				bg("neutral.tint"),
				fg("neutral.emphasis"),
				raw({
					alignSelf: "start",
					maxInlineSize: "80%",
					borderRadius: "1.25rem 1.25rem 1.25rem 0.375rem",
					textAlign: "start",
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
		locale: PageLocale;
		tilt: number;
		/** Drawn large, for the viewer, instead of at a conversation card's size. */
		large?: boolean;
		/** Empty alt text, where the slide's own description already names the sticker. */
		decorative?: boolean;
	}
}

/**
 * A sticker sent as a reply, on the right, the way Messages shows one: no bubble, just the art.
 *
 * @param handle Runtime handle carrying the sticker, its size and its lean.
 * @returns The render function producing the reply.
 */
function Reply(handle: Handle<Reply.Props>) {
	return () => {
		let { decorative, id, large, locale, tilt } = handle.props;
		return (
			<div
				mix={[
					raw({
						alignSelf: "end",
						inlineSize: large ? "min(24rem, 52vmin)" : "clamp(7rem, 30%, 9.5rem)",
						rotate: `${tilt}deg`,
					}),
				]}
			>
				<StickerImage
					id={id}
					locale={locale}
					decorative={decorative}
					sizes={large ? "384px" : "152px"}
				/>
			</div>
		);
	};
}

/**
 * The six moods as a table of contents: each card names a mood, says what it's for, shows the
 * sticker that stands for it and jumps to its ten stickers in the gallery.
 *
 * @param handle Runtime handle carrying the page's words.
 * @returns The render function producing the band.
 */
function Moods(handle: Handle<BandProps>) {
	return () => {
		let { t } = handle.props;
		return (
			<LandingSection id="moods" tone="tinted" inset mix={[nearView(900)]}>
				<LandingHeader eyebrow={t.moods.eyebrow} description={t.moods.description}>
					{t.moods.title}
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
					{STICKER_CATEGORIES.map((category) => (
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
							<StickerImage id={MOOD_COVERS[category]} sizes="88px" decorative />
							<div mix={[vstack({ gap: 1.5, align: "start" })]}>
								<Heading mix={[m(0), font("display"), text("xl"), weight("semibold")]}>
									{t.moodNames[category].name}
								</Heading>
								<p mix={[m(0), text("sm"), leading("relaxed"), fg("neutral")]}>
									{t.moodNames[category].body}
								</p>
								<Link href={`#${category}`} mix={[text("sm")]}>
									{t.moods.seeAll}
								</Link>
							</div>
						</li>
					))}
				</ul>
			</LandingSection>
		);
	};
}

/**
 * Every sticker in the pack, grouped by mood under a heading the mood cards link to. Each tile
 * opens the viewer at that sticker, where it answers a friend's message at full size with its
 * description beneath; swiping or the arrows step through all 60.
 *
 * @param handle Runtime handle carrying the page's words.
 * @returns The render function producing the band.
 */
function Gallery(handle: Handle<BandProps>) {
	return () => {
		let { t } = handle.props;
		let locale = t.locale;
		return (
			<LandingSection id="stickers" mix={[nearView(2600)]}>
				<LandingHeader eyebrow={t.gallery.eyebrow} description={t.gallery.description}>
					{t.gallery.title}
				</LandingHeader>
				<div mix={[vstack({ gap: 10, align: "stretch" })]}>
					{STICKER_CATEGORIES.map((category) => (
						<section key={category} id={category} aria-labelledby={`${category}-title`}>
							<Heading
								id={`${category}-title`}
								mix={[m(0), font("display"), text("2xl"), weight("semibold")]}
							>
								{t.moodNames[category].name}
							</Heading>
							<ul
								mix={[
									grid(),
									gap(2),
									m(0),
									p(0),
									pbs(4),
									at("sm", gap(3)),
									raw({
										listStyle: "none",
										gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
										"@media (min-width: 64rem)": {
											gridTemplateColumns: "repeat(10, minmax(0, 1fr))",
										},
									}),
								]}
							>
								{STICKERS.filter((entry) => entry.category === category).map((entry) => (
									<li key={entry.id}>
										<Lightbox.Trigger
											lightbox={VIEWER_ID}
											index={STICKERS.indexOf(entry)}
											aria-label={t.gallery.open(entry.alt[locale])}
											mix={[
												is("full"),
												p(1),
												at("md", p(2)),
												rounded("lg"),
												raw({ backgroundColor: "var(--malfoid-tile)" }),
												motionSafe(raw({ transition: "transform 160ms ease" })),
												hover(raw({ transform: "rotate(-3deg) scale(1.04)" })),
											]}
										>
											<StickerImage
												id={entry.id}
												decorative
												sizes="(min-width: 64rem) 112px, 20vw"
											/>
										</Lightbox.Trigger>
									</li>
								))}
							</ul>
						</section>
					))}
				</div>
				<Lightbox
					id={VIEWER_ID}
					label={t.gallery.viewer}
					labels={t.gallery.labels}
					photos={STICKERS.map((entry) => ({
						alt: t.gallery.reply(entry.prompt[locale], entry.alt[locale]),
						caption: entry.alt[locale],
						art: (
							<div
								mix={[
									vstack({ gap: 4, align: "stretch" }),
									is("full"),
									maxIs("32rem"),
									pi(14),
									at("md", pi(4)),
								]}
							>
								<Bubble>{entry.prompt[locale]}</Bubble>
								<Reply id={entry.id} locale={locale} tilt={-2} large decorative />
							</div>
						),
					}))}
				/>
			</LandingSection>
		);
	};
}

/**
 * The practical facts in a quiet row of three, each under a short blush rule.
 *
 * @param handle Runtime handle carrying the page's words.
 * @returns The render function producing the band.
 */
function Details(handle: Handle<BandProps>) {
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
				{handle.props.t.details.map((detail) => (
					<li key={detail.title} mix={[vstack({ gap: 2, align: "start" })]}>
						<span
							aria-hidden="true"
							mix={[
								rounded("full"),
								raw({
									inlineSize: "2.5rem",
									blockSize: "0.25rem",
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
 * isn't interested in your data. The policy is English, so another language marks the link.
 *
 * @param handle Runtime handle carrying the page's words.
 * @returns The render function producing the band.
 */
function Privacy(handle: Handle<BandProps>) {
	return () => {
		let { t } = handle.props;
		return (
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
						eyebrow={t.privacy.eyebrow}
						description={
							<>
								{t.privacyLine} {t.privacy.extra}{" "}
								<Link
									href={routes.malfoid.privacy.href()}
									hrefLang={t.locale === "en" ? undefined : "en"}
								>
									{t.privacy.link}
								</Link>
							</>
						}
					>
						{t.privacy.title}
					</LandingHeader>
					<div
						mix={[
							p(6),
							pbs(12),
							rounded("xl"),
							raw({ backgroundColor: "var(--app-card)", position: "relative" }),
							at("md", [p(8), pbs(12)]),
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
							{t.privacy.facts.map((fact) => (
								<CheckRow key={fact}>{fact}</CheckRow>
							))}
						</CheckList>
					</div>
				</div>
			</LandingSection>
		);
	};
}

/**
 * Installation in four numbered steps, from the App Store to a sticker stuck on a bubble,
 * with the support page one link away for anyone who gets lost.
 *
 * @param handle Runtime handle carrying the page's words.
 * @returns The render function producing the band.
 */
function Install(handle: Handle<BandProps>) {
	return () => {
		let { t } = handle.props;
		return (
			<LandingSection id="install" tone="tinted" inset mix={[nearView(640)]}>
				<div
					mix={[
						grid(),
						gap(4),
						raw({ gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "end" }),
					]}
				>
					<LandingHeader
						eyebrow={t.install.eyebrow}
						description={
							<>
								{t.install.lead}{" "}
								<Link
									href={routes.malfoid.support.index.href()}
									hrefLang={t.locale === "en" ? undefined : "en"}
								>
									{t.install.helpLink}
								</Link>
								.
							</>
						}
					>
						{t.install.title}
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
					{t.install.steps.map((step, index) => (
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
									rounded("full"),
									raw({
										display: "grid",
										placeItems: "center",
										inlineSize: "2.25rem",
										blockSize: "2.25rem",
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
	};
}

/**
 * The questions band: two columns of disclosures on ivory cards, one open at a time per column.
 *
 * @param handle Runtime handle carrying the page's words.
 * @returns The render function producing the band.
 */
function Questions(handle: Handle<BandProps>) {
	return () => {
		let { t } = handle.props;
		let half = Math.ceil(t.faq.questions.length / 2);
		let columns = [t.faq.questions.slice(0, half), t.faq.questions.slice(half)];
		return (
			<FaqBand id="faq" columns={2} eyebrow={t.faq.eyebrow} title={t.faq.title}>
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
								mix={[pi(5), rounded("xl"), raw({ backgroundColor: "var(--app-card)" })]}
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
 * @param handle Runtime handle carrying the page's words.
 * @returns The render function producing the band.
 */
function Download(handle: Handle<BandProps>) {
	return () => {
		let { t } = handle.props;
		return (
			<ClosingCta
				id="download"
				spacing="compact"
				tone="tinted"
				inset
				eyebrow={
					<span mix={[raw({ display: "block", inlineSize: "8rem" }), mi("auto")]}>
						<StickerImage id="waving-hello" sizes="128px" decorative />
					</span>
				}
				title={t.closing.title}
				description={t.closing.description}
				actions={
					<span mix={[vstack({ gap: 4, align: "center" })]}>
						<AppStoreCall copy={t} />
						<Link
							href={routes.malfoid.support.index.href()}
							hrefLang={t.locale === "en" ? undefined : "en"}
							mix={[text("sm")]}
						>
							{t.closing.support}
						</Link>
					</span>
				}
			/>
		);
	};
}
