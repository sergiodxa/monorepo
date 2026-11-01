/**
 * Live example for `Skeleton.Table`: placeholder rows under the real table header, each
 * as tall as a real row, so nothing moves when the first page arrives.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Skeleton } from "@sdxc/ui/app/skeleton";
import { Table } from "@sdxc/ui/app/table";

/** The source the page shows, matching the markup below. */
const CODE = `<Table>
	<Table.Header>
		<Table.Row>
			<Table.Column>Monitor</Table.Column>
			<Table.Column>Status</Table.Column>
			<Table.Column>Uptime</Table.Column>
			<Table.Column>Last check</Table.Column>
		</Table.Row>
	</Table.Header>
	<Skeleton.Table rows={5} columns={4} label="Loading monitors" />
</Table>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Table body",
	code: CODE,
	render: () => (
		<Table>
			<Table.Header>
				<Table.Row>
					<Table.Column>Monitor</Table.Column>
					<Table.Column>Status</Table.Column>
					<Table.Column>Uptime</Table.Column>
					<Table.Column>Last check</Table.Column>
				</Table.Row>
			</Table.Header>
			<Skeleton.Table rows={5} columns={4} label="Loading monitors" />
		</Table>
	),
};
