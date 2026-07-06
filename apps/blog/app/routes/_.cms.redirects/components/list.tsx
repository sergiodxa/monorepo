/**
 * Presentational list component for the CMS redirects route. RedirectsList renders
 * a given array of from/to redirect entries as a table inside a card, keyed by the
 * combined paths. It exists to isolate the redirects table markup from the route's
 * loader and action logic.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Card, Table } from "@pkg/ui";

interface Redirect {
	from: string;
	to: string;
}

export function RedirectsList({ list }: { list: Redirect[] }) {
	return (
		<Card>
			<Table aria-label="Redirects">
				<Table.Header>
					<Table.Column isRowHeader>From</Table.Column>
					<Table.Column>To</Table.Column>
				</Table.Header>
				<Table.Body>
					{list.map((redirect) => (
						<Table.Row key={redirect.from + redirect.to}>
							<Table.Cell>{redirect.from}</Table.Cell>
							<Table.Cell>{redirect.to}</Table.Cell>
						</Table.Row>
					))}
				</Table.Body>
			</Table>
		</Card>
	);
}
