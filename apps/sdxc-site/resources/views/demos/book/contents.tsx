/**
 * The table of contents, set as the printed book sets it: the band's title held at the
 * start column while the three parts run down the other, each chapter a row with its
 * number, title and opening page that opens on a summary and the videos that go with it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { combine, raw } from "@sdxc/u/general";
import { container, grid } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { m } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { MarketingHeader, MarketingSection } from "@sdxc/ui";
import { Curriculum } from "@sdxc/ui/patterns";

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

/** Pages of front matter before chapter 1 opens. */
const FRONT_MATTER = 12;

/** Name of the container the band's two columns query. */
const CONTAINER_NAME = "book-contents";

/** The chapter whose row carries the free-chapter badge. */
const FREE_CHAPTER = 2;

/**
 * Renders the contents on a ruled band. From the `lg` container the header holds the
 * start third and stays in view while the parts scroll past it; below, the header sits
 * above the parts. Page numbers run on from the front matter, as in the printed book.
 *
 * @returns The render function producing the band.
 */
export default function BookContents() {
	return () => {
		let chapterNumber = 0;
		let page = FRONT_MATTER;

		return (
			<MarketingSection id="contents" ruled>
				<div mix={[container(CONTAINER_NAME)]}>
					<div
						mix={[
							grid(),
							combine([
								raw({ gap: "2.5rem", gridTemplateColumns: "minmax(0, 1fr)" }),
								at(
									"lg",
									CONTAINER_NAME,
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
							description={
								<>
									312 pages in three parts, read in order or by the problem in front of you. Every
									chapter has <strong>its own video lessons</strong> in the complete edition.
								</>
							}
							mix={[
								combine([
									raw({ "--ui-marketing-header-end": "0" }),
									at("lg", CONTAINER_NAME, raw({ position: "sticky", insetBlockStart: "6rem" })),
								]),
							]}
						>
							Three parts, fourteen chapters
						</MarketingHeader>
						<Curriculum layout="stack">
							{PARTS.map((part) => (
								<Curriculum.Part
									key={part.numeral}
									title={`${part.numeral}: ${part.title}`}
									meta={`${part.chapters.length} chapters`}
								>
									{part.chapters.map((chapter) => {
										chapterNumber += 1;
										let opens = page + 1;
										page += chapter.pages;
										return (
											<Curriculum.Lesson
												key={chapter.title}
												number={String(chapterNumber).padStart(2, "0")}
												title={chapter.title}
												meta={`p. ${opens}`}
												badge={chapterNumber === FREE_CHAPTER ? "Free" : undefined}
											>
												<p mix={[m(0), fg("neutral")]}>{chapter.summary}</p>
												<p mix={[m(0), text("sm"), fg("neutral.muted")]}>
													{chapter.pages} pages · {chapter.lessons} video lessons
												</p>
											</Curriculum.Lesson>
										);
									})}
								</Curriculum.Part>
							))}
						</Curriculum>
					</div>
				</div>
			</MarketingSection>
		);
	};
}
