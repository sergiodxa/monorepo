/**
 * GET /admin/subjects — one page of registered accounts, ten at a time. Read-only: the
 * actions that change or remove an account live on its own page, where the sessions and
 * provider links it would take with it are visible.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import Subject from "~/app/data/subject";
import requireAdmin from "~/app/http/middleware/require-admin";
import {
	PAGE_SIZE,
	readPageNumber,
	toChrome,
	toPagination,
	toSubjectRow,
} from "~/app/http/view-models/admin";
import SubjectsView from "~/resources/views/admin/subjects";
import routes from "~/routes/web";

export default createAction(routes.admin.subjects, {
	middleware: [requireAdmin],
	/** Renders one page of subjects with links to each account's detail and edit pages. */
	handler: async (ctx) => {
		let page = readPageNumber(ctx.url);

		let [subjects, totalCount] = await Promise.all([
			Subject.findAll(ctx.db, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
			Subject.count(ctx.db),
		]);

		let chrome = toChrome(ctx, {
			documentTitle: ctx.intl.t("admin.subjects.documentTitle"),
			heading: ctx.intl.t("admin.subjects.title"),
			section: "subjects",
			breadcrumbs: [
				{ label: ctx.intl.t("admin.nav.items.dashboard"), href: routes.admin.dashboard.href() },
			],
		});

		return ctx.render(
			<SubjectsView
				chrome={chrome}
				subjects={subjects.map((subject) => toSubjectRow(subject, ctx.locale))}
				pagination={toPagination(ctx.url, page, totalCount, {
					label: ctx.intl.t("admin.pagination.label"),
					previous: ctx.intl.t("admin.pagination.previous"),
					next: ctx.intl.t("admin.pagination.next"),
				})}
				labels={{
					description: ctx.intl.t("admin.subjects.description"),
					empty: ctx.intl.t("admin.subjects.empty"),
					tableLabel: ctx.intl.t("admin.subjects.title"),
					columns: {
						avatar: ctx.intl.t("admin.subjects.table.avatar"),
						displayName: ctx.intl.t("admin.subjects.table.displayName"),
						email: ctx.intl.t("admin.subjects.table.email"),
						role: ctx.intl.t("admin.subjects.table.role"),
						createdAt: ctx.intl.t("admin.subjects.table.createdAt"),
						actions: ctx.intl.t("admin.subjects.table.actions"),
					},
					actions: {
						view: ctx.intl.t("admin.subjects.actions.view"),
						edit: ctx.intl.t("admin.subjects.actions.edit"),
					},
					roles: {
						user: ctx.intl.t("admin.subjects.roles.user"),
						admin: ctx.intl.t("admin.subjects.roles.admin"),
					},
				}}
			/>,
		);
	},
});
