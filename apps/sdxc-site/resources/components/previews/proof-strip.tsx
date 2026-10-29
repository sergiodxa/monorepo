/**
 * Live preview for `ProofStrip`: the ruled band after a hero, with adopter marks over
 * proof figures. A band is a page-width surface, so it meets the frame's edges.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { GlobeIcon, RocketIcon, ShieldCheckIcon, ZapIcon } from "@sdxc/icons";
import { hstack } from "@sdxc/u/layout";
import { text, weight } from "@sdxc/u/typography";
import { HeadingScope, LogoCloud, StatStrip } from "@sdxc/ui";
import { ProofStrip } from "@sdxc/ui/patterns";

/** The source the page shows, matching the markup below. */
const CODE = `<ProofStrip>
	<LogoCloud muted>
		<span mix={[hstack({ gap: 1.5, align: "center" }), text("lg"), weight("semibold")]}>
			<RocketIcon /> Launchpad
		</span>
		<span mix={[hstack({ gap: 1.5, align: "center" }), text("lg"), weight("semibold")]}>
			<GlobeIcon /> Northwind
		</span>
		<span mix={[hstack({ gap: 1.5, align: "center" }), text("lg"), weight("semibold")]}>
			<ZapIcon /> Voltage
		</span>
		<span mix={[hstack({ gap: 1.5, align: "center" }), text("lg"), weight("semibold")]}>
			<ShieldCheckIcon /> Keystone
		</span>
	</LogoCloud>
	<StatStrip>
		<StatStrip.Item label="Checks run every day">4.2M</StatStrip.Item>
		<StatStrip.Item label="Probe regions">6</StatStrip.Item>
		<StatStrip.Item label="Median alert latency">38s</StatStrip.Item>
	</StatStrip>
</ProofStrip>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	flush: true,
	render: () => (
		<HeadingScope>
			<ProofStrip>
				<LogoCloud muted>
					<span mix={[hstack({ gap: 1.5, align: "center" }), text("lg"), weight("semibold")]}>
						<RocketIcon /> Launchpad
					</span>
					<span mix={[hstack({ gap: 1.5, align: "center" }), text("lg"), weight("semibold")]}>
						<GlobeIcon /> Northwind
					</span>
					<span mix={[hstack({ gap: 1.5, align: "center" }), text("lg"), weight("semibold")]}>
						<ZapIcon /> Voltage
					</span>
					<span mix={[hstack({ gap: 1.5, align: "center" }), text("lg"), weight("semibold")]}>
						<ShieldCheckIcon /> Keystone
					</span>
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
