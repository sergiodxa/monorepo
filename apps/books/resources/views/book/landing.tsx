/**
 * A book's landing, set as a printed page from `@sdxc/ui` landing patterns: the flat cover
 * beside the promise, the free chapter, what is inside, the flow the book teaches with its
 * own code, the author, both packages at their live prices, the questions, and a last page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { ChevronDownIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { grid, hstack, vstack } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";
import { Accordion, Badge, Feature, HeadingScope, Link, LinkButton } from "@sdxc/ui";
import {
	AuthorBand,
	CheckRow,
	ClosingCta,
	CodeStage,
	FaqBand,
	FeatureBand,
	LandingHero,
	PricingBand,
	StepList,
} from "@sdxc/ui/patterns";
import { marketingCtaChrome } from "@sdxc/ui/styles";

import type { Book } from "~/config/books";
import type { Product } from "~/config/products";
import type { BookCopy } from "~/resources/content/books";

import SamplePage from "~/resources/views/book/sample-page";
import EmailForm from "~/resources/views/site/email-form";

/** One package's price as the page shows it, already formatted as currency. */
export interface PriceView {
	/** The list price. */
	price: string;
	/** The discounted price, when a launch campaign applies to this package. */
	discounted?: string;
}

export namespace BookLanding {
	/** The URLs the page links to, so the view never builds a path itself. */
	export interface Links {
		/** Where the sample form posts, when the book has a free chapter. */
		sample?: string;
		/** The upgrade page, when the book has an upgrade path. */
		upgrade?: string;
		/** The checkout URL for each package the book sells. */
		checkout: Partial<Record<Product, string>>;
	}

	export interface Props {
		book: Book;
		copy: BookCopy;
		/** Each package's formatted price. */
		prices: Partial<Record<Product, PriceView>>;
		/** The lowest price a reader can pay today, quoted on the hero's buy button. */
		from: string;
		links: Links;
	}
}

/** The price a reader pays: the struck list price beside the campaign's when one applies. */
function Price(handle: Handle<{ price: PriceView }>) {
	return () => {
		let { price } = handle.props;
		if (!price.discounted) return <>{price.price}</>;
		return (
			<span>
				<s mix={[fg("neutral.muted"), raw({ fontSize: "0.6em", marginInlineEnd: "0.25em" })]}>
					{price.price}
				</s>{" "}
				{price.discounted}
			</span>
		);
	};
}

/** The buy button and the underlined way into the free chapter, shared by hero and last page. */
function Actions(handle: Handle<{ from: string; sample: boolean }>) {
	return () => (
		<>
			<LinkButton href="#pricing" color="brand" mix={[marketingCtaChrome()]}>
				Buy the book — from {handle.props.from}
			</LinkButton>
			{handle.props.sample && (
				<Link href="#sample" color="neutral" mix={[weight("medium")]}>
					Read a chapter free
				</Link>
			)}
		</>
	);
}

/** A reader's quote as a printed line under the hero's actions, with their photo. */
function QuoteLine(handle: Handle<{ quote: BookCopy.Quote }>) {
	return () => {
		let { quote } = handle.props;
		return (
			<figure
				mix={[
					m(0),
					hstack({ gap: 4, align: "start" }),
					raw({
						paddingBlockStart: "1.25rem",
						borderBlockStart: "1px solid var(--ui-marketing-hairline)",
						maxInlineSize: "34rem",
					}),
				]}
			>
				<img
					src={quote.photo}
					alt=""
					width="44"
					height="44"
					mix={[
						raw({
							flexShrink: "0",
							inlineSize: "2.75rem",
							blockSize: "2.75rem",
							borderRadius: "50%",
						}),
					]}
				/>
				<div mix={[vstack({ gap: 1, align: "start" })]}>
					<blockquote
						mix={[
							m(0),
							text("base"),
							fg("neutral.emphasis"),
							raw({ fontStyle: "italic", textWrap: "pretty" }),
						]}
					>
						“{quote.quote}”
					</blockquote>
					<figcaption
						mix={[
							text("sm"),
							fg("neutral"),
							when("& a", raw({ color: "inherit", textUnderlineOffset: "0.2em" })),
						]}
					>
						<span mix={[weight("semibold"), fg("neutral.emphasis")]}>{quote.name}</span>,{" "}
						{quote.role}
					</figcaption>
				</div>
			</figure>
		);
	};
}

