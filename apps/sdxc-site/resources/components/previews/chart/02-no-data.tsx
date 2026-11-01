/**
 * Live example for `Chart.Bar` with periods that recorded nothing: the months before the
 * product launched are hatched at full height, which reads as unknown, where a zero-height
 * bar would claim there was no revenue.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is, maxIs } from "@sdxc/u/size";
import { Chart } from "@sdxc/ui/app/chart";

/** Monthly revenue in dollars, `null` before the first sale. */
const REVENUE = [
	{ month: "May", amount: null },
	{ month: "Jun", amount: null },
	{ month: "Jul", amount: 1240 },
	{ month: "Aug", amount: 2310 },
	{ month: "Sep", amount: 2980 },
	{ month: "Oct", amount: 3620 },
];

/** How an amount reads in a bar's title. */
const DOLLARS = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
	maximumFractionDigits: 0,
});

/** The source the page shows, matching the markup below. */
const CODE = `<Chart.Bar
	width={480}
	height={180}
	domain={[0, 4000]}
	aria-label="Revenue by month, May to October"
	series={["revenue"]}
	data={REVENUE.map((row) => ({
		category: row.month,
		values: {
			revenue: {
				value: row.amount,
				label: row.amount === null ? \`\${row.month}: no data\` : \`\${row.month}: \${DOLLARS.format(row.amount)}\`,
			},
		},
	}))}
/>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Hatched periods with no data",
	code: CODE,
	render: () => (
		<Chart.Bar
			width={480}
			height={180}
			domain={[0, 4000]}
			aria-label="Revenue by month, May to October"
			series={["revenue"]}
			mix={[is("100%"), maxIs("32rem")]}
			data={REVENUE.map((row) => ({
				category: row.month,
				values: {
					revenue: {
						value: row.amount,
						label:
							row.amount === null
								? `${row.month}: no data`
								: `${row.month}: ${DOLLARS.format(row.amount)}`,
					},
				},
			}))}
		/>
	),
};
