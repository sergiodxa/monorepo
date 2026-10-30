/**
 * The proof band under the hero: four figures about the book and three jacket blurbs from
 * people a reader of it would know, so the claim above is backed before the page explains
 * what is inside.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { combine, raw } from "@sdxc/u/general";
import { grid, gridTemplate, repeat, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { is, m } from "@sdxc/u/size";
import { font, leading, pretty, text, textAlign, weight } from "@sdxc/u/typography";
import { StatStrip } from "@sdxc/ui";
import { ProofStrip } from "@sdxc/ui/patterns";

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
] as const;

/**
 * Renders the figures as one ruled row and the blurbs in three columns from the `lg`
 * container, set in the display face so they read as quotations from the jacket.
 *
 * @returns The render function producing the proof band.
 */
export default function BookProof() {
	return () => (
		<ProofStrip>
			<StatStrip align="center">
				<StatStrip.Item label="Readers since the first edition">18,400</StatStrip.Item>
				<StatStrip.Item label="Average from 1,260 reviews">4.9/5</StatStrip.Item>
				<StatStrip.Item label="Pages in fourteen chapters">312</StatStrip.Item>
				<StatStrip.Item label="Hours of video lessons">6.5</StatStrip.Item>
			</StatStrip>
			<div
				mix={[
					grid(),
					is("100%"),
					combine([
						raw({ gap: "2rem" }),
						gridTemplate({ columns: "minmax(0, 1fr)" }),
						at("lg", raw({ gap: "3rem", gridTemplateColumns: repeat(3, "minmax(0, 1fr)") })),
					]),
				]}
			>
				{BLURBS.map(([quote, name, title]) => (
					<figure key={name} mix={[m(0), vstack({ gap: 3, align: "center" }), textAlign("center")]}>
						<blockquote
							mix={[
								m(0),
								font("display"),
								text("lg"),
								leading("snug"),
								pretty(),
								fg("neutral.emphasis"),
							]}
						>
							“{quote}”
						</blockquote>
						<figcaption mix={[text("sm"), fg("neutral.muted")]}>
							<span mix={[weight("semibold"), fg("neutral.emphasis")]}>{name}</span>, {title}
						</figcaption>
					</figure>
				))}
			</div>
		</ProofStrip>
	);
}
