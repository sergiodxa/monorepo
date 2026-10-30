/**
 * The proof band from the landing-page guide: adopter marks over three figures. Wordmarks
 * beside a glyph stand in for the logo files the guide's snippet loads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { GlobeIcon, RocketIcon, ShieldCheckIcon } from "@sdxc/icons";
import { hstack } from "@sdxc/u/layout";
import { text, weight } from "@sdxc/u/typography";
import { HeadingScope, LogoCloud, StatStrip } from "@sdxc/ui";
import { ProofStrip } from "@sdxc/ui/patterns";

/** The adopters the band shows, each a wordmark beside its glyph. */
const MARKS = [
	["Launchpad", RocketIcon],
	["Northwind", GlobeIcon],
	["Keystone", ShieldCheckIcon],
] as const;

/** What the guide demo registry reads: the band, drawn at a page's width. */
export default {
	viewports: true,
	render: () => (
		<HeadingScope>
			<ProofStrip>
				<LogoCloud muted>
					{MARKS.map(([name, Icon]) => (
						<span
							key={name}
							mix={[hstack({ gap: 1.5, align: "center" }), text("lg"), weight("semibold")]}
						>
							<Icon /> {name}
						</span>
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
