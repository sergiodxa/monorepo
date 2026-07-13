/**
 * Status pages list page: name, slug (linking to the public page), attached-item
 * count, visibility, and edit/delete actions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type { SelectStatusPage } from "~/database/schema";

import Badge from "~/resources/components/badge";
import EmptyState from "~/resources/components/empty-state";
import { neutral, primary } from "~/resources/theme";
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
				{pages.length === 0 ? (
					<EmptyState
						message="No status pages yet."
						action={{
							href: routes.app.team.statusPages.new.href({ team: team.slug }),
							label: "Create your first status page",
						}}
					/>
				) : (
					<div mix={[css({ overflowX: "auto" })]}>
						<table
							mix={[
								css({
									width: "100%",
									borderCollapse: "collapse",
									fontSize: "0.875rem",
									"& th, & td": {
										textAlign: "left",
										padding: "12px 16px",
										borderBottom: `1px solid ${neutral[200]}`,
									},
									"@media (prefers-color-scheme: dark)": {
										"& th, & td": { borderColor: neutral[800] },
									},
								}),
							]}
						>
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
												mix={[
													css({
														color: primary[600],
														textDecoration: "none",
														"&:hover": { textDecoration: "underline" },
														"@media (prefers-color-scheme: dark)": { color: primary[400] },
													}),
												]}
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
												href={routes.app.team.statusPages.edit.href({
													team: team.slug,
													statusPageId: page.id,
												})}
												mix={[
													css({
														color: primary[600],
														textDecoration: "none",
														"&:hover": { textDecoration: "underline" },
														"@media (prefers-color-scheme: dark)": { color: primary[400] },
													}),
												]}
											>
												Edit
											</a>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		);
	};
}
