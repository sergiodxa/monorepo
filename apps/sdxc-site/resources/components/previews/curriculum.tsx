/**
 * Live preview for `Curriculum`: a typography book's three parts side by side under its
 * totals, with a free sample chapter, a preview, and lessons that open onto their
 * subtopics; on a phone the parts stack.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { Link, MarketingHeader, MarketingSection, StatStrip } from "@sdxc/ui";
import { CheckList, CheckRow, Curriculum } from "@sdxc/ui/patterns";

/** The source the page shows, matching the markup below. */
const CODE = `<Curriculum
	summary={
		<StatStrip>
			<StatStrip.Item label="Chapters">12</StatStrip.Item>
			<StatStrip.Item label="Pages">286</StatStrip.Item>
			<StatStrip.Item label="Videos">18</StatStrip.Item>
			<StatStrip.Item label="Hours of video">4.5</StatStrip.Item>
		</StatStrip>
	}
>
	<Curriculum.Part title="Foundations" meta="4 chapters · 86 pages">
		<Curriculum.Lesson number="01" title="Why type is code" meta="18 pages" badge="Free">
			<CheckList>
				<CheckRow>Glyphs, fonts and the files that carry them</CheckRow>
				<CheckRow>What a browser does between bytes and pixels</CheckRow>
			</CheckList>
			<Link href="/sample.pdf">Read the chapter</Link>
		</Curriculum.Lesson>
		<Curriculum.Lesson number="02" title="The measure" meta="22 pages" />
		…
	</Curriculum.Part>
	<Curriculum.Part title="Systems" meta="4 chapters · 104 pages">…</Curriculum.Part>
	<Curriculum.Part title="Shipping" meta="4 chapters · 96 pages">…</Curriculum.Part>
</Curriculum>

<Curriculum layout="stack">…</Curriculum>`;

/** One lesson's shape in the preview's data. */
interface Lesson {
	number: string;
	title: string;
	meta: string;
	badge?: string;
	topics?: readonly string[];
}

/** One part's shape in the preview's data. */
interface Part {
	title: string;
	meta: string;
	lessons: readonly Lesson[];
}

/** The book's contents. */
const PARTS: readonly Part[] = [
	{
		title: "Foundations",
		meta: "4 chapters · 86 pages",
		lessons: [
			{
				number: "01",
				title: "Why type is code",
				meta: "18 pages",
				badge: "Free",
				topics: [
					"Glyphs, fonts and the files that carry them",
					"What a browser does between bytes and pixels",
				],
			},
			{
				number: "02",
				title: "The measure",
				meta: "22 pages",
				topics: ["Characters per line", "When a column is too wide"],
			},
			{ number: "03", title: "Vertical rhythm and the baseline grid", meta: "24 pages" },
			{ number: "04", title: "Pairing", meta: "22 pages" },
		],
	},
	{
		title: "Systems",
		meta: "4 chapters · 104 pages",
		lessons: [
			{
				number: "05",
				title: "Modular scales that survive a redesign",
				meta: "28 pages",
				badge: "Preview",
				topics: ["Ratios and steps", "Fluid sizes with clamp()"],
			},
			{ number: "06", title: "Tokens", meta: "24 pages" },
			{ number: "07", title: "Spacing", meta: "26 pages" },
			{ number: "08", title: "Dark mode", meta: "26 pages" },
		],
	},
	{
		title: "Shipping",
		meta: "4 chapters · 96 pages",
		lessons: [
			{
				number: "09",
				title: "Variable fonts",
				meta: "26 pages",
				topics: ["Axes and instances", "Subsetting for the web"],
			},
			{ number: "10", title: "Loading without layout shift", meta: "22 pages" },
			{ number: "11", title: "Accessibility", meta: "24 pages" },
			{ number: "12", title: "Auditing a live site", meta: "24 pages" },
		],
	},
];

/** Props for {@link Contents}. */
interface ContentsProps {
	layout: Curriculum.Layout;
}

/**
 * The curriculum in one arrangement: totals above, then every part and lesson from {@link PARTS}.
 *
 * @param handle Runtime handle carrying the arrangement.
 * @returns The render function producing the curriculum.
 */
function Contents(handle: Handle<ContentsProps>) {
	return () => (
		<Curriculum
			layout={handle.props.layout}
			summary={
				<StatStrip>
					<StatStrip.Item label="Chapters">12</StatStrip.Item>
					<StatStrip.Item label="Pages">286</StatStrip.Item>
					<StatStrip.Item label="Videos">18</StatStrip.Item>
					<StatStrip.Item label="Hours of video">4.5</StatStrip.Item>
				</StatStrip>
			}
		>
			{PARTS.map((part) => (
				<Curriculum.Part key={part.title} title={part.title} meta={part.meta}>
					{part.lessons.map((lesson) => (
						<Curriculum.Lesson
							key={lesson.number}
							number={lesson.number}
							title={lesson.title}
							meta={lesson.meta}
							badge={lesson.badge}
						>
							{lesson.topics ? (
								<>
									<CheckList>
										{lesson.topics.map((topic) => (
											<CheckRow key={topic}>{topic}</CheckRow>
										))}
									</CheckList>
									{lesson.badge ? (
										<p>
											<Link href="/examples/sample">Read the chapter</Link>
										</p>
									) : null}
								</>
							) : null}
						</Curriculum.Lesson>
					))}
				</Curriculum.Part>
			))}
		</Curriculum>
	);
}

/** What the preview registry reads: the source to show, and the two arrangements to draw. */
export default {
	code: CODE,
	viewports: true,
	render: () => (
		<>
			<MarketingSection>
				<MarketingHeader
					eyebrow="What's inside"
					description="Three parts, read in order or dipped into."
				>
					Twelve chapters from the glyph to the shipped page
				</MarketingHeader>
				<Contents layout="columns" />
			</MarketingSection>
			<MarketingSection tone="tinted">
				<MarketingHeader eyebrow="Stacked">
					The same course, one part under the other
				</MarketingHeader>
				<Contents layout="stack" />
			</MarketingSection>
		</>
	),
};
