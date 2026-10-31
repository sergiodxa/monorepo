/**
 * The unlocked free chapter, set for long reading: a title page with the reading time and
 * the EPUB, the chapter at a 20px body and a printed measure, its sections listed beside it
 * from a wide screen (folded above it on a phone), and the way to the whole book at the end.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EPUB } from "@sdxc/epub";
import type { Handle, RemixNode } from "remix/component";

import { DownloadIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { combine, raw } from "@sdxc/u/general";
import { grid, hstack, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { m, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { font, text, tracking, weight } from "@sdxc/u/typography";
import { Link, LinkButton, MarketingHeader, MarketingSection, Typeset } from "@sdxc/ui";
import { ClosingCta } from "@sdxc/ui/patterns";
import { marketingCtaChrome } from "@sdxc/ui/styles";

export namespace ChapterView {
	export interface Props {
		/** The book the chapter is from, by its short title, named in the eyebrow. */
		bookTitle: string;
		/** The chapter's own title, the page's `h1`. */
		title: string;
		/** The rendered chapter, without its own title heading. */
		chapter: RemixNode;
		/** The chapter's sections, nested as its headings are, each with its anchor. */
		sections: readonly EPUB.Section[];
		/** Minutes the chapter takes to read, from its word count. */
		minutes: number;
		/** The signed, short-lived link to the chapter as an EPUB, when one could be minted. */
		download?: string;
		/** The file name the EPUB saves as. */
		filename: string;
		/** Where the closing band's buy button points: the landing's pricing. */
		pricing: string;
	}
}

/** Name of the container the reading grid queries, so the table of contents joins at `lg`. */
const CONTAINER = "book-chapter";

/** The sections as a nested list of links, the chapter's own outline. */
function Contents(handle: Handle<{ sections: readonly EPUB.Section[] }>) {
	return () => (
		<ol
			mix={[
				m(0),
				p(0),
				vstack({ gap: 2, align: "stretch" }),
				raw({ listStyle: "none" }),
				text("sm"),
				when("& ol", raw({ listStyle: "none", margin: "0.5rem 0 0", padding: "0 0 0 0.875rem" })),
				when(
					"& a",
					raw({
						color: "var(--ui-neutral-fg)",
						textDecoration: "none",
						display: "block",
						paddingBlock: "0.125rem",
					}),
				),
				when("& a:hover", raw({ color: "var(--ui-brand-fg)" })),
				when("& ol a", raw({ color: "var(--ui-neutral-fg-muted)" })),
			]}
		>
			{handle.props.sections.map((section) => (
				<li>
					<a href={`#${section.fragment}`}>{section.title}</a>
					{section.sections && section.sections.length > 0 && (
						<ol mix={[vstack({ gap: 1.5, align: "stretch" })]}>
							{section.sections.map((child) => (
								<li>
									<a href={`#${child.fragment}`}>{child.title}</a>
								</li>
							))}
						</ol>
					)}
				</li>
			))}
		</ol>
	);
}

/** The small-caps label that heads the table of contents in both of its forms. */
function ContentsLabel() {
	return () => (
		<span
			mix={[
				text("xs"),
				tracking("widest"),
				weight("medium"),
				fg("brand"),
				raw({ textTransform: "uppercase" }),
			]}
		>
			In this chapter
		</span>
	);
}

/**
 * Renders the page's `<main>`. Headings in the chapter carry ids, so the contents link to
 * them and a sticky header never covers the one a reader jumps to.
 *
 * @param handle Runtime handle carrying the chapter, its outline and its links.
 * @returns The render function producing the page's main content.
 */
