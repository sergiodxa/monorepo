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
import { inject } from "@sdxc/service-container";
import { validate } from "@sdxc/validate";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createController } from "remix/router";

import Client from "~/app/data/client";
import Grant from "~/app/data/grant";
import requireAdmin from "~/app/http/middleware/require-admin";
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
	middleware: [requireAdmin],
	actions: {
		/** GET /admin/clients — renders one page of clients with their row actions. */
		index: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let page = readPageNumber(ctx.url);

			let [clients, totalCount] = await Promise.all([
				Client.findAll(db, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
				Client.count(db),
			]);

			let chrome = toChrome(ctx, {
				documentTitle: ctx.i18next.t("admin.clients.documentTitle"),
				heading: ctx.i18next.t("admin.clients.title"),
				section: "clients",
				breadcrumbs: [
					{
						label: ctx.i18next.t("admin.nav.items.dashboard"),
						href: routes.admin.dashboard.href(),
					},
				],
			});

			return ctx.render(
				<ClientsView
					chrome={chrome}
					createHref={routes.admin.clientNew.index.href()}
					clients={clients.map((client) => toClientRow(client, ctx.locale))}
					pagination={toPagination(ctx.url, page, totalCount, {
						label: ctx.i18next.t("admin.pagination.label"),
						previous: ctx.i18next.t("admin.pagination.previous"),
						next: ctx.i18next.t("admin.pagination.next"),
					})}
					labels={{
						description: ctx.i18next.t("admin.clients.description"),
						empty: ctx.i18next.t("admin.clients.empty"),
						create: ctx.i18next.t("admin.clients.actions.create"),
						tableLabel: ctx.i18next.t("admin.clients.title"),
						columns: {
							name: ctx.i18next.t("admin.clients.table.name"),
							redirectUri: ctx.i18next.t("admin.clients.table.redirectUri"),
							createdAt: ctx.i18next.t("admin.clients.table.createdAt"),
							actions: ctx.i18next.t("admin.clients.table.actions"),
						},
						actions: {
							view: ctx.i18next.t("admin.clients.actions.view"),
							edit: ctx.i18next.t("admin.clients.actions.edit"),
							delete: ctx.i18next.t("admin.clients.actions.delete"),
						},
						confirm: {
							title: ctx.i18next.t("admin.clients.delete.title"),
							description: ctx.i18next.t("admin.clients.delete.confirm"),
							confirm: ctx.i18next.t("admin.clients.actions.delete"),
							cancel: ctx.i18next.t("admin.clients.delete.cancel"),
						},
					}}
				/>,
			);
		}),

		/** POST /admin/clients — deletes the client a row's confirmation named. */
		action: inject([Database] as const, async (db) => {
			let ctx = getContext();

			let result = await validate(ctx.formData, ClientsIntentSchema);
			if (isFailure(result)) {
				ctx.log.warn("admin.client.intent_invalid");
				return badRequest({ error: "invalid_intent" });
			}

			let { clientId } = result.data;
			ctx.log.set({ client: { id: clientId } });

			await Grant.deleteByClientId(db, clientId);
			await Client.delete(db, clientId);

			ctx.log.note("admin.client.deleted");

			return redirect(routes.admin.clients.index.href(), { status: redirect.Status.SeeOther });
		}),
	},
});
