import { redirect } from "@pkg/http/response";
import { succeeded } from "@pkg/result";
import { validate } from "@pkg/validate";
import { createController } from "remix/fetch-router";

import { getEnv } from "~/app/http/middleware/env";
import { Redirect } from "~/app/repositories/redirect";
import { RedirectSchema } from "~/app/schemas/cms/redirect";
import { CMSRedirectsIndexView, CMSRedirectsNewView } from "~/resources/views/cms/redirects";
import routes from "~/routes/web";

/**
 * CMS controller for redirect CRUD screens backed by the REDIRECTS KV namespace.
 *
 * The route is intentionally middleware-free because auth and CMS scoping are
 * resolved by higher-level route composition before these actions execute.
 */
export default createController(routes.cms.redirects, {
	/**
	 * No local middleware is registered for this controller.
	 *
	 * Contract: every action runs with only globally-applied middleware and reads
	 * environment bindings directly through {@link getEnv}.
	 */
	middleware: [],

	actions: {
		/**
		 * Renders the redirects index with one delete endpoint per stored rule.
		 *
		 * Non-obvious behavior: redirect sources are URI-encoded when building
		 * `deleteAction` so paths like `/docs/getting-started` survive route params.
		 *
		 * @returns SSR HTML view model for the CMS redirects listing page.
		 */
		async index(ctx) {
			let redirects = await Redirect.findAll(getEnv("REDIRECTS"));
			let items: Array<CMSRedirectsIndexView.Item> = redirects.map((item) => ({
				from: item.from,
				to: item.to,
				status: item.status,
				deleteAction: routes.cms.redirects.destroy.href({ id: encodeURIComponent(item.from) }),
			}));

			return ctx.render(CMSRedirectsIndexView, { items });
		},

		/**
		 * Validates the create form, normalizes the source path, and upserts KV data.
		 *
		 * Contract: invalid payloads fail fast through `succeeded(...)`; blank or
		 * non-normalizable paths are treated as recoverable UX errors and redirected
		 * back to the creation form.
		 *
		 * @param ctx - Request context providing form data extraction and params.
		 * @returns See Other redirect to `new` on missing paths, otherwise `index`.
		 */
		async create(ctx) {
			let result = await validate(ctx.get(FormData), RedirectSchema);
			succeeded(result, "Invalid redirect form data");

			let from = Redirect.normalizePath(result.data.from);
			let to = result.data.to;
			let status = Number(result.data.status) as Redirect.Status;

			if (!from || !to) {
				return redirect(routes.cms.redirects.new.href(), { status: redirect.Status.SeeOther });
			}

			await Redirect.upsert(getEnv("REDIRECTS"), { from, to, status });
			return redirect(routes.cms.redirects.index.href(), { status: redirect.Status.SeeOther });
		},

		/**
		 * Deletes a redirect resolved from the encoded `:id` route segment.
		 *
		 * Non-obvious behavior: malformed or empty params are handled as no-ops to
		 * keep delete links idempotent and avoid surfacing decoding failures in CMS.
		 *
		 * @param ctx - Request context exposing route params.
		 * @returns See Other redirect to the redirects index in all cases.
		 */
		async destroy(ctx) {
			let from = getRedirectFromParam(ctx.params.id);
			if (!from)
				return redirect(routes.cms.redirects.index.href(), { status: redirect.Status.SeeOther });

			await Redirect.destroy(getEnv("REDIRECTS"), from);
			return redirect(routes.cms.redirects.index.href(), { status: redirect.Status.SeeOther });
		},

		/**
		 * Renders the redirect creation form with a live KV redirect count.
		 *
		 * The count is informational only and helps operators estimate namespace
		 * usage while creating new rules.
		 *
		 * @returns SSR HTML view model for the CMS "New Redirect" page.
		 */
		async new(ctx) {
			let redirects = await Redirect.findAll(getEnv("REDIRECTS"));
			return ctx.render(CMSRedirectsNewView, {
				title: "New Redirect",
				description: `Current redirect count in KV: ${redirects.length}.`,
				action: routes.cms.redirects.index.href(),
			});
		},
	},
});

/**
 * Decodes and normalizes a redirect source path from route params.
 *
 * Contract: returns `null` when no usable path can be produced, so callers can
 * safely short-circuit destructive operations.
 *
 * @param id - URI-encoded redirect source path captured from `:id`.
 * @returns Normalized path string when valid, otherwise `null`.
 */
function getRedirectFromParam(id: string | undefined) {
	if (!id) return null;
	return Redirect.normalizePath(decodeURIComponent(id));
}
