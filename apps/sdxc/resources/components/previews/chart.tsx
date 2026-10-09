/**
 * Live preview island for `Chart`. Every bar is a focusable `<rect>` carrying its own
 * `<title>`, and the gridlines come from the value domain, so the figure is readable and
 * keyboard-navigable with no script: tab into the plot and each bar announces its month,
 * series and count. `Chart.Legend`'s rows are native checkboxes whose `aria-checked`
 * attribute is static, so each one carries the `ariaChecked()` wiring a reader would write
 * to keep it following the live checkedness the row already strikes through.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { basis, grow, hstack, vstack } from "@sdxc/u/layout";
import { is, maxIs } from "@sdxc/u/size";
import { text, textAlign, weight } from "@sdxc/u/typography";
import { Chart } from "@sdxc/ui";
import { ariaChecked } from "@sdxc/ui/mixins";
import { clientEntry } from "remix/component";

/** Two quarters of support volume, one row per month and one value per series. */
const VOLUME = [
	{ month: "Apr", opened: 1840, resolved: 1710 },
	{ month: "May", opened: 2120, resolved: 2040 },
	{ month: "Jun", opened: 2460, resolved: 2180 },
	{ month: "Jul", opened: 2310, resolved: 2290 },
	{ month: "Aug", opened: 1980, resolved: 1960 },
	{ month: "Sep", opened: 2640, resolved: 2470 },
];

/** How a value is read out in a bar's `<title>` and in the tooltip a page builds from it. */
const COUNT = new Intl.NumberFormat("en-US");

/** The source the page shows, matching the markup below. */
const CODE = `<div mix={[vstack({ gap: 3, align: "stretch" }), is("100%"), maxIs("32rem")]}>
	<Chart.Bar
		aria-label="Tickets opened and resolved, April through September"
		width={480}
		height={200}
		domain={[0, 3000]}
		tickCount={4}
		series={["opened", "resolved"]}
		data={VOLUME.map((row) => ({
			category: row.month,
			values: {
				opened: { value: row.opened, label: \`\${row.month} opened: \${COUNT.format(row.opened)}\` },
				resolved: {
					value: row.resolved,
					label: \`\${row.month} resolved: \${COUNT.format(row.resolved)}\`,
				},
			},
		}))}
	/>

	<Chart.Legend aria-label="Series shown">
		<Chart.Legend.Item color={1} defaultChecked mix={[ariaChecked()]}>
			Opened
		</Chart.Legend.Item>
		<Chart.Legend.Item color={2} defaultChecked mix={[ariaChecked()]}>
			Resolved
		</Chart.Legend.Item>
	</Chart.Legend>

	<div mix={[hstack({ gap: 0, align: "center" })]} aria-hidden="true">
		{VOLUME.map((row) => (
			<span
				key={row.month}
				mix={[grow(), basis("0%"), textAlign("center"), text("xs"), fg("neutral.muted")]}
			>
				{row.month}
			</span>
		))}
	</div>

	<p mix={[text("sm"), fg("neutral")]}>
		<span mix={[weight("medium")]}>Backlog is growing.</span> September opened 2,640 and
		resolved 2,470. Tab into the plot to hear each bar, or a legend row to strike a
		series out.
	</p>
</div>`;

/** Two series of support volume with a filtering legend, hydrated so each row reports its state. */
export const ChartPreview = clientEntry(import.meta.url, function ChartPreview() {
	return () => (
		<div mix={[vstack({ gap: 3, align: "stretch" }), is("100%"), maxIs("32rem")]}>
			<Chart.Bar
				aria-label="Tickets opened and resolved, April through September"
				width={480}
				height={200}
				domain={[0, 3000]}
				tickCount={4}
				series={["opened", "resolved"]}
				data={VOLUME.map((row) => ({
					category: row.month,
					values: {
						opened: {
							value: row.opened,
							label: `${row.month} opened: ${COUNT.format(row.opened)}`,
						},
						resolved: {
							value: row.resolved,
							label: `${row.month} resolved: ${COUNT.format(row.resolved)}`,
						},
					},
				}))}
			/>

			<Chart.Legend aria-label="Series shown">
				<Chart.Legend.Item color={1} defaultChecked mix={[ariaChecked()]}>
					Opened
				</Chart.Legend.Item>
				<Chart.Legend.Item color={2} defaultChecked mix={[ariaChecked()]}>
					Resolved
				</Chart.Legend.Item>
			</Chart.Legend>

			<div mix={[hstack({ gap: 0, align: "center" })]} aria-hidden="true">
				{VOLUME.map((row) => (
					<span
						key={row.month}
						mix={[grow(), basis("0%"), textAlign("center"), text("xs"), fg("neutral.muted")]}
					>
						{row.month}
					</span>
				))}
			</div>

			<p mix={[text("sm"), fg("neutral")]}>
				<span mix={[weight("medium")]}>Backlog is growing.</span> September opened 2,640 and
				resolved 2,470. Tab into the plot to hear each bar, or a legend row to strike a series out.
			</p>
		</div>
	);
});

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: CODE, render: () => <ChartPreview /> };
