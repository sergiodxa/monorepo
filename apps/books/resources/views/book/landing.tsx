/**
 * A book's landing, set as a printed page from `@sdxc/ui` landing patterns: the flat cover
 * beside the promise, the free chapter and its contents, the flow the book teaches played
 * step by step, its code, the author, both packages at live prices, the questions, a last page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EPUB } from "@sdxc/epub";
import type { Handle, RemixNode } from "remix/component";

import { ChevronDownIcon, KeyRoundIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { combine, raw } from "@sdxc/u/general";
import { grid, hstack, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { m, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";
import { Accordion, Badge, Link, LinkButton, MarketingHeader, MarketingSection } from "@sdxc/ui";
import {
	AuthorBand,
	CheckRow,
	ClosingCta,
	CodeStage,
	Curriculum,
	FaqBand,
	FeatureBand,
	FlowDiagram,
	LandingHero,
	PricingBand,
} from "@sdxc/ui/patterns";
import { marketingCtaChrome } from "@sdxc/ui/styles";

import type { Book } from "~/config/books";
import type { Product } from "~/config/products";
import type { BookCopy } from "~/resources/content/books";

import SamplePage from "~/resources/views/book/sample-page";
import EmailForm from "~/resources/views/site/email-form";

/** Name of the container the contents band's two columns query. */
const CONTENTS_CONTAINER = "book-contents";

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
		/** The free chapter's title and sections, when it could be read, for the contents band. */
		contents?: { title: string; sections: readonly EPUB.Section[] };
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
				ruled
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

/** How many subsections a section opens on, or nothing for a section without any. */
function partsLabel(count: number): string | undefined {
	if (count === 0) return undefined;
	return count === 1 ? "1 part" : `${count} parts`;
}

/**
 * The free chapter's contents, held at the start column beside its sections. Each section
 * opens on the subsections it covers, so a reader sees how far the free chapter goes.
 */
function Contents(
	handle: Handle<{ copy: BookCopy; title: string; sections: readonly EPUB.Section[] }>,
) {
	return () => {
		let { copy, sections, title } = handle.props;

		return (
			<MarketingSection id="contents" ruled>
				<div mix={[raw({ containerType: "inline-size", containerName: CONTENTS_CONTAINER })]}>
					<div
						mix={[
							grid(),
							combine([
								raw({ gap: "2.5rem", gridTemplateColumns: "minmax(0, 1fr)" }),
								at(
									"lg",
									CONTENTS_CONTAINER,
									raw({
										gap: "4rem",
										gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2fr)",
										alignItems: "start",
									}),
								),
							]),
						]}
					>
						<MarketingHeader
							eyebrow="Contents"
							description={copy.contents.description}
							mix={[
								combine([
									raw({ "--ui-marketing-header-end": "0" }),
									at(
										"lg",
										CONTENTS_CONTAINER,
										raw({ position: "sticky", insetBlockStart: "6rem" }),
									),
								]),
							]}
						>
							{copy.contents.title(sections.length)}
						</MarketingHeader>
						<Curriculum layout="stack">
							<Curriculum.Part title={title} meta="Free chapter">
								{sections.map((section, index) => (
									<Curriculum.Lesson
										number={String(index + 1).padStart(2, "0")}
										title={section.title}
										meta={partsLabel(section.sections?.length ?? 0)}
									>
										{section.sections?.length ? (
											<p mix={[m(0), fg("neutral")]}>
												{section.sections.map((child) => child.title).join(" · ")}
											</p>
										) : undefined}
									</Curriculum.Lesson>
								))}
							</Curriculum.Part>
						</Curriculum>
					</div>
				</div>
			</MarketingSection>
		);
	};
}

/**
 * The flow the book teaches, played as one sign-in step by step with the chapter's own code
 * lines, beside what the flow guarantees.
 */
function Flow(handle: Handle<{ copy: BookCopy }>) {
	return () => {
		let { diagram, ...flow } = handle.props.copy.flow;
		return (
			<FeatureBand
				id="flow"
				layout="split"
				lean="media"
				ruled
				eyebrow="How it works"
				title={flow.title}
				description={flow.description}
				media={
					<FlowDiagram
						aria-label={diagram.label}
						pauseLabel="Pause the sign-in"
						trigger={{ icon: <KeyRoundIcon size={14} />, ...diagram.trigger }}
						steps={diagram.steps}
						outcome={diagram.outcome}
						footnote={diagram.footnote}
					/>
				}
			>
				<ul>
					{flow.guarantees.map((line) => (
						<li>{line}</li>
					))}
				</ul>
			</FeatureBand>
		);
	};
}

/** What the book holds, as claims beside the chapter's own code in tabs. */
function Inside(handle: Handle<{ copy: BookCopy; pages: number }>) {
	return () => {
		let { inside } = handle.props.copy;
		return (
			<FeatureBand
				id="inside"
				layout="split"
				lean="media"
				ruled
				eyebrow="What’s inside"
				title={inside.title(handle.props.pages)}
				description={inside.description}
				media={
					<CodeStage
						variant="code"
						name="book-inside-code"
						title="pkce.ts"
						tabs={inside.samples.map((sample) => ({
							label: sample.label,
							content: sample.code,
							language: sample.language,
						}))}
					/>
				}
			>
				<dl mix={[m(0), vstack({ gap: 4, align: "stretch" })]}>
					{inside.claims.map((claim) => (
						<div mix={[vstack({ gap: 1, align: "stretch" })]}>
							<dt mix={[weight("semibold"), fg("neutral.emphasis")]}>{claim.title}</dt>
							<dd mix={[m(0), fg("neutral")]}>{claim.body}</dd>
						</div>
					))}
				</dl>
			</FeatureBand>
		);
	};
}

/**
 * The author band, with the portrait in its own colours, set whole at the foot of its plate
 * so a square picture fills the band's 3:4 frame uncropped.
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
				ruled
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
			<FaqBand id="faq" ruled columns={2} eyebrow="Questions" title="What readers ask first">
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
		let { book, contents, copy, from, links } = handle.props;
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
				{contents && <Contents copy={copy} title={contents.title} sections={contents.sections} />}
				<Flow copy={copy} />
				<Inside copy={copy} pages={book.pages} />
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
