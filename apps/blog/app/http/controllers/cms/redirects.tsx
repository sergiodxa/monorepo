/**
 * CMS controller for URL redirect rules backed by the REDIRECTS KV namespace. It renders
 * the index and creation form and handles create and destroy actions, normalizing and
 * URI-encoding source paths so nested paths survive as route params. It exists to let
 * operators manage redirect rules through the backoffice against the shared redirects service.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { succeeded } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { getContext } from "remix/middleware/async-context";
import { createController } from "remix/router";

import { Redirect } from "~/app/repositories/redirect";
import { RedirectSchema } from "~/app/schemas/cms/redirect";
import { RedirectsService } from "~/app/services/redirects";
import { CMSRedirectsIndexView, CMSRedirectsNewView } from "~/resources/views/cms/redirects";
import routes from "~/routes/web";

/**
 * CMS redirect CRUD backed by the REDIRECTS KV namespace. Auth and CMS scoping are resolved
 * by higher-level route composition before these actions execute.
 */
export default createController(routes.cms.redirects, {
	/**
	 * Every action runs under the globally applied middleware alone and resolves redirect
	 * persistence through the redirects service.
	 */
	middleware: [],

	actions: {
		/**
		 * Redirect sources are URI-encoded when building `deleteAction` so nested paths like
		 * `/docs/getting-started` survive as a single route param.
		 *
		 * @returns SSR HTML view model for the CMS redirects listing page.
		 */
		index: inject([RedirectsService] as const, async (redirectsService) => {
			let ctx = getContext();
			let redirects = await redirectsService.findAll();
			let items: Array<CMSRedirectsIndexView.Item> = redirects.map((item) => ({
				from: item.from,
				to: item.to,
				status: item.status,
				deleteAction: routes.cms.redirects.destroy.href({ id: encodeURIComponent(item.from) }),
			}));

			return ctx.render(CMSRedirectsIndexView, { items });
		}),

		/**
		 * Invalid payloads fail fast through `succeeded(...)`, while a blank or non-normalizable
		 * path counts as a recoverable UX error and returns to the creation form.
		 *
		 * @param ctx - Request context providing form data extraction and params.
		 * @returns See Other redirect to `new` on missing paths, otherwise `index`.
		 */
		create: inject([RedirectsService] as const, async (redirectsService) => {
			let ctx = getContext();
			let result = await validate(ctx.get(FormData), RedirectSchema);
			succeeded(result, "Invalid redirect form data");

			let from = Redirect.normalizePath(result.data.from);
			let to = result.data.to;
			let status = Number(result.data.status) as Redirect.Status;

			if (!from || !to) {
				return redirect(routes.cms.redirects.new.href(), { status: redirect.Status.SeeOther });
			}

			await redirectsService.upsert({ from, to, status });
			return redirect(routes.cms.redirects.index.href(), { status: redirect.Status.SeeOther });
		}),

		/**
		 * A malformed or empty `:id` resolves to a plain redirect, so delete links stay idempotent
		 * and a decoding failure ends as a harmless navigation.
		 *
		 * @param ctx - Request context exposing route params.
		 * @returns See Other redirect to the redirects index in all cases.
		 */
		destroy: inject([RedirectsService] as const, async (redirectsService) => {
			let ctx = getContext();
			let from = getRedirectFromParam(ctx.params.id);
			if (!from)
				return redirect(routes.cms.redirects.index.href(), { status: redirect.Status.SeeOther });

			await redirectsService.destroy(from);
			return redirect(routes.cms.redirects.index.href(), { status: redirect.Status.SeeOther });
		}),

		/**
		 * The live KV redirect count is informational and helps operators gauge namespace usage
		 * while creating rules.
		 *
		 * @returns SSR HTML view model for the CMS "New Redirect" page.
		 */
		new: inject([RedirectsService] as const, async (redirectsService) => {
			let ctx = getContext();
			let redirects = await redirectsService.findAll();
			return ctx.render(CMSRedirectsNewView, {
				title: "New Redirect",
				description: `Current redirect count in KV: ${redirects.length}.`,
				action: routes.cms.redirects.index.href(),
			});
		}),
	},
});

/**
 * Returns `null` when no usable path can be produced, so callers can short-circuit
 * destructive operations.
 *
 * @param id - URI-encoded redirect source path captured from `:id`.
 * @returns Normalized path string when valid, otherwise `null`.
 */
function getRedirectFromParam(id: string | undefined) {
	if (!id) return null;
	return Redirect.normalizePath(decodeURIComponent(id));
}
