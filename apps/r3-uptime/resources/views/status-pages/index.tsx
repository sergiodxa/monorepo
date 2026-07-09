/**
 * Status pages list page: name, slug (linking to the public page), attached-item
 * count, visibility, and edit/delete actions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { SelectStatusPage } from "~/database/schema";

import Badge from "~/resources/components/badge";
import EmptyState from "~/resources/components/empty-state";
import * as s from "~/resources/styles";
import routes from "~/routes/web";

namespace StatusPagesView {
	export interface Props {
		team: { slug: string };
		pages: SelectStatusPage[];
		countsByPageId: Map<string, number>;
	}
}

export default function StatusPagesView(handle: Handle<StatusPagesView.Props>) {
	return () => {
		let { team, pages, countsByPageId } = handle.props;

		return (
			<div>
				<div mix={[s.row]}>
					<h1>Status pages</h1>
					<a href={routes.app.team.statusPageNew.href({ team: team.slug })} mix={[s.buttonPrimary]}>
						New status page
					</a>
				</div>

				{pages.length === 0 ? (
					<EmptyState
						message="No status pages yet."
						action={{
							href: routes.app.team.statusPageNew.href({ team: team.slug }),
							label: "Create your first status page",
						}}
					/>
				) : (
					<table mix={[s.table]}>
						<thead>
							<tr>
								<th>Name</th>
								<th>Slug</th>
								<th>Services</th>
								<th>Visibility</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							{pages.map((page) => (
								<tr key={page.id}>
									<td>{page.name}</td>
									<td>
										<a
											href={routes.statusPage.href({ slug: page.slug })}
											target="_blank"
											rel="noreferrer"
											mix={[s.link]}
										>
											/status/{page.slug}
										</a>
									</td>
									<td>{countsByPageId.get(page.id) ?? 0}</td>
									<td>
										<Badge tone={page.is_public ? "up" : "neutral"}>
											{page.is_public ? "Public" : "Private"}
										</Badge>
									</td>
									<td>
										<a
											href={routes.app.team.statusPageEdit.href({
												team: team.slug,
												statusPageId: page.id,
											})}
											mix={[s.link]}
										>
											Edit
										</a>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		);
	};
}
