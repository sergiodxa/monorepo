/**
 * Live example for the framed `ruled` grid and the scrolling `marquee` layout of
 * `LogoCloud`, the two walls a long customer list reaches for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { LogoCloud } from "@sdxc/ui";

import { Wordmark, WORDMARKS } from "~/resources/components/demo-media";

/** The source the page shows, matching the markup below. */
const CODE = `<LogoCloud layout="ruled" muted>{marks}</LogoCloud>

<LogoCloud layout="marquee" muted>{marks}</LogoCloud>`;

/** What the preview registry reads: the title, the source to show, and the walls to draw. */
export default {
	title: "Ruled grid and marquee",
	code: CODE,
	render: () => (
		<div mix={[is("full"), vstack({ gap: 12, align: "stretch" })]}>
			<LogoCloud layout="ruled" muted>
				{[...WORDMARKS, WORDMARKS[0]!].map((mark, index) => (
					<Wordmark key={`${mark.name}-${index}`} name={mark.name} glyph={mark.glyph} />
				))}
			</LogoCloud>
			<LogoCloud layout="marquee" muted>
				{WORDMARKS.map((mark) => (
					<Wordmark key={mark.name} name={mark.name} glyph={mark.glyph} />
				))}
			</LogoCloud>
		</div>
	),
};
