/**
 * Sales page view: hero, what's inside, the free-sample offer, the testimonial, both
 * packages with their live prices, the upgrade call-out, the author bio, and the FAQ, each
 * section separated by a marketing hairline.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { pseudoContent, raw } from "@sdxc/u/general";
import { gap, grid, gridTemplate, hstack, repeat, shrink, vstack } from "@sdxc/u/layout";
import { dark, media } from "@sdxc/u/responsive";
import { bs, is, maxIs, mi, mbe, p, pb, pi } from "@sdxc/u/size";
import { after, before } from "@sdxc/u/state";
import {
	balance,
	font,
	leading,
	text,
	textAlign,
	textDecoration,
	textTransform,
	weight,
	whiteSpace,
} from "@sdxc/u/typography";
import { Heading, HeadingScope, MarketingHeader, MarketingSection } from "@sdxc/ui";
import { CheckList, CheckRow } from "@sdxc/ui/patterns";
import { marketingLead } from "@sdxc/ui/styles";
import { css } from "remix/component";

import type { PackageCopy } from "~/resources/content/release";

import SampleChapterSection from "~/resources/components/sample-chapter-section";
import { FREQUENT_QUESTIONS } from "~/resources/content/frequent-questions";
import {
	AUTHOR,
	DESCRIPTION,
	FAQ_TITLE,
	FOOTER,
	HERO,
	PACKAGES,
	PRICING,
	TESTIMONIAL,
	UPGRADE_CALLOUT,
} from "~/resources/content/release";

/** The viewport width the page switches to its wide layout at, matching the site's `lg`. */
const LARGE = "(min-width: 64rem)";

/** The viewport width the upgrade call-out becomes a row at, matching the site's `sm`. */
const SMALL = "(min-width: 40rem)";

/**
 * Serif chapter title overrides: capitalize and keep the handbook face even when
 * a marketing header already applies display tokens.
 */
const CHAPTER_TITLE_MIX = [textTransform("capitalize")];

/** One package's price as the page shows it, already formatted as currency. */
export interface PriceView {
	/** The list price. */
	price: string;
	/** The discounted price, when a launch campaign applies to this package. */
	discounted?: string;
}

export namespace ReleaseView {
	/** The links this page needs, so the view never builds a path itself. */
	export interface Links {
		/** Where the sample-chapter form posts. */
		sample: string;
		/** The upgrade page. */
		upgrade: string;
		/** The checkout URL for each package, keyed by the checkout's `:type`. */
		checkout: Record<PackageCopy["type"], string>;
	}

	export interface Props {
		/** Each package's formatted price, keyed by the checkout's `:type`. */
		prices: Record<PackageCopy["type"], PriceView>;
		/** The links the page points at. */
		links: Links;
	}
}

/**
 * The hero: the title, the pitch, and the jump link down to the packages.
 * The jump link is a literal `#pricing` fragment, pointing to a section
 * within this same page.
 */
function Hero() {
	return () => (
		<MarketingSection id="hero" spacing="hero">
			<header mix={[vstack({ gap: 5 })]}>
				<Heading size="display" mix={[text("4xl"), balance(), media(LARGE, text("8xl"))]}>
					{HERO.title}
				</Heading>

				<p
					mix={[
						marketingLead(),
						maxIs("65ch"),
						fg("neutral.emphasis"),
						text("xl"),
						media(LARGE, text("3xl")),
					]}
				>
					{HERO.pitchBefore}
					<strong mix={[weight("semibold")]}>{HERO.pitchStrong}</strong>
					{HERO.pitchAfter}
				</p>

				<a
					href="#pricing"
					mix={[textTransform("capitalize"), textDecoration({ line: "underline", offset: 6 })]}
				>
					{HERO.packagesLink}
				</a>
			</header>
		</MarketingSection>
	);
}

/** The "what's inside" blocks, two per row on a wide viewport. */
function Description() {
	return () => (
		<MarketingSection id="description" ruled spacing="compact">
			<HeadingScope>
				<div mix={[vstack({ gap: 7 })]}>
					<MarketingHeader mix={[mbe(0)]} parts={{ title: CHAPTER_TITLE_MIX }}>
						{DESCRIPTION.title}
					</MarketingHeader>

					<dl mix={[grid(), gap(10), media(LARGE, gridTemplate({ columns: repeat(2, 1) }))]}>
						{DESCRIPTION.blocks.map((block) => (
							<div mix={[vstack({ gap: 4 })]}>
								<dt
									mix={[
										font("serif"),
										text("2xl"),
										weight("medium"),
										media(LARGE, leading("none")),
									]}
								>
									{block.title}
								</dt>
								<dd mix={[leading("relaxed")]}>{block.description}</dd>
							</div>
						))}
					</dl>
				</div>
			</HeadingScope>
		</MarketingSection>
	);
}

/**
 * The single testimonial: portrait, quote, and attribution. Quotation marks
 * render as pseudo-elements, keeping the quoted text itself plain and
 * reusable elsewhere. Wrapped in a ruled marketing band so the quote sits
 * in the same section rhythm as the rest of the page.
 */
