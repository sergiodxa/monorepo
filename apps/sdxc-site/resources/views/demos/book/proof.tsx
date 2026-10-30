/**
 * The jacket band: four figures and the four blurbs from the book's back cover, set in
 * the same four ruled columns so each quotation reads under its figure, as a jacket
 * stacks its praise. Four of each keeps a phone's two-up figures in whole rows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { combine, raw } from "@sdxc/u/general";
import { container, grid, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { m, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { leading, pretty, text, weight } from "@sdxc/u/typography";
import { MarketingSection, StatStrip } from "@sdxc/ui";

/** Each blurb: the line, who wrote it, and what they do. */
const BLURBS = [
	[
		"The first typography book I have handed to an engineer without an apology.",
		"Priya Raman",
		"Design systems lead, Halden",
	],
	[
		"Odile explains in a page what took me ten years of squinting at proofs.",
		"Tomás Ferreira",
		"Type designer, Ferreira Type",
	],
	[
		"Every chapter ends in code, and every line of that code earns its place.",
		"Hannah Okafor",
		"Author of Layouts That Last",
	],
	[
		"A rare book that makes you slower to ship and better at it.",
		"Samuel Ito",
		"Editor, Margin & Gutter",
	],
] as const;

/** Container the blurb columns query; it matches the strip's own, so both switch together. */
const CONTAINER_NAME = "book-blurbs";

/**
 * The blurbs' grid, on the strip's geometry: one column on a phone, then equal ruled
 * columns with the strip's cell padding from `lg`, so every quotation starts on the same
 * edge as the figure above it.
 */
function blurbColumns() {
	return combine([
		grid(),
		raw({ gap: "0", gridTemplateColumns: "minmax(0, 1fr)" }),
		when("& > *", [p(6, 5), at("lg", CONTAINER_NAME, p(8, 8))]),
		at(
			"lg",
			CONTAINER_NAME,
			raw({
				gridTemplateColumns: "none",
				gridAutoFlow: "column",
				gridAutoColumns: "minmax(0, 1fr)",
			}),
		),
		when(
			"& > * + *",
			combine([
				raw({ borderBlockStart: "1px solid var(--ui-marketing-hairline)" }),
				at(
					"lg",
					CONTAINER_NAME,
					raw({
						borderBlockStart: "0",
						borderInlineStart: "1px solid var(--ui-marketing-hairline)",
					}),
				),
			]),
		),
	]);
}

/**
 * Renders the figures over the blurbs on a ruled band, both start-aligned. The quotations
 * are italic, the jacket's voice, with each name and credit beneath in roman.
 *
 * @returns The render function producing the band.
 */
export default function BookProof() {
	return () => (
		<MarketingSection id="praise" spacing="compact" ruled aria-label="Praise for The Measure">
			<StatStrip variant="ruled" size="display" align="start">
				<StatStrip.Item label="Readers since the first edition">18,400</StatStrip.Item>
				<StatStrip.Item label="Average from 1,260 reviews">4.9</StatStrip.Item>
				<StatStrip.Item label="Pages in fourteen chapters">312</StatStrip.Item>
				<StatStrip.Item label="Hours of video lessons">6.5</StatStrip.Item>
			</StatStrip>
			<div
				mix={[
					container(CONTAINER_NAME),
					raw({ borderBlockStart: "1px solid var(--ui-marketing-hairline)" }),
				]}
			>
				<div mix={[blurbColumns()]}>
					{BLURBS.map(([quote, name, title]) => (
						<figure key={name} mix={[m(0), vstack({ gap: 4, align: "start" })]}>
							<blockquote
								mix={[
									m(0),
									text("lg"),
									leading("snug"),
									pretty(),
									fg("neutral.emphasis"),
									raw({ fontStyle: "italic" }),
								]}
							>
								“{quote}”
							</blockquote>
							<figcaption mix={[text("sm"), fg("neutral")]}>
								<span mix={[weight("semibold"), fg("neutral.emphasis")]}>{name}</span>, {title}
							</figcaption>
						</figure>
					))}
				</div>
			</div>
		</MarketingSection>
	);
}
