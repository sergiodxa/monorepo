/**
 * GET/POST /admin/clients — one page of registered relying parties, and the deletion a
 * row's confirmation posts. Deleting a client removes every consent given to it first,
 * so with no transactions available an interrupted deletion still leaves every grant
 * pointing at a client that exists.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { badRequest } from "@sdxc/http/response/json";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";

import abilities from "~/app/authz/abilities";
import subjectAccess, { requireAdminArea } from "~/app/http/middleware/access";
import requireSubject from "~/app/http/middleware/require-subject";
import { ClientsIntentSchema } from "~/app/http/validators/admin";
import {
	PAGE_SIZE,
	readPageNumber,
	toChrome,
	toClientRow,
	toPagination,
} from "~/app/http/view-models/admin";
import ClientsView from "~/resources/views/admin/clients";
import routes from "~/routes/web";

export default createController(routes.admin.clients, {
	middleware: [requireSubject, subjectAccess, requireAdminArea],
	actions: {
		/** GET /admin/clients — renders one page of clients with their row actions. */
		index: async (ctx) => {
			let page = readPageNumber(ctx.url);

			let [clients, totalCount] = await Promise.all([
				ctx.models.clients.page({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
				ctx.models.clients.query().count(),
			]);

			let chrome = toChrome(ctx, {
				documentTitle: ctx.intl.t("admin.clients.documentTitle"),
				heading: ctx.intl.t("admin.clients.title"),
				section: "clients",
				breadcrumbs: [
					{
						label: ctx.intl.t("admin.nav.items.dashboard"),
						href: routes.admin.dashboard.href(),
					},
				],
			});

			return ctx.render(
				<ClientsView
					chrome={chrome}
					createHref={routes.admin.clientNew.index.href()}
					clients={clients.map((client) =>
						toClientRow(client, ctx.locale, ctx.access.decide(abilities.admin.client, { client })),
					)}
					pagination={toPagination(ctx.url, page, totalCount, {
						label: ctx.intl.t("admin.pagination.label"),
						previous: ctx.intl.t("admin.pagination.previous"),
						next: ctx.intl.t("admin.pagination.next"),
					})}
					labels={{
						description: ctx.intl.t("admin.clients.description"),
						empty: ctx.intl.t("admin.clients.empty"),
						create: ctx.intl.t("admin.clients.actions.create"),
						tableLabel: ctx.intl.t("admin.clients.title"),
						columns: {
							name: ctx.intl.t("admin.clients.table.name"),
							redirectUri: ctx.intl.t("admin.clients.table.redirectUri"),
							createdAt: ctx.intl.t("admin.clients.table.createdAt"),
							actions: ctx.intl.t("admin.clients.table.actions"),
						},
						actions: {
							view: ctx.intl.t("admin.clients.actions.view"),
							edit: ctx.intl.t("admin.clients.actions.edit"),
							delete: ctx.intl.t("admin.clients.actions.delete"),
						},
						confirm: {
							title: ctx.intl.t("admin.clients.delete.title"),
							description: ctx.intl.t("admin.clients.delete.confirm"),
							confirm: ctx.intl.t("admin.clients.actions.delete"),
							cancel: ctx.intl.t("admin.clients.delete.cancel"),
						},
					}}
				/>,
			);
		},

		/**
		 * POST /admin/clients — deletes the client a row's confirmation named. The id comes
		 * from the body, so the check runs here once it validates; a refused one changes
		 * nothing and lands back on the list.
		 */
		action: async (ctx) => {
			let result = await validate(ctx.formData, ClientsIntentSchema);
			if (isFailure(result)) {
				ctx.log.warn("admin.client.intent_invalid");
				return badRequest({ error: "invalid_intent" });
			}

			let { clientId } = result.data;
			ctx.log.set({ client: { id: clientId } });

			let allowed = ctx.access.authorize(abilities.admin.client.delete, {
				client: { id: clientId },
			});
			if (isFailure(allowed)) {
				return redirect(routes.admin.clients.index.href(), { status: redirect.Status.SeeOther });
			}

			await ctx.models.grants.deleteByClientId(clientId);
			await ctx.models.clients.delete(clientId);

			ctx.log.note("admin.client.deleted");

			return redirect(routes.admin.clients.index.href(), { status: redirect.Status.SeeOther });
		},
	},
});