function Testimonial() {
	return () => (
		<MarketingSection
			id="testimonial"
			ruled
			spacing="compact"
			align="center"
			parts={{
				container: [
					vstack({ gap: 5, align: "center" }),
					media(LARGE, hstack({ gap: 5, align: "center" })),
				],
			}}
		>
			<img
				src={TESTIMONIAL.photo}
				alt={TESTIMONIAL.photoAlt}
				mix={[is("6rem"), bs("6rem"), shrink(0), rounded("full")]}
			/>

			<div
				mix={[
					vstack({ gap: 2 }),
					maxIs("65ch"),
					textAlign("center"),
					media(LARGE, textAlign("left")),
				]}
			>
				<blockquote
					mix={[
						balance(),
						css({ fontStyle: "italic" }),
						before([pseudoContent('"“"'), balance()]),
						after([pseudoContent('"”"'), balance()]),
					]}
				>
					{TESTIMONIAL.quoteBefore}
					<strong mix={[weight("semibold")]}>{TESTIMONIAL.quoteStrong}</strong>
					{TESTIMONIAL.quoteAfter}
				</blockquote>

				<div mix={[vstack({ gap: 2 })]}>
					<h2
						mix={[
							text("lg"),
							leading("none"),
							weight("medium"),
							balance(),
							media(LARGE, text("xl")),
						]}
					>
						<a href={TESTIMONIAL.profileUrl} target="_blank" rel="noreferrer">
							{TESTIMONIAL.name}
						</a>
					</h2>

					<p mix={[text("sm"), leading("none"), weight("light")]}>
						{TESTIMONIAL.roleBefore}
						<a href={TESTIMONIAL.companyUrl} target="_blank" rel="noreferrer">
							{TESTIMONIAL.company}
						</a>
					</p>
				</div>
			</div>
		</MarketingSection>
	);
}

/** One package's purchase button, showing the struck-through list price when discounted. */
function PurchaseButton(handle: Handle<{ href: string; price: PriceView }>) {
	return () => {
		let { href, price } = handle.props;

		return (
			<a
				href={href}
				mix={[
					is("fit-content"),
					shrink(0),
					css({ borderRadius: "0.125rem" }),
					pi(5),
					pb(2.5),
					bg("color.neutral.950"),
					fg("color.neutral.50"),
					dark([bg("color.neutral.50"), fg("color.neutral.950")]),
				]}
			>
				<span>{PRICING.purchaseLabel}</span>{" "}
				{price.discounted ? (
					<span>
						<s>{price.price}</s> <strong mix={[weight("bold")]}>{price.discounted}</strong>
					</span>
				) : (
					<span>{price.price}</span>
				)}
			</a>
		);
	};
}

/**
 * The pricing section: both packages with live prices, then the upgrade
 * call-out. Its radius and inline margin use raw lengths, keeping the corner
 * rounded and the panel overhanging the section on wide viewports.
 */
function Pricing(handle: Handle<ReleaseView.Props>) {
	return () => {
		let { links, prices } = handle.props;

		return (
			<MarketingSection id="pricing" ruled spacing="normal">
				<HeadingScope>
					<div mix={[vstack({ gap: 10 })]}>
						<MarketingHeader
							description={PRICING.description}
							mix={[mbe(0)]}
							parts={{
								title: CHAPTER_TITLE_MIX,
								description: [maxIs("65ch"), text("xl"), balance(), fg("neutral.emphasis")],
							}}
						>
							{PRICING.title}
						</MarketingHeader>

						{PACKAGES.map((pkg) => (
							<article mix={[vstack({ gap: 3 })]}>
								<h3
									mix={[
										font("serif"),
										text("xl"),
										leading("none"),
										weight("medium"),
										balance(),
										media(LARGE, text("2xl")),
									]}
								>
									{pkg.title}
								</h3>

								<div mix={[vstack({ gap: 2 }), maxIs("65ch")]}>
									{pkg.lead.map((paragraph) => (
										<p>{paragraph}</p>
									))}

									{pkg.includesLabel && <p>{pkg.includesLabel}</p>}

									{pkg.includes && (
										<CheckList>
											{pkg.includes.map((item) => (
												<CheckRow>
													<strong mix={[weight("semibold")]}>{item.name}</strong> —{" "}
													{item.description}
												</CheckRow>
											))}
										</CheckList>
									)}

									{pkg.trailing?.map((paragraph) => (
										<p>{paragraph}</p>
									))}
								</div>

								<div mix={[vstack({ gap: 1, align: "start" })]}>
									<PurchaseButton href={links.checkout[pkg.type]} price={prices[pkg.type]} />
								</div>
							</article>
						))}

						<div
							mix={[
								vstack({ gap: 4, align: "start", justify: "between" }),
								p(6),
								rounded("1rem"),
								border({ color: "color.neutral.800", width: 1 }),
								bg("color.neutral.100"),
								media(SMALL, hstack({ gap: 4, align: "center", justify: "between" })),
								media(LARGE, mi(-6)),
								dark(bg("color.neutral.950")),
							]}
						>
							<div>
								<p mix={[text("sm"), fg("color.neutral.600"), dark(fg("color.neutral.400"))]}>
									{UPGRADE_CALLOUT.eyebrow}
								</p>

								<h3 mix={[text("lg"), weight("medium")]}>
									{UPGRADE_CALLOUT.titleBefore}
									<strong mix={[weight("semibold")]}>{UPGRADE_CALLOUT.titleStrong}</strong>
								</h3>

								<p mix={[text("sm"), fg("color.neutral.500")]}>{UPGRADE_CALLOUT.description}</p>
							</div>

							<a
								href={links.upgrade}
								mix={[
									is("fit-content"),
									shrink(0),
									css({ borderRadius: "0.125rem" }),
									pi(5),
									pb(2.5),
									bg("color.neutral.950"),
									fg("color.neutral.50"),
									dark([bg("color.neutral.50"), fg("color.neutral.950")]),
								]}
							>
								{UPGRADE_CALLOUT.action}
							</a>
						</div>
					</div>
				</HeadingScope>
			</MarketingSection>
		);
	};
}