export default function ChapterView(handle: Handle<ChapterView.Props>) {
	return () => {
		let { bookTitle, chapter, download, filename, minutes, pricing, sections, title } =
			handle.props;

		return (
			<main>
				<MarketingSection id="chapter" level={1} spacing="compact">
					<div mix={[vstack({ gap: 8, align: "stretch" })]}>
						<MarketingHeader
							eyebrow={`Free chapter · ${bookTitle}`}
							description={
								<>
									{minutes} minute read, {sections.length} sections.{" "}
									{download && <>The EPUB works on Kindle, Kobo, Apple Books or any reading app.</>}
								</>
							}
							mix={[raw({ "--ui-marketing-header-end": "0" })]}
						>
							{title}
						</MarketingHeader>
						{download && (
							<div mix={[vstack({ gap: 2, align: "start" })]}>
								<LinkButton
									href={download}
									download={filename}
									variant="surface"
									mix={[marketingCtaChrome()]}
								>
									<DownloadIcon aria-hidden="true" />
									Download the EPUB
								</LinkButton>
								<span mix={[text("sm"), fg("neutral.muted")]}>The link works for an hour.</span>
							</div>
						)}
					</div>
				</MarketingSection>

				<MarketingSection ruled spacing="compact" aria-label={title}>
					<div mix={[raw({ containerType: "inline-size", containerName: CONTAINER })]}>
						<div
							mix={[
								grid(),
								combine([
									raw({ gap: "2rem", gridTemplateColumns: "minmax(0, 1fr)" }),
									at(
										"lg",
										CONTAINER,
										raw({
											gap: "4rem",
											gridTemplateColumns: "14rem minmax(0, 44rem)",
											alignItems: "start",
										}),
									),
								]),
							]}
						>
							<details
								mix={[
									combine([
										raw({
											borderBlock: "1px solid var(--ui-marketing-hairline)",
											paddingBlock: "1rem",
										}),
										at("lg", CONTAINER, raw({ display: "none" })),
									]),
									when("& > summary", raw({ cursor: "pointer", listStyle: "none" })),
									when("& > summary::-webkit-details-marker", raw({ display: "none" })),
								]}
							>
								<summary mix={[hstack({ gap: 2, justify: "between" })]}>
									<ContentsLabel />
									<span mix={[fg("neutral.muted"), text("sm")]}>{sections.length} sections</span>
								</summary>
								<nav aria-label="In this chapter" mix={[raw({ paddingBlockStart: "1rem" })]}>
									<Contents sections={sections} />
								</nav>
							</details>

							<nav
								aria-label="In this chapter"
								mix={[
									combine([
										raw({ display: "none" }),
										at(
											"lg",
											CONTAINER,
											raw({
												display: "flex",
												flexDirection: "column",
												gap: "1rem",
												position: "sticky",
												insetBlockStart: "6rem",
												maxBlockSize: "calc(100dvh - 8rem)",
												overflowY: "auto",
												paddingBlockStart: "1rem",
												borderBlockStart: "1px solid var(--ui-marketing-hairline)",
											}),
										),
									]),
								]}
							>
								<ContentsLabel />
								<Contents sections={sections} />
							</nav>

							<Typeset
								preset="reading"
								mix={[
									font("display"),
									when(
										"& :is(h2, h3)",
										raw({ fontFamily: "var(--ui-font-display)", scrollMarginBlockStart: "5.5rem" }),
									),
									when("& :is(h2, h3)", raw({ fontWeight: "500" })),
									when("& h2", raw({ letterSpacing: "-0.015em" })),
									when("& pre, & code", raw({ fontFamily: "var(--ui-font-mono)" })),
									when("& a", raw({ color: "var(--ui-brand-fg)" })),
								]}
							>
								{chapter}
							</Typeset>
						</div>
					</div>
				</MarketingSection>

				<ClosingCta
					tone="tinted"
					eyebrow="Keep reading"
					title="The rest is in the handbook"
					description="Every chapter, the example app and the community, for one payment."
					actions={
						<>
							<LinkButton href={pricing} color="brand" mix={[marketingCtaChrome()]}>
								See the packages
							</LinkButton>
							{download && (
								<Link href={download} download={filename} color="neutral" mix={[weight("medium")]}>
									Download this chapter
								</Link>
							)}
						</>
					}
				/>
			</main>
		);
	};
}
