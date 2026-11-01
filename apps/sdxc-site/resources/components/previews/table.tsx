/**
 * Live preview for `Table`: an uptime dashboard's monitors list with a selection column, the
 * monitor name linking its whole row, a status dot, typed number cells for response time and
 * uptime, a relative "last checked" time and row actions that wait for hover.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Button } from "@sdxc/ui";
import { Table } from "@sdxc/ui/app/table";

/** One monitor as the list shows it. */
interface Monitor {
	id: string;
	name: string;
	status: { label: string; color: "success" | "warning" | "danger" | "neutral" | "brand" };
	/** Whether the monitor is mid-check, the one state whose dot pulses. */
	checking?: boolean;
	region: string;
	/** Median response time in milliseconds, unknown while down or paused. */
	responseMs: number | null;
	/** Share of checks that passed over 30 days. */
	uptime: number;
	checkedAt: string;
}

/** The request time the page renders against, so "ago" reads the same on every render. */
const NOW = "2026-11-01T12:00:00Z";

/** The monitors on the page. */
const MONITORS: Monitor[] = [
	{
		id: "mon_api",
		name: "api.acme.dev",
		status: { label: "Up", color: "success" },
		region: "Frankfurt",
		responseMs: 142,
		uptime: 0.9998,
		checkedAt: "2026-11-01T11:59:30Z",
	},
	{
		id: "mon_checkout",
		name: "checkout.acme.dev",
		status: { label: "Degraded", color: "warning" },
		region: "N. Virginia",
		responseMs: 912,
		uptime: 0.9921,
		checkedAt: "2026-11-01T11:59:00Z",
	},
	{
		id: "mon_webhooks",
		name: "webhooks.acme.dev",
		status: { label: "Down", color: "danger" },
		region: "São Paulo",
		responseMs: null,
		uptime: 0.9612,
		checkedAt: "2026-11-01T11:59:15Z",
	},
	{
		id: "mon_cdn",
		name: "cdn.acme.dev",
		status: { label: "Checking", color: "brand" },
		checking: true,
		region: "Sydney",
		responseMs: 64,
		uptime: 0.9995,
		checkedAt: "2026-11-01T11:58:00Z",
	},
	{
		id: "mon_docs",
		name: "docs.acme.dev",
		status: { label: "Paused", color: "neutral" },
		region: "Oregon",
		responseMs: null,
		uptime: 0.9999,
		checkedAt: "2026-10-29T08:12:00Z",
	},
];

/** The source the page shows, matching the markup below. */
const CODE = `<Table.Container>
	<Table aria-label="Monitors">
		<Table.Header>
			<Table.Row>
				<Table.SelectAll label="Select all monitors" />
				<Table.Column>Monitor</Table.Column>
				<Table.Column>Status</Table.Column>
				<Table.Column>Region</Table.Column>
				<Table.Column numeric>Response</Table.Column>
				<Table.Column numeric>Uptime (30d)</Table.Column>
				<Table.Column>Last checked</Table.Column>
				<Table.ActionsColumn label="Actions" />
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{monitors.map((monitor) => (
				<Table.Row key={monitor.id}>
					<Table.Select name="monitor" value={monitor.id} label={\`Select \${monitor.name}\`} />
					<Table.Cell>
						<Table.RowLink href={\`/monitors/\${monitor.id}\`}>{monitor.name}</Table.RowLink>
					</Table.Cell>
					<Table.StatusCell color={monitor.status.color} pulse={monitor.checking}>
						{monitor.status.label}
					</Table.StatusCell>
					<Table.Cell>{monitor.region}</Table.Cell>
					<Table.NumberCell
						value={monitor.responseMs}
						locale="en"
						format={{ style: "unit", unit: "millisecond" }}
					/>
					<Table.NumberCell
						value={monitor.uptime}
						locale="en"
						format={{ style: "percent", minimumFractionDigits: 2 }}
					/>
					<Table.DateCell date={monitor.checkedAt} now={requestTime} locale="en" />
					<Table.Actions>
						<Button size="sm" variant="ghost">Pause</Button>
						<Button size="sm" variant="ghost" color="danger">Delete</Button>
					</Table.Actions>
				</Table.Row>
			))}
		</Table.Body>
	</Table>
</Table.Container>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<Table.Container>
			<Table aria-label="Monitors">
				<Table.Header>
					<Table.Row>
						<Table.SelectAll label="Select all monitors" />
						<Table.Column>Monitor</Table.Column>
						<Table.Column>Status</Table.Column>
						<Table.Column>Region</Table.Column>
						<Table.Column numeric>Response</Table.Column>
						<Table.Column numeric>Uptime (30d)</Table.Column>
						<Table.Column>Last checked</Table.Column>
						<Table.ActionsColumn label="Actions" />
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{MONITORS.map((monitor) => (
						<Table.Row key={monitor.id}>
							<Table.Select name="monitor" value={monitor.id} label={`Select ${monitor.name}`} />
							<Table.Cell>
								<Table.RowLink href={`/examples/monitors/${monitor.id}`}>
									{monitor.name}
								</Table.RowLink>
							</Table.Cell>
							<Table.StatusCell color={monitor.status.color} pulse={monitor.checking}>
								{monitor.status.label}
							</Table.StatusCell>
							<Table.Cell>{monitor.region}</Table.Cell>
							<Table.NumberCell
								value={monitor.responseMs}
								locale="en"
								format={{ style: "unit", unit: "millisecond" }}
							/>
							<Table.NumberCell
								value={monitor.uptime}
								locale="en"
								format={{ style: "percent", minimumFractionDigits: 2 }}
							/>
							<Table.DateCell date={monitor.checkedAt} now={NOW} locale="en" />
							<Table.Actions>
								<Button size="sm" variant="ghost">
									Pause
								</Button>
								<Button size="sm" variant="ghost" color="danger">
									Delete
								</Button>
							</Table.Actions>
						</Table.Row>
					))}
				</Table.Body>
			</Table>
		</Table.Container>
	),
};
