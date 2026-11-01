/**
 * Live preview for `Sparkline`: a monitor list where each row carries its own response-time
 * trend and one word reading it, so the list shows which service is drifting without a chart.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { grid, vstack } from "@sdxc/u/layout";
import { is, maxIs, pb } from "@sdxc/u/size";
import { tabularNums, text, textAlign, weight } from "@sdxc/u/typography";
import { Sparkline } from "@sdxc/ui/app/sparkline";

/** Four monitors with the last 16 checks' response time in milliseconds. */
const MONITORS = [
	{
		name: "api.acme.dev",
		latest: "142 ms",
		tone: "success",
		state: "Stable",
		values: [140, 138, 145, 141, 139, 143, 140, 144, 142, 139, 141, 143, 140, 138, 141, 142],
	},
	{
		name: "checkout.acme.dev",
		latest: "612 ms",
		tone: "warning",
		state: "Degrading",
		values: [210, 220, 215, 240, 260, 255, 290, 310, 340, 360, 410, 430, 480, 520, 570, 612],
	},
	{
		name: "billing.acme.dev",
		latest: "—",
		tone: "danger",
		state: "Down",
		values: [
			190,
			185,
			192,
			188,
			195,
			240,
			380,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
		],
	},
	{
		name: "status.acme.dev",
		latest: "88 ms",
		tone: "neutral",
		state: "Recovered",
		values: [92, 95, 140, 210, 180, 120, 95, 90, 91, 89, 90, 88, 87, 90, 89, 88],
	},
] as const;

/** The source the page shows, matching the markup below. */
const CODE = `{MONITORS.map((monitor) => (
	<div key={monitor.name} mix={[grid(), raw({ gridTemplateColumns: "minmax(0, 1fr) 5rem minmax(0, 12rem)", alignItems: "center", gap: "1rem" })]}>
		<span>{monitor.name}</span>
		<span mix={[tabularNums(), textAlign("end")]}>{monitor.latest}</span>
		<Sparkline
			values={monitor.values}
			label={\`\${monitor.name} response time, \${monitor.state.toLowerCase()}\`}
			tone={monitor.tone}
			state={monitor.state}
		/>
	</div>
))}`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[vstack({ gap: 0, align: "stretch" }), is("100%"), maxIs("40rem")]}>
			{MONITORS.map((monitor) => (
				<div
					key={monitor.name}
					mix={[
						grid(),
						raw({
							gridTemplateColumns: "minmax(0, 1fr) 4.5rem minmax(0, 12rem)",
							alignItems: "center",
							gap: "1rem",
						}),
						pb(2.5),
						raw({ borderBlockEnd: "1px solid var(--ui-neutral-border)" }),
						text("sm"),
					]}
				>
					<span mix={[weight("medium"), raw({ overflowWrap: "anywhere" })]}>{monitor.name}</span>
					<span mix={[tabularNums(), textAlign("end"), fg("neutral.muted")]}>{monitor.latest}</span>
					<Sparkline
						values={monitor.values}
						label={`${monitor.name} response time, ${monitor.state.toLowerCase()}`}
						tone={monitor.tone}
						state={monitor.state}
					/>
				</div>
			))}
		</div>
	),
};
