/**
 * Sales page view: hero, what's inside, the free-sample offer, the testimonial, both
 * packages with their live prices, the upgrade call-out, the author bio, and the FAQ, each
 * section separated by a rule. This is the page that converts, so its section ids are part
 * of its contract — links published elsewhere point at them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { pseudoContent, raw } from "@sdxc/u/general";
import { gap, grid, gridTemplate, hstack, repeat, shrink, vstack } from "@sdxc/u/layout";
import { dark, media } from "@sdxc/u/responsive";
import { bs, is, maxIs, mi, p, pb, pi } from "@sdxc/u/size";
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
import { css } from "remix/ui";

import type { SubscribeForm } from "~/resources/components/subscribe-form";
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
		/** UTM attribution carried through from this page's query string. */
		attribution: SubscribeForm.Props["attribution"];
	}
}

/** The section heading shared by every section below the hero. */
function SectionHeading(handle: Handle<{ children: string }>) {
	return () => (
		<h2
			mix={[
				font("serif"),
				text("3xl"),
				leading("none"),
				weight("light"),
				balance(),
				textTransform("capitalize"),
				media(LARGE, text("4xl")),
			]}
		>
			{handle.props.children}
		</h2>
	);
}

/** The rule separating one section from the next. */
function SectionRule() {
	return () => <hr mix={[is("100%"), border({ color: "color.neutral.300", width: 1 })]} />;
}

/**
 * The hero: the title, the pitch, and the jump link down to the packages.
 * The jump link is a literal `#pricing` fragment, pointing to a section
 * within this same page.
 */
function Hero() {
	return () => (
		<div id="hero" mix={[vstack({ gap: 10 }), is("100%"), maxIs("64rem"), p(5)]}>
			<header mix={[vstack({ gap: 5 }), font("serif")]}>
				<h1
					mix={[
						text("4xl"),
						leading("none"),
						weight("light"),
						balance(),
						media(LARGE, text("8xl")),
					]}
				>
					{HERO.title}
				</h1>

				<p mix={[maxIs("65ch"), text("xl"), media(LARGE, text("3xl"))]}>
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
		</div>
	);
}

/** The "what's inside" blocks, two per row on a wide viewport. */
function Description() {
	return () => (
		<section id="description" mix={[vstack({ gap: 7 }), is("100%"), maxIs("64rem"), p(5)]}>
			<SectionHeading>{DESCRIPTION.title}</SectionHeading>

			<dl mix={[grid(), gap(10), media(LARGE, gridTemplate({ columns: repeat(2, 1) }))]}>
				{DESCRIPTION.blocks.map((block) => (
					<div key={block.title} mix={[vstack({ gap: 4 })]}>
						<dt mix={[font("serif"), text("2xl"), weight("medium"), media(LARGE, leading("none"))]}>
							{block.title}
						</dt>
						<dd mix={[leading("relaxed")]}>{block.description}</dd>
					</div>
				))}
			</dl>
		</section>
	);
}

/**
 * The single testimonial: portrait, quote, and attribution. Quotation marks
 * render as pseudo-elements, keeping the quoted text itself plain and
 * reusable elsewhere.
 */
function Testimonial() {
	return () => (
		<section
			id="testimonial"
			mix={[
				vstack({ gap: 5, align: "center" }),
				is("100%"),
				maxIs("64rem"),
				p(5),
				media(LARGE, hstack({ gap: 5, align: "center" })),
			]}
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
		</section>
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
function Pricing(handle: Handle<Omit<ReleaseView.Props, "attribution">>) {
	return () => {
		let { links, prices } = handle.props;

		return (
			<section id="pricing" mix={[vstack({ gap: 10 }), is("100%"), maxIs("64rem"), p(5)]}>
				<header mix={[vstack({ gap: 2 })]}>
					<SectionHeading>{PRICING.title}</SectionHeading>

					<p mix={[maxIs("65ch"), text("xl"), balance()]}>{PRICING.description}</p>
				</header>

				{PACKAGES.map((pkg) => (
					<article key={pkg.title} mix={[vstack({ gap: 3 })]}>
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
								<p key={paragraph}>{paragraph}</p>
							))}

							{pkg.includesLabel && <p>{pkg.includesLabel}</p>}

							{pkg.includes && (
								<ul
									mix={[
										vstack({ gap: 1.5 }),
										css({ listStyle: "disc inside", paddingInlineStart: "0.5rem" }),
									]}
								>
									{pkg.includes.map((item) => (
										<li key={item.name}>
											{item.icon} <strong mix={[weight("semibold")]}>{item.name}</strong> —{" "}
											{item.description}
										</li>
									))}
								</ul>
							)}

							{pkg.trailing?.map((paragraph) => (
								<p key={paragraph}>{paragraph}</p>
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
			</section>
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
		<section
			id="author"
			mix={[vstack({ gap: 5 }), is("100%"), maxIs("64rem"), p(5), media(LARGE, hstack({ gap: 5 }))]}
		>
			<div mix={[vstack({ gap: 2 }), maxIs("65ch")]}>
				<SectionHeading>{AUTHOR.title}</SectionHeading>

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
		</section>
	);
}

/** The FAQ, laid out as the two columns the content module groups it into. */
function FrequentQuestions() {
	return () => (
		<section id="faq" mix={[vstack({ gap: 10 }), is("100%"), maxIs("64rem"), p(5)]}>
			<SectionHeading>{FAQ_TITLE}</SectionHeading>

			<div mix={[grid(), gap(5), media(LARGE, [gridTemplate({ columns: repeat(2, 1) }), gap(10)])]}>
				{FREQUENT_QUESTIONS.map((column, index) => (
					<dl key={index} mix={[vstack({ gap: 5 })]}>
						{column.map((item) => (
							<div key={item.question} mix={[vstack({ gap: 4 }), balance()]}>
								<dt mix={[font("serif"), text("lg"), weight("semibold"), media(LARGE, text("xl"))]}>
									{item.question}
								</dt>
								<dd mix={[weight("light"), whiteSpace("pre-line")]}>{item.answer}</dd>
							</div>
						))}
					</dl>
				))}
			</div>
		</section>
	);
}

/** Renders the sales page. */
export default function ReleaseView(handle: Handle<ReleaseView.Props>) {
	return () => {
		let { attribution, links, prices } = handle.props;

		return (
			<div
				mix={[
					vstack({ gap: 5, align: "center" }),
					is("100%"),
					maxIs("64rem"),
					pb(5),
					media(LARGE, [gap(15), pb(10)]),
				]}
			>
				<Hero />
				<SectionRule />
				<Description />
				<SectionRule />
				<SampleChapterSection action={links.sample} attribution={attribution} />
				<SectionRule />
				<Testimonial />
				<SectionRule />
				<Pricing links={links} prices={prices} />
				<SectionRule />
				<Author />
				<SectionRule />
				<FrequentQuestions />

				<footer mix={[textAlign("center"), text("sm"), weight("light")]}>{FOOTER}</footer>
			</div>
		);
	};
}
