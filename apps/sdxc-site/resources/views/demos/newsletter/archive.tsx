/**
 * The archive by topic: every subject Undercurrent has written about, each with its count
 * and its most recent letters, folded into native disclosures so sixty-three issues fit in
 * one quiet screen and open without script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ChevronDownIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { m, p } from "@sdxc/u/size";
import { focusVisible, when } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";
import { Link } from "@sdxc/ui";
import { LandingHeader, LandingSection } from "@sdxc/ui/landing";

import { renderNearView } from "~/resources/views/demos/near-view";

/** One topic: its name, how many letters it holds, and the latest three, newest first. */
interface Topic {
	name: string;
	slug: string;
	count: number;
	issues: ReadonlyArray<readonly [number, string]>;
}

/** The topics, largest first; the counts add up to the sixty-three letters sent so far. */
const TOPICS: readonly Topic[] = [
	{
		name: "Water",
		slug: "water",
		count: 15,
		issues: [
			[63, "The pressure at the top of the hill"],
			[57, "Where the rain goes after the drain"],
			[49, "Reading a water bill line by line"],
		],
	},
	{
		name: "Power",
		slug: "power",
		count: 12,
		issues: [
			[60, "The substation behind the bakery"],
			[54, "Why the grid hums at fifty hertz"],
			[46, "Who decides when the streetlights come on"],
		],
	},
	{
		name: "Streets and signals",
		slug: "streets",
		count: 11,
		issues: [
			[62, "Who repaints the lines"],
			[55, "The traffic light that knows you are waiting"],
			[44, "A short history of the kerb"],
		],
	},
	{
		name: "Post and parcels",
		slug: "post",
		count: 9,
		issues: [
			[61, "A night at the sorting office"],
			[51, "How a postcode is drawn"],
			[38, "The last mile is uphill"],
		],
	},
	{
		name: "Waste",
		slug: "waste",
		count: 9,
		issues: [
			[58, "What the recycling lorry weighs"],
			[47, "A landfill with a five-hundred-year plan"],
			[35, "The sewer that runs under the market"],
		],
	},
	{
		name: "Wires and signals",
		slug: "wires",
		count: 7,
		issues: [
			[59, "The cable that crosses the harbour"],
			[48, "Why the phone mast is disguised as a tree"],
			[31, "Dialling the emergency line from a lift"],
		],
	},
];

/**
 * Renders each topic as a `<details>` whose summary carries its name and count, the first
 * one open so the archive shows what it holds before anyone presses anything.
 *
 * @returns The render function producing the band.
 */
export default function NewsletterArchive() {
	return () => (
		<LandingSection id="archive" ruled mix={[renderNearView(700, 820)]}>
			<LandingHeader
				eyebrow="The archive"
				description={
					<>
						Sixty-three letters since 2024, every one free to read and{" "}
						<strong>every one with its episode</strong>. Start with the subject you walk past most.
					</>
				}
			>
				Sixty-three letters, six subjects
			</LandingHeader>
			<div
				mix={[
					raw({
						marginBlockStart: "2rem",
						borderBlockStart: "1px solid var(--ui-landing-hairline)",
					}),
				]}
			>
				{TOPICS.map((topic, index) => (
					<details
						key={topic.slug}
						id={`archive-${topic.slug}`}
						open={index === 0}
						mix={[
							raw({ borderBlockEnd: "1px solid var(--ui-landing-hairline)" }),
							when("&[open] [data-slot='archive-chevron']", raw({ transform: "rotate(180deg)" })),
						]}
					>
						<summary
							mix={[
								raw({
									display: "flex",
									alignItems: "baseline",
									gap: "1rem",
									paddingBlock: "0.875rem",
									cursor: "pointer",
									listStyle: "none",
								}),
								when("&::-webkit-details-marker", raw({ display: "none" })),
								focusVisible(raw({ outline: "2px solid var(--ui-brand-fg)" })),
							]}
						>
							<span mix={[weight("medium"), fg("neutral.emphasis"), raw({ flex: "1" })]}>
								{topic.name}
							</span>
							<span
								mix={[text("sm"), fg("neutral.muted"), raw({ fontVariantNumeric: "tabular-nums" })]}
							>
								{topic.count} letters
							</span>
							<ChevronDownIcon
								data-slot="archive-chevron"
								aria-hidden="true"
								mix={[
									fg("neutral.muted"),
									raw({
										inlineSize: "1rem",
										blockSize: "1rem",
										flexShrink: "0",
										alignSelf: "center",
										transition: "transform 150ms ease",
										"@media (prefers-reduced-motion: reduce)": { transition: "none" },
									}),
								]}
							/>
						</summary>
						<ol mix={[m(0), p(0), raw({ listStyle: "none", paddingBlockEnd: "1rem" })]}>
							{topic.issues.map(([number, title]) => (
								<li
									key={number}
									mix={[
										raw({
											display: "grid",
											gridTemplateColumns: "2.5rem minmax(0, 1fr)",
											paddingBlock: "0.25rem",
										}),
									]}
								>
									<span mix={[fg("neutral.muted"), raw({ fontVariantNumeric: "tabular-nums" })]}>
										{number}
									</span>
									<Link href={`/examples/newsletter/letters/${number}`} color="neutral">
										{title}
									</Link>
								</li>
							))}
							<li mix={[raw({ paddingBlockStart: "0.5rem", paddingInlineStart: "2.5rem" })]}>
								<Link
									href={`/examples/newsletter/topics/${topic.slug}`}
									mix={[text("sm"), weight("medium")]}
								>
									All {topic.count} on {topic.name.toLowerCase()}
								</Link>
							</li>
						</ol>
					</details>
				))}
			</div>
		</LandingSection>
	);
}