/**
 * The author bio. Its prose carries inline links, which is why the copy
 * lives here. The portrait leads the section on a phone and frames it
 * beside the text on a wide viewport.
 */
function Author() {
	return () => (
		<MarketingSection
			id="author"
			ruled
			spacing="compact"
			parts={{
				container: [vstack({ gap: 5 }), media(LARGE, hstack({ gap: 5 }))],
			}}
		>
			<div mix={[vstack({ gap: 2 }), maxIs("65ch")]}>
				<HeadingScope>
					<MarketingHeader mix={[mbe(0)]} parts={{ title: CHAPTER_TITLE_MIX }}>
						{AUTHOR.title}
					</MarketingHeader>
				</HeadingScope>

				<p>
					Hi,{" "}
					<a
						href={AUTHOR.profileUrl}
						target="_blank"
						rel="noreferrer"
						mix={[weight("semibold"), textDecoration("underline")]}
					>
						I’m Sergio
					</a>{" "}
					— a full-stack developer working with TypeScript, React, and Rails to build scalable apps
					and secure APIs. I’ve spent years refining OAuth2 flows, deploying to Cloudflare, and
					optimizing systems from the backend to the edge.
				</p>

				<p>
					Everything{" "}
					<a
						href={AUTHOR.blogUrl}
						target="_blank"
						rel="noreferrer"
						mix={[weight("semibold"), textDecoration("underline")]}
					>
						I write
					</a>{" "}
					comes from real-world experience: things I’ve built, broken, and fixed. My goal is to
					share clear, practical insights that help other developers ship better code with
					confidence.
				</p>
			</div>

			<img
				src={AUTHOR.photo}
				alt={AUTHOR.photoAlt}
				mix={[
					is("12.5rem"),
					bs("12.5rem"),
					shrink(0),
					mi("auto"),
					rounded("full"),
					raw({ order: -1 }),
					media(LARGE, [raw({ order: 1 }), mi(0)]),
				]}
			/>
		</MarketingSection>
	);
}

/** The FAQ, laid out as the two columns the content module groups it into. */
function FrequentQuestions() {
	return () => (
		<MarketingSection id="faq" ruled spacing="normal">
			<HeadingScope>
				<div mix={[vstack({ gap: 10 })]}>
					<MarketingHeader mix={[mbe(0)]} parts={{ title: CHAPTER_TITLE_MIX }}>
						{FAQ_TITLE}
					</MarketingHeader>

					<div
						mix={[grid(), gap(5), media(LARGE, [gridTemplate({ columns: repeat(2, 1) }), gap(10)])]}
					>
						{FREQUENT_QUESTIONS.map((column) => (
							<dl mix={[vstack({ gap: 5 })]}>
								{column.map((item) => (
									<div mix={[vstack({ gap: 4 }), balance()]}>
										<dt
											mix={[
												font("serif"),
												text("lg"),
												weight("semibold"),
												media(LARGE, text("xl")),
											]}
										>
											{item.question}
										</dt>
										<dd mix={[weight("light"), whiteSpace("pre-line")]}>{item.answer}</dd>
									</div>
								))}
							</dl>
						))}
					</div>
				</div>
			</HeadingScope>
		</MarketingSection>
	);
}

/** Renders the sales page. */
export default function ReleaseView(handle: Handle<ReleaseView.Props>) {
	return () => {
		let { links, prices } = handle.props;

		return (
			<div mix={[vstack({ align: "stretch" }), is("100%"), pb(5), media(LARGE, pb(10))]}>
				<Hero />
				<Description />
				<SampleChapterSection action={links.sample} />
				<Testimonial />
				<Pricing links={links} prices={prices} />
				<Author />
				<FrequentQuestions />

				<footer
					mix={[
						textAlign("center"),
						text("sm"),
						weight("light"),
						pi(5),
						pb(5),
						media(LARGE, pb(0)),
					]}
				>
					{FOOTER}
				</footer>
			</div>
		);
	};
}