/** The free chapter: the offer and its email form beside the chapter's first page. */
function Sample(handle: Handle<{ copy: BookCopy; action: string }>) {
	return () => {
		let { action, copy } = handle.props;
		return (
			<FeatureBand
				id="sample"
				layout="split"
				tone="tinted"
				eyebrow="Free chapter"
				title={copy.sample.title}
				description={copy.sample.description}
				media={<SamplePage page={copy.sample.page} />}
			>
				<EmailForm
					action={action}
					submitLabel="Read the chapter"
					note="No spam. Unsubscribe anytime."
				/>
			</FeatureBand>
		);
	};
}

/** What the book holds, as an open list of icons and copy, two by two. */
function Inside(handle: Handle<{ copy: BookCopy }>) {
	return () => {
		let { inside } = handle.props.copy;
		return (
			<FeatureBand
				id="inside"
				layout="grid"
				columns={inside.claims.length % 3 === 0 ? 3 : 2}
				gridVariant="list"
				eyebrow="What’s inside"
				title={inside.title}
				description={inside.description}
			>
				{inside.claims.map((claim) => (
					<Feature>
						<Feature.Icon>{claim.icon}</Feature.Icon>
						<Feature.Title>{claim.title}</Feature.Title>
						<Feature.Description>{claim.body}</Feature.Description>
					</Feature>
				))}
			</FeatureBand>
		);
	};
}

/**
 * The flow the book teaches, step by step, beside the chapter's own code for it. The steps
 * sit in a scope at the band's level, so each step titles at `h3` like a card.
 */
function Flow(handle: Handle<{ copy: BookCopy }>) {
	return () => {
		let { flow } = handle.props.copy;
		return (
			<FeatureBand
				id="flow"
				layout="split"
				tone="tinted"
				lean="media"
				eyebrow="How it works"
				title={flow.title}
				description={flow.description}
				media={
					<CodeStage
						variant="code"
						name="book-flow-code"
						tabs={flow.samples.map((sample) => ({
							label: sample.label,
							content: sample.code,
							language: sample.language,
						}))}
					/>
				}
			>
				<HeadingScope level={2}>
					<StepList variant="timeline">
						{flow.steps.map((step) => (
							<StepList.Item title={step.title}>{step.body}</StepList.Item>
						))}
					</StepList>
				</HeadingScope>
			</FeatureBand>
		);
	};
}

/**
 * The author band, with the portrait printed in grey ink like the rest of the page and set
 * whole at the foot of its plate, so a square picture fills the band's 3:4 frame uncropped.
 */
function Author(handle: Handle<{ copy: BookCopy }>) {
	return () => {
		let { author } = handle.props.copy;
		return (
			<AuthorBand
				id="author"
				ruled
				eyebrow="About the author"
				title={author.title}
				description={author.bio}
				portrait={
					<img
						src={author.photo}
						alt={`Portrait of ${author.name}`}
						mix={[
							raw({
								display: "block",
								inlineSize: "100%",
								blockSize: "100%",
								objectFit: "contain",
								objectPosition: "50% 100%",
								paddingBlockStart: "12%",
								backgroundColor: "var(--ui-neutral-bg-tint-hover)",
								filter: "grayscale(1) contrast(1.05)",
							}),
						]}
					/>
				}
				credentials={
					<ul
						mix={[
							m(0),
							p(0),
							raw({
								listStyle: "none",
								borderBlockStart: "1px solid var(--ui-marketing-hairline)",
							}),
							when(
								"& > li",
								raw({
									paddingBlock: "0.75rem",
									borderBlockEnd: "1px solid var(--ui-marketing-hairline)",
								}),
							),
							fg("neutral"),
						]}
					>
						{author.credentials.map((line) => (
							<li>{line}</li>
						))}
					</ul>
				}
				name={author.name}
				jobTitle={author.jobTitle}
				social={author.links}
			/>
		);
	};
}

