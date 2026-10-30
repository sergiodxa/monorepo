/**
 * Live preview for `Marquee`: a row of adopter wordmarks scrolling under edge fades, with
 * the pause toggle at the inline end. Hovering the row also stops it, and a reduced-motion
 * visitor sees the same marks as a still, centered row.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { is } from "@sdxc/u/size";
import { Marquee } from "@sdxc/ui/patterns";

import { Wordmark, WORDMARKS } from "~/resources/components/demo-media";

/** The source the page shows, matching the markup below. */
const CODE = `<Marquee aria-label="Teams on Beacon">
	<img src={northwind} alt="Northwind" />
	<img src={voltage} alt="Voltage" />
	<img src={layerline} alt="Layerline" />
	<img src={fernway} alt="Fernway" />
	<img src={quadrant} alt="Quadrant" />
</Marquee>`;

/** What the preview registry reads: the source to show, and the marquee to draw. */
export default {
	code: CODE,
	render: () => (
		<Marquee aria-label="Teams on Beacon" mix={[is("full"), fg("neutral")]}>
			{[...WORDMARKS, ...WORDMARKS.slice(0, 3)].map((mark, index) => (
				<Wordmark key={`${mark.name}-${index}`} name={mark.name} glyph={mark.glyph} />
			))}
		</Marquee>
	),
};
