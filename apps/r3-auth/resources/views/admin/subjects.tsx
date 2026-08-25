/**
 * The registered-subjects listing: one page of accounts in a table with avatar, name,
 * address and role, each row linking to its detail and edit pages. It is read-only —
 * deleting an account happens on the detail page, where the consequences are visible.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { flex, flexCol, gap, items } from "@pkg/u/layout";
import { mbe } from "@pkg/u/size";
import { weight } from "@pkg/u/typography";
import { Avatar, Badge, Description, Empty, Link, LinkButton, Table, Text } from "@pkg/ui";

import type { AdminView } from "~/app/http/view-models/admin";

import AdminLayout from "~/resources/layouts/admin";
import ListPagination from "~/resources/views/admin/pagination";

namespace SubjectsView {
	export interface Labels {
		description: string;
		empty: string;
		columns: {
			avatar: string;
			displayName: string;
			email: string;
			role: string;
			createdAt: string;
			actions: string;
		};
		actions: { view: string; edit: string };
		roles: { user: string; admin: string };
		tableLabel: string;
	}

	export interface Props {
		chrome: AdminView.Chrome;
		labels: Labels;
		subjects: AdminView.SubjectRow[];
		pagination: AdminView.Pagination;
	}
}

/**
 * Renders the paginated subject list. The name cell stacks `Link` and `Text` in
 * a flex column so the username lands on its own line, since `Text` renders inline
 * by default.
 */
export default function SubjectsView(handle: Handle<SubjectsView.Props>) {
	return () => {
		let { chrome, labels, subjects, pagination } = handle.props;

		return (
			<AdminLayout chrome={chrome}>
				<Description mix={[mbe(6)]}>{labels.description}</Description>

				{subjects.length === 0 ? (
					<Empty>
						<Empty.Title>{labels.empty}</Empty.Title>
					</Empty>
				) : (
					<>
						<Table.Container>
							<Table aria-label={labels.tableLabel}>
								<Table.Header>
									<Table.Row>
										<Table.Column>{labels.columns.avatar}</Table.Column>
										<Table.Column>{labels.columns.displayName}</Table.Column>
										<Table.Column>{labels.columns.email}</Table.Column>
										<Table.Column>{labels.columns.role}</Table.Column>
										<Table.Column>{labels.columns.createdAt}</Table.Column>
										<Table.Column>{labels.columns.actions}</Table.Column>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{subjects.map((subject) => (
										<Table.Row key={subject.id}>
											<Table.Cell>
												<Avatar>
													<Avatar.Image src={subject.avatar} alt={subject.displayName} />
													<Avatar.Fallback>{subject.initials}</Avatar.Fallback>
												</Avatar>
											</Table.Cell>
											<Table.Cell>
												<div mix={[flex(), flexCol()]}>
													<Link href={subject.href} mix={[weight("medium")]}>
														{subject.displayName}
													</Link>
													<Text>{`@${subject.username}`}</Text>
												</div>
											</Table.Cell>
											<Table.Cell>{subject.emailAddress}</Table.Cell>
											<Table.Cell>
												<Badge color={subject.role === "admin" ? "brand" : "neutral"}>
													{subject.role === "admin" ? labels.roles.admin : labels.roles.user}
												</Badge>
											</Table.Cell>
											<Table.Cell>{subject.createdAt}</Table.Cell>
											<Table.Cell>
												<div mix={[flex(), items("center"), gap(2)]}>
													<LinkButton
														href={subject.href}
														size="sm"
														color="neutral"
														variant="outline"
													>
														{labels.actions.view}
													</LinkButton>
													<LinkButton
														href={subject.editHref}
														size="sm"
														color="neutral"
														variant="outline"
													>
														{labels.actions.edit}
													</LinkButton>
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
