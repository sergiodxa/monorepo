/**
 * The proof band from the landing-page guide: adopter marks over three figures. Wordmarks
 * beside a glyph stand in for the logo files the guide's snippet loads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { LogoCloud, StatStrip } from "@sdxc/ui";
import { ProofStrip } from "@sdxc/ui/patterns";

import { Wordmark, WORDMARKS } from "~/resources/components/demo-media";

/** What the guide demo registry reads: the band, drawn at a page's width. */
export default {
	viewports: true,
	render: () => (
		<>
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
		</>
	),
};
