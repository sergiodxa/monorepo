/**
 * GET/POST /admin/clients/:clientId — one relying party's registration, and the deletion
 * its confirmation posts. The rendered shape never reads the `secret` column, so this
 * page cannot become a way to read an existing secret back.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { badRequest } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createController } from "remix/router";

import Client from "~/app/data/client";
import Grant from "~/app/data/grant";
import defaultHandler from "~/app/http/controllers/default-handler";
import requireAdmin from "~/app/http/middleware/require-admin";
import { ClientIntentSchema } from "~/app/http/validators/admin";
import { toChrome, toClientDetail } from "~/app/http/view-models/admin";
import ClientDetailView from "~/resources/views/admin/client-detail";
import routes from "~/routes/web";

export default createController(routes.admin.client, {
	middleware: [requireAdmin],
	actions: {
		/** GET /admin/clients/:clientId — renders the registration and its consent count. */
		index: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let clientId = ctx.params.clientId!;

			let [client, authorizedUsers] = await Promise.all([
				Client.findById(db, clientId),
				Grant.countByClientId(db, clientId),
			]);

			if (!client) {
				ctx.logger.info("admin_client_not_found", { clientId });
				return defaultHandler(ctx);
			}

			let chrome = toChrome(ctx, {
				documentTitle: client.name,
				heading: client.name,
				section: "clients",
				breadcrumbs: [
					{
						label: ctx.i18next.t("admin.nav.items.dashboard"),
						href: routes.admin.dashboard.href(),
					},
					{ label: ctx.i18next.t("admin.clients.title"), href: routes.admin.clients.index.href() },
				],
			});

			return ctx.render(
				<ClientDetailView
					chrome={chrome}
					client={toClientDetail(client, ctx.locale)}
					authorizedUsers={authorizedUsers}
					editHref={routes.admin.clientEdit.index.href({ clientId })}
					labels={{
						id: ctx.i18next.t("admin.clients.detail.id"),
						name: ctx.i18next.t("admin.clients.detail.name"),
						description: ctx.i18next.t("admin.clients.detail.description"),
						noDescription: ctx.i18next.t("admin.clients.detail.noDescription"),
						secret: ctx.i18next.t("admin.clients.detail.secret"),
						secretHidden: ctx.i18next.t("admin.clients.detail.secretHidden"),
						redirectUri: ctx.i18next.t("admin.clients.detail.redirectUri"),
						logoutUri: ctx.i18next.t("admin.clients.detail.logoutUri"),
						backchannelLogoutUri: ctx.i18next.t("admin.clients.detail.backchannelLogoutUri"),
						frontchannelLogoutUri: ctx.i18next.t("admin.clients.detail.frontchannelLogoutUri"),
						sessionRequired: ctx.i18next.t("admin.clients.detail.sessionRequired"),
						notSet: ctx.i18next.t("admin.clients.detail.notSet"),
						authorizedUsers: ctx.i18next.t("admin.clients.detail.authorizedUsers"),
						createdAt: ctx.i18next.t("admin.clients.detail.createdAt"),
						edit: ctx.i18next.t("admin.clients.actions.edit"),
						delete: ctx.i18next.t("admin.clients.actions.delete"),
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

		/** POST /admin/clients/:clientId — deletes this client and every consent for it. */
		action: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let clientId = ctx.params.clientId!;

			let result = await validate(ctx.formData, ClientIntentSchema);
			if (isFailure(result)) {
				ctx.logger.error("admin_client_invalid_intent", { clientId });
				return badRequest({ error: "invalid_intent" });
			}

			// Grants before the client, for the same reason the list page does it: a
			// deletion interrupted between the two leaves no row pointing at nothing.
			await Grant.deleteByClientId(db, clientId);
			await Client.delete(db, clientId);

			ctx.logger.info("admin_client_deleted", { clientId });

			return redirect(routes.admin.clients.index.href(), { status: redirect.Status.SeeOther });
		}),
	},
});
