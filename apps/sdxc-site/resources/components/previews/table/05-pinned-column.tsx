/**
 * Live example for a pinned first column and in-cell data bars: an observability table of
 * routes wider than its container, whose route names stay in view while the figures scroll,
 * each request count drawn over a bar sized to the busiest route.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Table } from "@sdxc/ui/app/table";

/** One route's traffic over the last day. */
interface Route {
	path: string;
	requests: number;
	errorRate: number;
	p75Ms: number;
	p99Ms: number;
	/** Data sent, in gigabytes. */
	gigabytes: number;
}

/** The routes on the page, busiest first. */
const ROUTES: Route[] = [
	{
		path: "/api/checks",
		requests: 1284000,
		errorRate: 0.0012,
		p75Ms: 48,
		p99Ms: 212,
		gigabytes: 9.4,
	},
	{
		path: "/api/monitors/:id",
		requests: 642300,
		errorRate: 0.0004,
		p75Ms: 31,
		p99Ms: 140,
		gigabytes: 2.1,
	},
	{ path: "/status/:slug", requests: 401800, errorRate: 0, p75Ms: 22, p99Ms: 96, gigabytes: 6.8 },
	{
		path: "/api/incidents",
		requests: 88120,
		errorRate: 0.031,
		p75Ms: 120,
		p99Ms: 940,
		gigabytes: 0.32,
	},
	{
		path: "/webhooks/stripe",
		requests: 12400,
		errorRate: 0.0081,
		p75Ms: 210,
		p99Ms: 1480,
		gigabytes: 0.04,
	},
];

/** The busiest route, which a full bar stands for. */
const BUSIEST = Math.max(...ROUTES.map((route) => route.requests));

/** The source the page shows, matching the markup below. */
const CODE = `<Table.Container>
	<Table aria-label="Routes, last 24 hours" pinFirstColumn>
		<Table.Header>
			<Table.Row>
				<Table.Column>Route</Table.Column>
				<Table.Column numeric>Requests</Table.Column>
				<Table.Column numeric>Errors</Table.Column>
				<Table.Column numeric>P75</Table.Column>
				<Table.Column numeric>P99</Table.Column>
				<Table.Column numeric>Transferred</Table.Column>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{routes.map((route) => (
				<Table.Row key={route.path}>
					<Table.Cell>{route.path}</Table.Cell>
					<Table.BarCell value={route.requests} max={busiest} locale="en" format={{ notation: "compact" }} />
					<Table.NumberCell value={route.errorRate} locale="en" format={{ style: "percent", maximumFractionDigits: 2 }} />
					<Table.NumberCell value={route.p75Ms} locale="en" format={{ style: "unit", unit: "millisecond" }} />
					<Table.NumberCell value={route.p99Ms} locale="en" format={{ style: "unit", unit: "millisecond" }} />
					<Table.NumberCell value={route.gigabytes} locale="en" format={{ style: "unit", unit: "gigabyte", maximumFractionDigits: 2 }} />
				</Table.Row>
			))}
		</Table.Body>
	</Table>
</Table.Container>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Pinned first column and data bars",
	code: CODE,
	render: () => (
		<Table.Container style={{ maxInlineSize: "34rem" }}>
			<Table aria-label="Routes, last 24 hours" pinFirstColumn>
				<Table.Header>
					<Table.Row>
						<Table.Column>Route</Table.Column>
						<Table.Column numeric>Requests</Table.Column>
						<Table.Column numeric>Errors</Table.Column>
						<Table.Column numeric>P75</Table.Column>
						<Table.Column numeric>P99</Table.Column>
						<Table.Column numeric>Transferred</Table.Column>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{ROUTES.map((route) => (
						<Table.Row key={route.path}>
							<Table.Cell>{route.path}</Table.Cell>
							<Table.BarCell
								value={route.requests}
								max={BUSIEST}
								locale="en"
								format={{ notation: "compact" }}
							/>
							<Table.NumberCell
								value={route.errorRate}
								locale="en"
								format={{ style: "percent", maximumFractionDigits: 2 }}
							/>
							<Table.NumberCell
								value={route.p75Ms}
								locale="en"
								format={{ style: "unit", unit: "millisecond" }}
							/>
							<Table.NumberCell
								value={route.p99Ms}
								locale="en"
								format={{ style: "unit", unit: "millisecond" }}
							/>
							<Table.NumberCell
								value={route.gigabytes}
								locale="en"
								format={{ style: "unit", unit: "gigabyte", maximumFractionDigits: 2 }}
							/>
						</Table.Row>
					))}
				</Table.Body>
			</Table>
		</Table.Container>
	),
};
