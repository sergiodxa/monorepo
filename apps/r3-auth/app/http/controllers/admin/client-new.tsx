/**
 * GET/POST /admin/clients/new — registers a relying party and reveals its generated
 * secret exactly once. The success state renders that secret inline, because it exists
 * nowhere a later page can read it back.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { isFailure } from "@sdxc/result";
import { inject } from "@sdxc/service-container";
import { validate } from "@sdxc/validate";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createController } from "remix/router";

import Client from "~/app/data/client";
import requireAdmin from "~/app/http/middleware/require-admin";
import { CreateClientSchema } from "~/app/http/validators/admin";
import { toChrome } from "~/app/http/view-models/admin";
import ClientNewView from "~/resources/views/admin/client-new";
import routes from "~/routes/web";

/** The page's chrome, shared by the form, the failed submission and the reveal. */
function chrome(ctx: RequestContext) {
	return toChrome(ctx, {
		documentTitle: ctx.i18next.t("admin.clients.create.documentTitle"),
		heading: ctx.i18next.t("admin.clients.create.title"),
		section: "clients",
		breadcrumbs: [
			{ label: ctx.i18next.t("admin.nav.items.dashboard"), href: routes.admin.dashboard.href() },
			{ label: ctx.i18next.t("admin.clients.title"), href: routes.admin.clients.index.href() },
		],
	});
}

/** Every string the create page renders, resolved once per request. */
function labels(ctx: RequestContext) {
	return {
		title: ctx.i18next.t("admin.clients.create.title"),
		description: ctx.i18next.t("admin.clients.create.description"),
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
		},
		submit: ctx.i18next.t("admin.clients.form.submit"),
		cancel: ctx.i18next.t("admin.clients.form.cancel"),
		cancelHref: routes.admin.clients.index.href(),
		invalid: ctx.i18next.t("admin.clients.form.invalid"),
		success: ctx.i18next.t("admin.clients.create.success"),
		secretWarning: ctx.i18next.t("admin.clients.create.secretWarning"),
		detail: {
			id: ctx.i18next.t("admin.clients.detail.id"),
			secret: ctx.i18next.t("admin.clients.detail.secret"),
			redirectUri: ctx.i18next.t("admin.clients.detail.redirectUri"),
			logoutUri: ctx.i18next.t("admin.clients.detail.logoutUri"),
		},
		view: ctx.i18next.t("admin.clients.actions.view"),
		copy: ctx.i18next.t("admin.clients.actions.copy"),
		copied: ctx.i18next.t("admin.clients.actions.copied"),
	};
}

export default createController(routes.admin.clientNew, {
	middleware: [requireAdmin],
	actions: {
		/** GET /admin/clients/new — renders the empty registration form. */
		index() {
			let ctx = getContext();
			return ctx.render(<ClientNewView chrome={chrome(ctx)} labels={labels(ctx)} />);
		},

		/**
		 * POST /admin/clients/new — registers the client and renders its secret once.
		 *
		 * A validation failure re-renders the form with the issues addressed per field, so
		 * nothing the administrator typed is lost.
		 */
		action: inject([Database] as const, async (db) => {
			let ctx = getContext();

			let result = await validate(ctx.formData, CreateClientSchema);
			if (isFailure(result)) {
				ctx.logger.info("admin_client_create_invalid");
				return ctx.render(
					<ClientNewView chrome={chrome(ctx)} labels={labels(ctx)} issues={result.error.issues} />,
					{ status: 400 },
				);
			}

			let input = result.data;
			let client = await Client.create(db, {
				name: input.name,
				description: input.description,
				logo_url: input.logoUrl,
				redirect_uri: input.redirectUri,
				logout_uri: input.logoutUri,
			});

			ctx.logger.info("admin_client_created", { clientId: client.id });

			return ctx.render(
				<ClientNewView
					chrome={chrome(ctx)}
					labels={labels(ctx)}
					created={{
						id: client.id,
						name: client.name,
						secret: client.secret,
						redirectUri: client.redirect_uri,
						logoutUri: client.logout_uri,
						href: routes.admin.client.index.href({ clientId: client.id }),
					}}
				/>,
			);
		}),
	},
});
