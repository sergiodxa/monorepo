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
