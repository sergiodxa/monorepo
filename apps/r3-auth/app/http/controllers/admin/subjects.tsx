/**
 * GET /admin/subjects — one page of registered accounts, ten at a time. Read-only: the
 * actions that change or remove an account live on its own page, where the sessions and
 * provider links it would take with it are visible.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

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
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let page = readPageNumber(ctx.url);

		let [subjects, totalCount] = await Promise.all([
			Subject.findAll(db, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
			Subject.count(db),
		]);

		let chrome = toChrome(ctx, {
			documentTitle: ctx.i18next.t("admin.subjects.documentTitle"),
			heading: ctx.i18next.t("admin.subjects.title"),
			section: "subjects",
			breadcrumbs: [
				{ label: ctx.i18next.t("admin.nav.items.dashboard"), href: routes.admin.dashboard.href() },
			],
		});

		return ctx.render(
			<SubjectsView
				chrome={chrome}
				subjects={subjects.map((subject) => toSubjectRow(subject, ctx.locale))}
				pagination={toPagination(ctx.url, page, totalCount, {
					label: ctx.i18next.t("admin.pagination.label"),
					previous: ctx.i18next.t("admin.pagination.previous"),
					next: ctx.i18next.t("admin.pagination.next"),
				})}
				labels={{
					description: ctx.i18next.t("admin.subjects.description"),
					empty: ctx.i18next.t("admin.subjects.empty"),
					tableLabel: ctx.i18next.t("admin.subjects.title"),
					columns: {
						avatar: ctx.i18next.t("admin.subjects.table.avatar"),
						displayName: ctx.i18next.t("admin.subjects.table.displayName"),
						email: ctx.i18next.t("admin.subjects.table.email"),
						role: ctx.i18next.t("admin.subjects.table.role"),
						createdAt: ctx.i18next.t("admin.subjects.table.createdAt"),
						actions: ctx.i18next.t("admin.subjects.table.actions"),
					},
					actions: {
						view: ctx.i18next.t("admin.subjects.actions.view"),
						edit: ctx.i18next.t("admin.subjects.actions.edit"),
					},
					roles: {
						user: ctx.i18next.t("admin.subjects.roles.user"),
						admin: ctx.i18next.t("admin.subjects.roles.admin"),
					},
				}}
			/>,
		);
	}),
});
