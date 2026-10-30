/**
 * Live example for `LogoCloud layout="tiles"`: six adopter wordmarks, each on its own
 * tinted 3:2 tile, in even rows at every width.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is } from "@sdxc/u/size";
import { LogoCloud } from "@sdxc/ui";

import { Wordmark, WORDMARKS } from "~/resources/components/demo-media";

/** The source the page shows, matching the markup below. */
const CODE = `<LogoCloud layout="tiles" label="Trusted by on-call teams at">
	{marks}
</LogoCloud>`;

/** What the preview registry reads: the title, the source to show, and the wall to draw. */
export default {
	title: "Tiles",
	code: CODE,
	viewports: true,
	render: () => (
		<LogoCloud layout="tiles" label="Trusted by on-call teams at" mix={[is("full")]}>
			{[...WORDMARKS, WORDMARKS[0]!].map((mark, index) => (
				<Wordmark key={`${mark.name}-${index}`} name={mark.name} glyph={mark.glyph} />
			))}
		</LogoCloud>
	),
};
