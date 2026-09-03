/**
 * GET/POST /admin/clients/:clientId/edit — updates a relying party's registration,
 * including both logout channels and their `session_required` flags, and rotates the
 * secret on request. A rotation renders the new secret once, because rotating
 * invalidates the copy the relying party currently holds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { redirect } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { inject } from "@sdxc/service-container";
import { validate } from "@sdxc/validate";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createController } from "remix/router";

import Client from "~/app/data/client";
import defaultHandler from "~/app/http/controllers/default-handler";
import requireAdmin from "~/app/http/middleware/require-admin";
import { UpdateClientSchema } from "~/app/http/validators/admin";
import { toChrome, toClientDetail } from "~/app/http/view-models/admin";
import ClientEditView from "~/resources/views/admin/client-edit";
import routes from "~/routes/web";

/** The page's chrome, shared by the form, a failed submission and the secret reveal. */
function chrome(ctx: RequestContext, clientName: string, clientId: string) {
	return toChrome(ctx, {
		documentTitle: ctx.i18next.t("admin.clients.edit.documentTitle", { name: clientName }),
		heading: ctx.i18next.t("admin.clients.edit.title"),
		section: "clients",
		breadcrumbs: [
			{ label: ctx.i18next.t("admin.nav.items.dashboard"), href: routes.admin.dashboard.href() },
			{ label: ctx.i18next.t("admin.clients.title"), href: routes.admin.clients.index.href() },
			{ label: clientName, href: routes.admin.client.index.href({ clientId }) },
		],
	});
}

/** Every string the edit page renders, resolved once per request. */
function labels(ctx: RequestContext) {
	return {
		title: ctx.i18next.t("admin.clients.edit.title"),
		description: ctx.i18next.t("admin.clients.edit.description"),
		fields: {
			name: {
				label: ctx.i18next.t("admin.clients.form.name.label"),
				placeholder: ctx.i18next.t("admin.clients.form.name.placeholder"),
			},
			description: {
				label: ctx.i18next.t("admin.clients.form.description.label"),
				placeholder: ctx.i18next.t("admin.clients.form.description.placeholder"),
			},
			logoUrl: {
				label: ctx.i18next.t("admin.clients.form.logoUrl.label"),
				placeholder: ctx.i18next.t("admin.clients.form.logoUrl.placeholder"),
			},
			redirectUri: {
				label: ctx.i18next.t("admin.clients.form.redirectUri.label"),
				placeholder: ctx.i18next.t("admin.clients.form.redirectUri.placeholder"),
			},
			logoutUri: {
				label: ctx.i18next.t("admin.clients.form.logoutUri.label"),
				placeholder: ctx.i18next.t("admin.clients.form.logoutUri.placeholder"),
			},
			backchannelLogoutUri: {
				label: ctx.i18next.t("admin.clients.form.backchannelLogoutUri.label"),
				placeholder: ctx.i18next.t("admin.clients.form.backchannelLogoutUri.placeholder"),
			},
			frontchannelLogoutUri: {
				label: ctx.i18next.t("admin.clients.form.frontchannelLogoutUri.label"),
				placeholder: ctx.i18next.t("admin.clients.form.frontchannelLogoutUri.placeholder"),
			},
		},
		backchannelSessionRequired: ctx.i18next.t(
			"admin.clients.form.backchannelLogoutSessionRequired.label",
		),
		frontchannelSessionRequired: ctx.i18next.t(
			"admin.clients.form.frontchannelLogoutSessionRequired.label",
		),
		regenerateSecret: ctx.i18next.t("admin.clients.actions.regenerateSecret"),
		submit: ctx.i18next.t("admin.clients.form.submit"),
		cancel: ctx.i18next.t("admin.clients.form.cancel"),
		invalid: ctx.i18next.t("admin.clients.form.invalid"),
		secretRegenerated: ctx.i18next.t("admin.clients.edit.secretRegenerated"),
		secretWarning: ctx.i18next.t("admin.clients.create.secretWarning"),
		secret: ctx.i18next.t("admin.clients.detail.secret"),
		view: ctx.i18next.t("admin.clients.actions.view"),
		copy: ctx.i18next.t("admin.clients.actions.copy"),
		copied: ctx.i18next.t("admin.clients.actions.copied"),
	};
}

export default createController(routes.admin.clientEdit, {
	middleware: [requireAdmin],
	actions: {
		/** GET /admin/clients/:clientId/edit — renders the form filled from the stored row. */
		index: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let clientId = ctx.params.clientId!;

			let client = await Client.findById(db, clientId);
			if (!client) {
				ctx.logger.info("admin_client_not_found", { clientId });
				return defaultHandler(ctx);
			}

			return ctx.render(
				<ClientEditView
					chrome={chrome(ctx, client.name, clientId)}
					labels={labels(ctx)}
					client={toClientDetail(client, ctx.locale)}
					detailHref={routes.admin.client.index.href({ clientId })}
				/>,
			);
		}),

		/**
		 * POST /admin/clients/:clientId/edit — persists the edit, then either reveals a
		 * rotated secret or returns to the detail page.
		 */
		action: inject([Database] as const, async (db) => {
			let ctx = getContext();
			let clientId = ctx.params.clientId!;

			let existing = await Client.findById(db, clientId);
			if (!existing) {
				ctx.logger.info("admin_client_not_found", { clientId });
				return defaultHandler(ctx);
			}

			let result = await validate(ctx.formData, UpdateClientSchema);
			if (isFailure(result)) {
				ctx.logger.info("admin_client_update_invalid", { clientId });
				return ctx.render(
					<ClientEditView
						chrome={chrome(ctx, existing.name, clientId)}
						labels={labels(ctx)}
						client={toClientDetail(existing, ctx.locale)}
						detailHref={routes.admin.client.index.href({ clientId })}
						issues={result.error.issues}
					/>,
					{ status: 400 },
				);
			}

			let input = result.data;
			let updated = await Client.update(db, clientId, {
				name: input.name,
				description: input.description,
				logo_url: input.logoUrl,
				redirect_uri: input.redirectUri,
				logout_uri: input.logoutUri,
				backchannel_logout_uri: input.backchannelLogoutUri,
				backchannel_logout_session_required: input.backchannelLogoutSessionRequired,
				frontchannel_logout_uri: input.frontchannelLogoutUri,
				frontchannel_logout_session_required: input.frontchannelLogoutSessionRequired,
				regenerateSecret: input.regenerateSecret,
			});

			ctx.logger.info("admin_client_updated", {
				clientId,
				secretRotated: input.regenerateSecret,
			});

			if (updated.newSecret) {
				return ctx.render(
					<ClientEditView
						chrome={chrome(ctx, updated.name, clientId)}
						labels={labels(ctx)}
						client={toClientDetail(updated, ctx.locale)}
						detailHref={routes.admin.client.index.href({ clientId })}
						newSecret={updated.newSecret}
					/>,
				);
			}

			return redirect(routes.admin.client.index.href({ clientId }), {
				status: redirect.Status.SeeOther,
			});
		}),
	},
});
