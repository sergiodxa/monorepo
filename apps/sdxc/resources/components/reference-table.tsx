/**
 * The table every generated reference prints: the quick reference on a utility page,
 * the props on a component page, the tokens on the theming page. They differ only in
 * their headings and their cells, so one table draws all three and each page stays the
 * shape of its content rather than of its markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { Table } from "@sdxc/ui";

namespace ReferenceTable {
	export interface Props {
		/** What the table is, for a reader who reaches it without the heading above. */
		label: string;
		columns: string[];
		/** One entry per row, each holding one cell per column. */
		rows: RemixNode[][];
	}
}

/** Renders one reference table. */
export default function ReferenceTable(handle: Handle<ReferenceTable.Props>) {
	return () => {
		let { columns, label, rows } = handle.props;

		return (
			<Table.Container>
				<Table aria-label={label}>
					<Table.Header>
						<Table.Row>
							{columns.map((column) => (
								<Table.Column key={column}>{column}</Table.Column>
							))}
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{rows.map((cells, row) => (
							<Table.Row key={row}>
								{cells.map((cell, column) => (
									<Table.Cell key={column}>{cell}</Table.Cell>
								))}
							</Table.Row>
						))}
					</Table.Body>
				</Table>
			</Table.Container>
		);
	};
}
