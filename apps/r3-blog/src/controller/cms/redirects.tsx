import { redirect } from "@pkg/http/response";
import { ok } from "@pkg/http/response/html";
import controller from "@pkg/remix-helpers/controller";
import { env } from "cloudflare:workers";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { CMSLayout } from "~/components/layout/cms";
import { Redirect } from "~/models/redirect";
import { CMSRedirectsIndexView, CMSRedirectsNewView } from "~/views/cms/redirects";

export default controller<typeof routes.cms.redirects>({
	middleware: [],

	actions: {
		async index() {
			let redirects = await Redirect.findAll(env.REDIRECTS);
			let items: Array<CMSRedirectsIndexView.Item> = redirects.map((item) => ({
				from: item.from,
				to: item.to,
				status: item.status,
				deleteAction: `/cms/redirects/${encodeURIComponent(item.from)}`,
			}));

			let body = await renderToString(
				<CMSLayout title="Redirects" activePath="/cms/redirects">
					<CMSRedirectsIndexView items={items} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async create(ctx) {
			let formData = ctx.formData;
			let from = Redirect.normalizePath(readString(formData, "from"));
			let to = readString(formData, "to");
			let status = parseStatus(readString(formData, "status"));

			if (!from || !to) {
				return redirect("/cms/redirects/new", { status: redirect.Status.SeeOther });
			}

			await Redirect.upsert(env.REDIRECTS, { from, to, status });
			return redirect("/cms/redirects", { status: redirect.Status.SeeOther });
		},

		async destroy(ctx) {
			let from = getRedirectFromParam(ctx.params.id);
			if (!from) return redirect("/cms/redirects", { status: redirect.Status.SeeOther });

			await Redirect.destroy(env.REDIRECTS, from);
			return redirect("/cms/redirects", { status: redirect.Status.SeeOther });
		},

		async new() {
			let redirects = await Redirect.findAll(env.REDIRECTS);
			let body = await renderToString(
				<CMSLayout title="New Redirect" activePath="/cms/redirects">
					<CMSRedirectsNewView
						title="New Redirect"
						description={`Current redirect count in KV: ${redirects.length}.`}
						action="/cms/redirects"
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

function readString(formData: FormData, key: string) {
	let value = formData.get(key);
	if (typeof value !== "string") return "";
	return value.trim();
}

function parseStatus(value: string): Redirect.Status {
	if (value === "301") return 301;
	if (value === "302") return 302;
	if (value === "307") return 307;
	if (value === "308") return 308;
	return 302;
}
