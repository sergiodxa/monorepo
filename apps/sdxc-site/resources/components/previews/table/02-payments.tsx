/**
 * Live example for `Table`'s typed cells: a payments list where the id is mono and truncated
 * in the middle, amounts line up with their currency code muted after them, the date reads
 * relative within a week, the status is a dot, and an unknown fee renders a dash.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Table } from "@sdxc/ui/app/table";

/** One payment as the list shows it. */
interface Payment {
	id: string;
	customer: string;
	/** Amount in major units. */
	amount: number;
	currency: string;
	/** Processing fee in major units, unknown until the payment settles. */
	fee: number | null;
	status: { label: string; color: "success" | "warning" | "danger" | "neutral" };
	createdAt: string;
}

/** The request time the page renders against. */
const NOW = "2026-11-01T12:00:00Z";

/** The payments on the page. */
const PAYMENTS: Payment[] = [
	{
		id: "pi_3QbX9f2eZvKYlo2C1x8T4aRw",
		customer: "Northwind Traders",
		amount: 1280,
		currency: "USD",
		fee: 37.42,
		status: { label: "Succeeded", color: "success" },
		createdAt: "2026-11-01T11:42:00Z",
	},
	{
		id: "pi_3QbWzA2eZvKYlo2C0m1Pq7Ld",
		customer: "Acme Design GmbH",
		amount: 480,
		currency: "EUR",
		fee: null,
		status: { label: "Pending", color: "warning" },
		createdAt: "2026-11-01T09:05:00Z",
	},
	{
		id: "pi_3QbR1c2eZvKYlo2C1s9Hk2Mn",
		customer: "Globex",
		amount: 39000.75,
		currency: "USD",
		fee: 1131.32,
		status: { label: "Succeeded", color: "success" },
		createdAt: "2026-10-30T16:20:00Z",
	},
	{
		id: "pi_3QaZ0d2eZvKYlo2C0v4Bf8Xy",
		customer: "Initech Ltd",
		amount: 96,
		currency: "GBP",
		fee: 2.98,
		status: { label: "Refunded", color: "neutral" },
		createdAt: "2026-10-27T10:00:00Z",
	},
	{
		id: "pi_3QYm7e2eZvKYlo2C1c3Dg5Jz",
		customer: "Hooli",
		amount: 740,
		currency: "USD",
		fee: null,
		status: { label: "Failed", color: "danger" },
		createdAt: "2026-10-18T14:45:00Z",
	},
];

/** The source the page shows, matching the markup below. */
const CODE = `<Table.Container>
	<Table aria-label="Payments">
		<Table.Header>
			<Table.Row>
				<Table.Column>Payment</Table.Column>
				<Table.Column>Customer</Table.Column>
				<Table.Column numeric>Amount</Table.Column>
				<Table.Column numeric>Fee</Table.Column>
				<Table.Column>Status</Table.Column>
				<Table.Column>Created</Table.Column>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{payments.map((payment) => (
				<Table.Row key={payment.id}>
					<Table.IdCell value={payment.id} />
					<Table.Cell>{payment.customer}</Table.Cell>
					<Table.CurrencyCell value={payment.amount} currency={payment.currency} locale="en" />
					<Table.CurrencyCell value={payment.fee} currency={payment.currency} locale="en" />
					<Table.StatusCell color={payment.status.color}>{payment.status.label}</Table.StatusCell>
					<Table.DateCell date={payment.createdAt} now={requestTime} locale="en" />
				</Table.Row>
			))}
		</Table.Body>
	</Table>
</Table.Container>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Typed cells: a payments list",
	code: CODE,
	render: () => (
		<Table.Container>
			<Table aria-label="Payments">
				<Table.Header>
					<Table.Row>
						<Table.Column>Payment</Table.Column>
						<Table.Column>Customer</Table.Column>
						<Table.Column numeric>Amount</Table.Column>
						<Table.Column numeric>Fee</Table.Column>
						<Table.Column>Status</Table.Column>
						<Table.Column>Created</Table.Column>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{PAYMENTS.map((payment) => (
						<Table.Row key={payment.id}>
							<Table.IdCell value={payment.id} />
							<Table.Cell>{payment.customer}</Table.Cell>
							<Table.CurrencyCell value={payment.amount} currency={payment.currency} locale="en" />
							<Table.CurrencyCell value={payment.fee} currency={payment.currency} locale="en" />
							<Table.StatusCell color={payment.status.color}>
								{payment.status.label}
							</Table.StatusCell>
							<Table.DateCell date={payment.createdAt} now={NOW} locale="en" />
						</Table.Row>
					))}
				</Table.Body>
			</Table>
		</Table.Container>
	),
};
