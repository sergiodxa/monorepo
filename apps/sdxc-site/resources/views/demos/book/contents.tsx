/**
 * The table of contents: the book's three parts side by side, each a timeline of its
 * chapters with the chapter number, page count and lesson count above the title, so a
 * reader scans it the way they would the contents page of the printed book.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { combine, raw } from "@sdxc/u/general";
import { container, grid, gridTemplate, repeat, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { m } from "@sdxc/u/size";
import { font, leading, text, tracking, weight } from "@sdxc/u/typography";
import { Heading, HeadingScope, MarketingHeader, MarketingSection } from "@sdxc/ui";
import { StepList } from "@sdxc/ui/patterns";

/** One chapter: its title, a line on what it covers, its pages and its video lessons. */
interface Chapter {
	title: string;
	summary: string;
	pages: number;
	lessons: number;
}

/** One part of the book and the chapters it holds. */
interface Part {
	numeral: string;
	title: string;
	chapters: readonly Chapter[];
}

/** The book's parts in reading order; chapter numbers run on across parts. */
const PARTS: readonly Part[] = [
	{
		numeral: "Part I",
		title: "Reading",
		chapters: [
			{
				title: "How people actually read",
				summary: "Saccades, fixations and why the eye hates a long line.",
				pages: 18,
				lessons: 2,
			},
			{
				title: "The measure",
				summary: "Line length in ch, and columns that keep it.",
				pages: 24,
				lessons: 3,
			},
			{
				title: "Leading and line height",
				summary: "Unitless values, and why headings need less.",
				pages: 20,
				lessons: 3,
			},
			{
				title: "Rag, hyphens and widows",
				summary: "text-wrap, hyphenation and a cleaner right edge.",
				pages: 22,
				lessons: 3,
			},
			{
				title: "Contrast and weight",
				summary: "Readable greys, dark mode and optical weight.",
				pages: 20,
				lessons: 2,
			},
		],
	},
	{
		numeral: "Part II",
		title: "Structure",
		chapters: [
			{
				title: "A scale that holds",
				summary: "Ratios, fluid steps and when to stop adding sizes.",
				pages: 26,
				lessons: 3,
			},
			{
				title: "Vertical rhythm",
				summary: "Spacing from the line height, without a framework.",
				pages: 22,
				lessons: 3,
			},
			{
				title: "Headings that lead",
				summary: "Hierarchy by size, weight, space and nothing else.",
				pages: 20,
				lessons: 2,
			},
			{
				title: "Lists, tables and numbers",
				summary: "Tabular figures, alignment and readable data.",
				pages: 24,
				lessons: 3,
			},
			{
				title: "Long-form layouts",
				summary: "Articles, docs and the margins that hold them.",
				pages: 22,
				lessons: 3,
			},
		],
	},
	{
		numeral: "Part III",
		title: "Delivery",
		chapters: [
			{
				title: "Choosing typefaces",
				summary: "Reading a specimen and testing at real sizes.",
				pages: 24,
				lessons: 3,
			},
			{
				title: "Pairing without guessing",
				summary: "Shared skeletons, contrast and the one-family option.",
				pages: 18,
				lessons: 2,
			},
			{
				title: "Loading fonts fast",
				summary: "Subsets, preloads and metric-matched fallbacks.",
				pages: 26,
				lessons: 3,
			},
			{
				title: "Type in interfaces",
				summary: "Labels, buttons, dense tables and small sizes.",
				pages: 26,
				lessons: 3,
			},
		],
	},
];

/** Name of the container the parts' columns query. */
const CONTAINER_NAME = "book-contents";

/**
 * Renders the contents on a tinted band: one column per part from the `lg` container up,
 * stacked below it. The part title takes the next heading level and each chapter the one
 * under it, so the outline matches the printed contents page.
 *
 * @returns The render function producing the band.
 */
export default function BookContents() {
	return () => {
		let chapterNumber = 0;

		return (
			<MarketingSection id="contents" tone="tinted">
				<HeadingScope>
					<MarketingHeader
						eyebrow="Table of contents"
						description={
							<>
								312 pages in three parts, read in order or by the problem in front of you. Every
								chapter has <strong>its own video lessons</strong> in the complete edition.
							</>
						}
					>
						Three parts, fourteen chapters
					</MarketingHeader>
					<div mix={[container(CONTAINER_NAME)]}>
						<div
							mix={[
								grid(),
								combine([
									raw({ gap: "3rem" }),
									gridTemplate({ columns: "minmax(0, 1fr)" }),
									at(
										"lg",
										CONTAINER_NAME,
										raw({ gridTemplateColumns: repeat(3, "minmax(0, 1fr)") }),
									),
								]),
							]}
						>
							{PARTS.map((part) => (
								<HeadingScope key={part.numeral}>
									<div mix={[vstack({ gap: 6, align: "stretch" })]}>
										<div mix={[vstack({ gap: 1, align: "stretch" })]}>
											<p
												mix={[
													m(0),
													font("mono"),
													text("xs"),
													weight("semibold"),
													tracking("widest"),
													raw({ textTransform: "uppercase" }),
													fg("brand"),
												]}
											>
												{part.numeral}
											</p>
											<Heading>
												<span
													mix={[
														font("display"),
														raw({ fontSize: "1.75rem", fontWeight: "400" }),
														leading("tight"),
													]}
												>
													{part.title}
												</span>
											</Heading>
										</div>
										<HeadingScope>
											<StepList variant="timeline">
												{part.chapters.map((chapter) => {
													chapterNumber += 1;
													return (
														<StepList.Item
															key={chapter.title}
															meta={`Chapter ${String(chapterNumber).padStart(2, "0")} · ${chapter.pages} pages · ${chapter.lessons} videos`}
															title={chapter.title}
														>
															{chapter.summary}
														</StepList.Item>
													);
												})}
											</StepList>
										</HeadingScope>
									</div>
								</HeadingScope>
							))}
						</div>
					</div>
				</HeadingScope>
			</MarketingSection>
		);
	};
}
