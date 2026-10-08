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
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";

import abilities from "~/app/authz/abilities";
import Client from "~/app/data/client";
import defaultHandler from "~/app/http/controllers/default-handler";
import subjectAccess, { requireAdminArea } from "~/app/http/middleware/access";
import requireClientAbility from "~/app/http/middleware/require-client-ability";
import requireSubject from "~/app/http/middleware/require-subject";
import { UpdateClientSchema } from "~/app/http/validators/admin";
import { toChrome, toClientDetail } from "~/app/http/view-models/admin";
import ClientEditView from "~/resources/views/admin/client-edit";
import routes from "~/routes/web";

/** The page's chrome, shared by the form, a failed submission and the secret reveal. */
function chrome(ctx: RequestContext, clientName: string, clientId: string) {
	return toChrome(ctx, {
		documentTitle: ctx.intl.t("admin.clients.edit.documentTitle", { name: clientName }),
		heading: ctx.intl.t("admin.clients.edit.title"),
		section: "clients",
		breadcrumbs: [
			{ label: ctx.intl.t("admin.nav.items.dashboard"), href: routes.admin.dashboard.href() },
			{ label: ctx.intl.t("admin.clients.title"), href: routes.admin.clients.index.href() },
			{ label: clientName, href: routes.admin.client.index.href({ clientId }) },
		],
	});
}

/** Every string the edit page renders, resolved once per request. */
function labels(ctx: RequestContext) {
	return {
		title: ctx.intl.t("admin.clients.edit.title"),
		description: ctx.intl.t("admin.clients.edit.description"),
		fields: {
			name: {
				label: ctx.intl.t("admin.clients.form.name.label"),
				placeholder: ctx.intl.t("admin.clients.form.name.placeholder"),
			},
			description: {
				label: ctx.intl.t("admin.clients.form.description.label"),
				placeholder: ctx.intl.t("admin.clients.form.description.placeholder"),
			},
			logoUrl: {
				label: ctx.intl.t("admin.clients.form.logoUrl.label"),
				placeholder: ctx.intl.t("admin.clients.form.logoUrl.placeholder"),
			},
			redirectUri: {
				label: ctx.intl.t("admin.clients.form.redirectUri.label"),
				placeholder: ctx.intl.t("admin.clients.form.redirectUri.placeholder"),
			},
			logoutUri: {
				label: ctx.intl.t("admin.clients.form.logoutUri.label"),
				placeholder: ctx.intl.t("admin.clients.form.logoutUri.placeholder"),
			},
			backchannelLogoutUri: {
				label: ctx.intl.t("admin.clients.form.backchannelLogoutUri.label"),
				placeholder: ctx.intl.t("admin.clients.form.backchannelLogoutUri.placeholder"),
			},
			frontchannelLogoutUri: {
				label: ctx.intl.t("admin.clients.form.frontchannelLogoutUri.label"),
				placeholder: ctx.intl.t("admin.clients.form.frontchannelLogoutUri.placeholder"),
			},
		},
		backchannelSessionRequired: ctx.intl.t(
			"admin.clients.form.backchannelLogoutSessionRequired.label",
		),
		frontchannelSessionRequired: ctx.intl.t(
			"admin.clients.form.frontchannelLogoutSessionRequired.label",
		),
		regenerateSecret: ctx.intl.t("admin.clients.actions.regenerateSecret"),
		submit: ctx.intl.t("admin.clients.form.submit"),
		cancel: ctx.intl.t("admin.clients.form.cancel"),
		invalid: ctx.intl.t("admin.clients.form.invalid"),
		secretRegenerated: ctx.intl.t("admin.clients.edit.secretRegenerated"),
		secretWarning: ctx.intl.t("admin.clients.create.secretWarning"),
		secret: ctx.intl.t("admin.clients.detail.secret"),
		view: ctx.intl.t("admin.clients.actions.view"),
		copy: ctx.intl.t("admin.clients.actions.copy"),
		copied: ctx.intl.t("admin.clients.actions.copied"),
	};
}

export default createController(routes.admin.clientEdit, {
	middleware: [
		requireSubject,
		subjectAccess,
		requireAdminArea,
		requireClientAbility(abilities.admin.client.update),
	],
	actions: {
		/** GET /admin/clients/:clientId/edit — renders the form filled from the stored row. */
		index: async (ctx) => {
			let clientId = ctx.params.clientId!;
			ctx.log.set({ client: { id: clientId } });

			let client = await Client.findById(ctx.db, clientId);
			if (!client) {
				ctx.log.note("admin.client.not_found");
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
		},

		/**
		 * POST /admin/clients/:clientId/edit — persists the edit, then either reveals a
		 * rotated secret or returns to the detail page.
		 */
		action: async (ctx) => {
			let clientId = ctx.params.clientId!;
			ctx.log.set({ client: { id: clientId } });

			let existing = await Client.findById(ctx.db, clientId);
			if (!existing) {
				ctx.log.note("admin.client.not_found");
				return defaultHandler(ctx);
			}

			let result = await validate(ctx.formData, UpdateClientSchema);
			if (isFailure(result)) {
				ctx.log.note("admin.client.update_invalid");
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
			let updated = await Client.update(ctx.db, clientId, {
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

			ctx.log.note("admin.client.updated", { secret_rotated: input.regenerateSecret });

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
		},
	},
});
