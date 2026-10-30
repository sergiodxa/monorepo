/**
 * Live preview for `ProofStrip`: the ruled band after a hero, with a labelled row of
 * adopter wordmarks spread across the measure over three proof figures. A band is a
 * page-width surface, so it meets the frame's edges.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { HeadingScope, LogoCloud, StatStrip } from "@sdxc/ui";
import { ProofStrip } from "@sdxc/ui/patterns";

import { Wordmark, WORDMARKS } from "~/resources/components/demo-media";

/** The source the page shows, matching the markup below. */
const CODE = `<ProofStrip>
	<LogoCloud layout="spread" label="Trusted by on-call teams at" muted>
		<img src={northwind} alt="Northwind" />
		<img src={voltage} alt="Voltage" />
		<img src={layerline} alt="Layerline" />
		<img src={fernway} alt="Fernway" />
		<img src={quadrant} alt="Quadrant" />
	</LogoCloud>
	<StatStrip>
		<StatStrip.Item label="Checks run every day">4.2M</StatStrip.Item>
		<StatStrip.Item label="Probe regions">6</StatStrip.Item>
		<StatStrip.Item label="Median alert latency">38s</StatStrip.Item>
	</StatStrip>
</ProofStrip>`;

/** What the preview registry reads: the source to show, and the band to draw. */
export default {
	code: CODE,
	viewports: true,
	render: () => (
		<HeadingScope>
			<ProofStrip>
				<LogoCloud layout="spread" label="Trusted by on-call teams at" muted>
					{WORDMARKS.map((mark) => (
						<Wordmark key={mark.name} name={mark.name} glyph={mark.glyph} />
					))}
				</LogoCloud>
				<StatStrip>
					<StatStrip.Item label="Checks run every day">4.2M</StatStrip.Item>
					<StatStrip.Item label="Probe regions">6</StatStrip.Item>
					<StatStrip.Item label="Median alert latency">38s</StatStrip.Item>
				</StatStrip>
			</ProofStrip>
		</HeadingScope>
	),
};
