/**
 * Live preview for `LogoCloud`: the default centered row of adopter wordmarks in full
 * ink, then a labelled row spread across the measure and muted to the body ink, then the
 * ruled grid of cells.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { LogoCloud } from "@sdxc/ui";

import { Wordmark, WORDMARKS } from "~/resources/components/demo-media";

/** The source the page shows, matching the markup below. */
const CODE = `<LogoCloud>
	<img src={northwind} alt="Northwind" />
	<img src={voltage} alt="Voltage" />
	<img src={layerline} alt="Layerline" />
	<img src={fernway} alt="Fernway" />
	<img src={quadrant} alt="Quadrant" />
</LogoCloud>

<LogoCloud layout="spread" label="Trusted by on-call teams at" muted>
	{marks}
</LogoCloud>

<LogoCloud layout="grid" muted>
	{marks}
</LogoCloud>`;

/** What the preview registry reads: the source to show, and the clouds to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full"), vstack({ gap: 12, align: "stretch" })]}>
			<LogoCloud>
				{WORDMARKS.map((mark) => (
					<Wordmark key={mark.name} name={mark.name} glyph={mark.glyph} />
				))}
			</LogoCloud>
			<LogoCloud layout="spread" label="Trusted by on-call teams at" muted>
				{WORDMARKS.map((mark) => (
					<Wordmark key={mark.name} name={mark.name} glyph={mark.glyph} />
				))}
			</LogoCloud>
			<LogoCloud layout="grid" muted>
				{WORDMARKS.map((mark) => (
					<Wordmark key={mark.name} name={mark.name} glyph={mark.glyph} />
				))}
			</LogoCloud>
		</div>
	),
};
