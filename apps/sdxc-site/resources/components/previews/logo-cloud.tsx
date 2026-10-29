/**
 * Live preview for `LogoCloud`: a row of adopter marks, each an icon and a wordmark, sized to
 * the marketing logo height and muted to one tone so no single brand outshouts the row.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ActivityIcon, GlobeIcon, RocketIcon, ShieldCheckIcon, ZapIcon } from "@sdxc/icons";
import { hstack } from "@sdxc/u/layout";
import { text, weight } from "@sdxc/u/typography";
import { LogoCloud } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<LogoCloud muted>
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
	<span mix={[hstack({ gap: 1.5, align: "center" }), text("lg"), weight("semibold")]}>
		<ActivityIcon /> Pulse
	</span>
</LogoCloud>`;

/** The adopters the preview draws, each a wordmark beside its glyph. */
const MARKS = [
	["Launchpad", RocketIcon],
	["Northwind", GlobeIcon],
	["Voltage", ZapIcon],
	["Keystone", ShieldCheckIcon],
	["Pulse", ActivityIcon],
] as const;

/** What the preview registry reads: the source to show, and the row to draw. */
export default {
	code: CODE,
	render: () => (
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
	),
};