/** Both packages at their live prices, the flagship first and in ink, then the upgrade path. */
function Pricing(handle: Handle<BookLanding.Props>) {
	return () => {
		let { book, copy, links, prices } = handle.props;
		let [flagship] = book.packages;

		return (
			<PricingBand
				id="pricing"
				tone="tinted"
				columns={2}
				eyebrow="Pricing"
				title={copy.pricing.title}
				description={
					<>
						{copy.pricing.description}
						{links.upgrade && (
							<>
								{" "}
								{copy.upgrade.title}{" "}
								<Link href={links.upgrade} color="neutral">
									{copy.upgrade.description}
								</Link>
							</>
						)}
					</>
				}
			>
				{book.packages.map((product) => {
					let pkg = copy.packages[product];
					let price = prices[product];
					let href = links.checkout[product];
					if (!pkg || !price || !href) return null;
					let featured = product === flagship;

					return (
						<PricingBand.Plan
							name={pkg.name}
							price={<Price price={price} />}
							period="one-time"
							featured={featured}
							badge={price.discounted ? <Badge color="brand">Launch price</Badge> : undefined}
							description={pkg.description}
							features={
								<>
									{pkg.features.map((feature) => (
										<CheckRow>{feature}</CheckRow>
									))}
								</>
							}
							action={
								<div mix={[grid()]}>
									<LinkButton
										href={href}
										color={featured ? "brand" : "neutral"}
										variant={featured ? undefined : "surface"}
										mix={[marketingCtaChrome()]}
									>
										{pkg.action}
									</LinkButton>
								</div>
							}
						/>
					);
				})}
			</PricingBand>
		);
	};
}

/** The questions, split into two exclusive accordions that sit side by side on a wide page. */
function Questions(handle: Handle<{ copy: BookCopy }>) {
	return () => {
		let { faq } = handle.props.copy;
		let half = Math.ceil(faq.length / 2);
		let columns = [faq.slice(0, half), faq.slice(half)];

		return (
			<FaqBand id="faq" columns={2} eyebrow="Questions" title="Before you buy">
				{columns.map((column) => (
					<Accordion>
						{column.map(([question, answer]) => (
							<Accordion.Item name="book-faq">
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
 * Renders the landing's `<main>`. The hero carries the only `h1`; every band titles at
 * `h2` and its cards at `h3`, so the outline follows the bands in order.
 *
 * @param handle Runtime handle carrying the book, its copy, prices and links.
 * @returns The render function producing the page's main content.
 */
export default function BookLanding(handle: Handle<BookLanding.Props>) {
	return () => {
		let { book, copy, from, links } = handle.props;
		let Cover = copy.Cover;
		let hasSample = Boolean(links.sample);
		let note: RemixNode = `${book.pages} pages · PDF and EPUB · one payment, yours to keep`;

		return (
			<main>
				<LandingHero
					id="top"
					tone="plain"
					mediaPlacement="end"
					entrance
					eyebrow={copy.hero.eyebrow}
					eyebrowVariant="mono"
					title={copy.hero.title}
					description={copy.hero.description}
					actions={<Actions from={from} sample={hasSample} />}
					note={note}
					proof={copy.quote ? <QuoteLine quote={copy.quote} /> : undefined}
					media={<Cover />}
				/>
				{links.sample && <Sample copy={copy} action={links.sample} />}
				<Inside copy={copy} />
				<Flow copy={copy} />
				<Author copy={copy} />
				<Pricing {...handle.props} />
				<Questions copy={copy} />
				<ClosingCta
					tone="plain"
					ruled
					eyebrow="The last page"
					title={copy.closing.title}
					description={copy.closing.description}
					actions={<Actions from={from} sample={hasSample} />}
				/>
			</main>
		);
	};
}
