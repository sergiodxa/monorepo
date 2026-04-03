import { redirect } from "@pkg/http/response";
import controller from "@pkg/remix-helpers/controller";
import { succeeded } from "@pkg/result";
import { validate } from "@pkg/validate";
import { env } from "cloudflare:workers";

import { view } from "~/app/infrastructure/view";
import { Redirect } from "~/app/repositories/redirect";
import { RedirectSchema } from "~/app/schemas/cms/redirect";
import { CMSRedirectsIndexView, CMSRedirectsNewView } from "~/resources/views/cms/redirects";
import routes from "~/routes/web";

export default controller<typeof routes.cms.redirects>({
	middleware: [],

	actions: {
		async index() {
			let redirects = await Redirect.findAll(env.REDIRECTS);
			let items: Array<CMSRedirectsIndexView.Item> = redirects.map((item) => ({
				from: item.from,
				to: item.to,
				status: item.status,
				deleteAction: routes.cms.redirects.destroy.href({ id: encodeURIComponent(item.from) }),
			}));

			return view(CMSRedirectsIndexView, { items });
		},

		async create(ctx) {
			let result = await validate(ctx.get(FormData), RedirectSchema);
			succeeded(result, "Invalid redirect form data");

			let from = Redirect.normalizePath(result.data.from);
			let to = result.data.to;
			let status = Number(result.data.status) as Redirect.Status;

			if (!from || !to) {
				return redirect(routes.cms.redirects.new.href(), { status: redirect.Status.SeeOther });
			}

			await Redirect.upsert(env.REDIRECTS, { from, to, status });
			return redirect(routes.cms.redirects.index.href(), { status: redirect.Status.SeeOther });
		},

		async destroy(ctx) {
			let from = getRedirectFromParam(ctx.params.id);
			if (!from)
				return redirect(routes.cms.redirects.index.href(), { status: redirect.Status.SeeOther });

			await Redirect.destroy(env.REDIRECTS, from);
			return redirect(routes.cms.redirects.index.href(), { status: redirect.Status.SeeOther });
		},

		async new() {
			let redirects = await Redirect.findAll(env.REDIRECTS);
			return view(CMSRedirectsNewView, {
				title: "New Redirect",
				description: `Current redirect count in KV: ${redirects.length}.`,
				action: routes.cms.redirects.index.href(),
			});
		},
	},
});

function getRedirectFromParam(id: string | undefined) {
	if (!id) return null;
	return Redirect.normalizePath(decodeURIComponent(id));
}
