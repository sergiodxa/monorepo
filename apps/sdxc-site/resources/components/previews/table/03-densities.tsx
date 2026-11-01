/**
 * Live example for `Table` densities: the same inbox drawn compact for scanning and
 * comfortable for rows that carry a second line, the row height coming from `density`
 * alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { fontSize } from "@sdxc/u/typography";
import { Table } from "@sdxc/ui/app/table";

/** One support conversation. */
interface Conversation {
	id: string;
	customer: string;
	subject: string;
	status: { label: string; color: "success" | "warning" | "brand" };
	updatedAt: string;
}

/** The request time the page renders against. */
const NOW = "2026-11-01T12:00:00Z";

/** The conversations on the page. */
const CONVERSATIONS: Conversation[] = [
	{
		id: "c_2291",
		customer: "Maya Chen",
		subject: "Webhook retries stopped after the plan change",
		status: { label: "Open", color: "brand" },
		updatedAt: "2026-11-01T11:51:00Z",
	},
	{
		id: "c_2288",
		customer: "Tomás Herrera",
		subject: "Invoice shows the old company address",
		status: { label: "Waiting", color: "warning" },
		updatedAt: "2026-11-01T08:30:00Z",
	},
	{
		id: "c_2280",
		customer: "Priya Natarajan",
		subject: "Can we export check history as CSV?",
		status: { label: "Solved", color: "success" },
		updatedAt: "2026-10-31T17:02:00Z",
	},
];

/** The source the page shows, matching the markup below. */
const CODE = `<Table aria-label="Inbox, compact" density="compact">…</Table>

<Table aria-label="Inbox, comfortable" density="comfortable">
	…
	<Table.Cell>
		<Table.RowLink href={\`/inbox/\${conversation.id}\`}>{conversation.customer}</Table.RowLink>
		<div>{conversation.subject}</div>
	</Table.Cell>
	…
</Table>`;

/** Props for {@link Inbox}. */
interface InboxProps {
	density: "compact" | "comfortable";
}

/** Draws the inbox at one density, with the subject on its own line when there is room. */
function Inbox(handle: Handle<InboxProps>) {
	return () => {
		let { density } = handle.props;

		return (
			<Table.Container>
				<Table aria-label={`Inbox, ${density}`} density={density}>
					<Table.Header>
						<Table.Row>
							<Table.Column>Customer</Table.Column>
							{density === "compact" ? <Table.Column>Subject</Table.Column> : null}
							<Table.Column>Status</Table.Column>
							<Table.Column>Updated</Table.Column>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{CONVERSATIONS.map((conversation) => (
							<Table.Row key={conversation.id}>
								<Table.Cell>
									<Table.RowLink href={`/examples/inbox/${conversation.id}`}>
										{conversation.customer}
									</Table.RowLink>
									{density === "comfortable" ? (
										<div mix={[fg("neutral.muted"), fontSize("xs")]}>{conversation.subject}</div>
									) : null}
								</Table.Cell>
								{density === "compact" ? <Table.Cell>{conversation.subject}</Table.Cell> : null}
								<Table.StatusCell color={conversation.status.color}>
									{conversation.status.label}
								</Table.StatusCell>
								<Table.DateCell date={conversation.updatedAt} now={NOW} locale="en" />
							</Table.Row>
						))}
					</Table.Body>
				</Table>
			</Table.Container>
		);
	};
}

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Compact and comfortable rows",
	code: CODE,
	render: () => (
		<div mix={[vstack({ gap: 6 })]}>
			<Inbox density="compact" />
			<Inbox density="comfortable" />
		</div>
	),
};
