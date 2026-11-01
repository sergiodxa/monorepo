/**
 * Live example for `Table` states: a first-run list whose empty message sits beneath the
 * header, a failed load with Retry in place of the body, and a refetch that dims the rows in
 * place while `aria-busy` tells assistive technology to wait.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { weight } from "@sdxc/u/typography";
import { LinkButton } from "@sdxc/ui";
import { Table } from "@sdxc/ui/app/table";

/** The source the page shows, matching the markup below. */
const CODE = `<Table.Container>
	<Table aria-label="Status pages">
		<Table.Header>…</Table.Header>
	</Table>
	<Table.Empty>
		<p>No status pages yet</p>
		<p>Publish one to tell customers what is up before they ask.</p>
	</Table.Empty>
</Table.Container>

<Table aria-label="Incidents">
	<Table.Header>…</Table.Header>
	<Table.Error colSpan={3} action={<LinkButton href={currentUrl} size="sm" variant="outline">Retry</LinkButton>}>
		Incidents could not load. Request 7f3a2c91.
	</Table.Error>
</Table>

<Table aria-label="Deploys" aria-busy={refreshing ? "true" : undefined}>…</Table>`;

/** Header cells shared by every table in the example. */
function Header() {
	return () => (
		<Table.Header>
			<Table.Row>
				<Table.Column>Name</Table.Column>
				<Table.Column>Owner</Table.Column>
				<Table.Column numeric>Subscribers</Table.Column>
			</Table.Row>
		</Table.Header>
	);
}

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Empty, failed and refetching",
	code: CODE,
	render: () => (
		<div mix={[vstack({ gap: 8 })]}>
			<Table.Container>
				<Table aria-label="Status pages">
					<Header />
				</Table>
				<Table.Empty>
					<div mix={[vstack({ gap: 1, align: "center" })]}>
						<p mix={[weight(500)]}>No status pages yet</p>
						<p mix={[fg("neutral.muted")]}>
							Publish one to tell customers what is up before they ask.
						</p>
					</div>
				</Table.Empty>
			</Table.Container>

			<Table.Container>
				<Table aria-label="Incidents">
					<Header />
					<Table.Error
						colSpan={3}
						action={
							<LinkButton href="/examples/incidents" size="sm" variant="outline">
								Retry
							</LinkButton>
						}
					>
						Incidents could not load. Request 7f3a2c91.
					</Table.Error>
				</Table>
			</Table.Container>

			<Table.Container>
				<Table aria-label="Public status pages" aria-busy="true">
					<Header />
					<Table.Body>
						<Table.Row>
							<Table.Cell>status.acme.dev</Table.Cell>
							<Table.Cell>Platform</Table.Cell>
							<Table.NumberCell value={4210} locale="en" />
						</Table.Row>
						<Table.Row>
							<Table.Cell>pay.acme.dev</Table.Cell>
							<Table.Cell>Payments</Table.Cell>
							<Table.NumberCell value={1388} locale="en" />
						</Table.Row>
					</Table.Body>
				</Table>
			</Table.Container>
		</div>
	),
};
