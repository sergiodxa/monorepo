/**
 * The registered-clients listing: one page of relying parties in a table, each row
 * linking to its detail and edit pages and offering a confirmed deletion. A client row
 * is what authorizes an entire application, so deleting one is behind an explicit
 * confirmation rather than a bare button.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { flex, gap, items } from "@pkg/u/layout";
import { mbe } from "@pkg/u/size";
import { font, weight } from "@pkg/u/typography";
import { Description, Empty, Link, LinkButton, Table } from "@pkg/ui";

import type { AdminView } from "~/app/http/view-models/admin";

import AdminLayout from "~/resources/layouts/admin";
import ConfirmAction from "~/resources/views/admin/confirm-action";
import ListPagination from "~/resources/views/admin/pagination";

namespace ClientsView {
	/** Every string this page shows, so no copy is decided inside the view. */
	export interface Labels {
		description: string;
		empty: string;
		create: string;
		columns: { name: string; redirectUri: string; createdAt: string; actions: string };
		actions: { view: string; edit: string; delete: string };
		confirm: { title: string; description: string; confirm: string; cancel: string };
		tableLabel: string;
	}

	export interface Props {
		chrome: AdminView.Chrome;
		labels: Labels;
		/** Where the "new client" control in the header goes. */
		createHref: string;
		clients: AdminView.ClientRow[];
		pagination: AdminView.Pagination;
	}
}

/** Renders the paginated client list with its per-row actions. */
export default function ClientsView(handle: Handle<ClientsView.Props>) {
	return () => {
		let { chrome, labels, clients, pagination, createHref } = handle.props;

		return (
			<AdminLayout
				chrome={chrome}
				actions={<LinkButton href={createHref}>{labels.create}</LinkButton>}
			>
				<Description mix={[mbe(6)]}>{labels.description}</Description>

				{clients.length === 0 ? (
					<Empty>
						<Empty.Title>{labels.empty}</Empty.Title>
					</Empty>
				) : (
					<>
						<Table.Container>
							<Table aria-label={labels.tableLabel}>
								<Table.Header>
									<Table.Row>
										<Table.Column>{labels.columns.name}</Table.Column>
										<Table.Column>{labels.columns.redirectUri}</Table.Column>
										<Table.Column>{labels.columns.createdAt}</Table.Column>
										<Table.Column>{labels.columns.actions}</Table.Column>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{clients.map((client) => (
										<Table.Row key={client.id}>
											<Table.Cell>
												<Link href={client.href} mix={[weight("medium")]}>
													{client.name}
												</Link>
											</Table.Cell>
											<Table.Cell mix={[font("mono")]}>{client.redirectUri}</Table.Cell>
											<Table.Cell>{client.createdAt}</Table.Cell>
											<Table.Cell>
												<div mix={[flex(), items("center"), gap(2)]}>
													<LinkButton
														href={client.href}
														size="sm"
														color="neutral"
														variant="outline"
													>
														{labels.actions.view}
													</LinkButton>
													<LinkButton
														href={client.editHref}
														size="sm"
														color="neutral"
														variant="outline"
													>
														{labels.actions.edit}
													</LinkButton>
													<ConfirmAction
														id={`delete-client-${client.id}`}
														size="sm"
														trigger={labels.actions.delete}
														title={labels.confirm.title}
														description={labels.confirm.description}
														confirmLabel={labels.confirm.confirm}
														cancelLabel={labels.confirm.cancel}
														fields={{ intent: "delete", clientId: client.id }}
													/>
												</div>
											</Table.Cell>
										</Table.Row>
									))}
								</Table.Body>
							</Table>
						</Table.Container>

						<ListPagination pagination={pagination} />
					</>
				)}
			</AdminLayout>
		);
	};
}
