import { redirect } from "@pkg/http/response";
import { ok } from "@pkg/http/response/html";
import controller from "@pkg/remix-helpers/controller";
import { succeeded } from "@pkg/result";
import { validate } from "@pkg/validate";
import { env } from "cloudflare:workers";
import { renderToString } from "remix/component/server";
import { defaulted, enum_, object, string } from "remix/data-schema";

import { CMSLayout } from "~/components/layout/cms";
import { Redirect } from "~/models/redirect";
import routes from "~/routes";
import { CMSRedirectsIndexView, CMSRedirectsNewView } from "~/views/cms/redirects";

let RedirectSchema = object({
	from: string(),
	to: string(),
	status: defaulted(enum_(["301", "302", "307", "308"]), "302"),
});

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

			let body = await renderToString(
				<CMSLayout title="Redirects" activePath={routes.cms.redirects.index.href()}>
					<CMSRedirectsIndexView items={items} />
				</CMSLayout>,
			);
			return ok(body);
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
			let body = await renderToString(
				<CMSLayout title="New Redirect" activePath={routes.cms.redirects.index.href()}>
					<CMSRedirectsNewView
						title="New Redirect"
						description={`Current redirect count in KV: ${redirects.length}.`}
						action={routes.cms.redirects.index.href()}
					/>
				</CMSLayout>,
			);
			return ok(body);
		},
	},
});

function getRedirectFromParam(id: string | undefined) {
	if (!id) return null;
	return Redirect.normalizePath(decodeURIComponent(id));
}
