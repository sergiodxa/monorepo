import { notFound, ok } from "@pkg/http/response/html";
import controller from "@pkg/remix-helpers/controller";
import { env } from "cloudflare:workers";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { CMSLayout } from "~/components/layout/cms";
import { Redirect } from "~/models/redirect";
import { CMSRedirectsActionView, CMSRedirectsIndexView } from "~/views/cms/redirects";

namespace CMSRedirectsController {
	export interface RedirectItem {
		label: string;
		href: string;
	}
}

export default controller<typeof routes.cms.redirects>({
	middleware: [],

	actions: {
		async index(_ctx) {
			let redirects = await Redirect.findAll(env.REDIRECTS);
			let items: Array<CMSRedirectsController.RedirectItem> = redirects.map((item) => ({
				label: `${item.from} -> ${item.to} (${String(item.status)})`,
				href: `/cms/redirects/${encodeURIComponent(item.from)}`,
			}));

			let body = await renderToString(
				<CMSLayout title="Redirects" activePath="/cms/redirects">
					<CMSRedirectsIndexView items={items} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async create(_ctx) {
			let redirects = await Redirect.findAll(env.REDIRECTS);
			let body = await renderToString(
				<CMSLayout title="Create Redirect" activePath="/cms/redirects">
					<CMSRedirectsActionView
						title="Create Redirect"
						description={`Create Redirect. There are currently ${redirects.length} redirects in KV.`}
					/>
				</CMSLayout>,
			);
			return ok(body);
		},

		async destroy(ctx) {
			let from = getRedirectFromParam(ctx.params.id);
			let redirect = from ? await Redirect.findByPath(env.REDIRECTS, from) : null;
			if (!from || !redirect) {
				let body = await renderToString(
					<CMSLayout title="Redirect Not Found" activePath="/cms/redirects">
						<CMSRedirectsActionView
							title="Redirect Not Found"
							description={`Redirect ${ctx.params.id} was not found in KV.`}
						/>
					</CMSLayout>,
				);
				return notFound(body);
			}

			let body = await renderToString(
				<CMSLayout title={`Delete Redirect ${from}`} activePath="/cms/redirects">
					<CMSRedirectsActionView
						title={`Delete Redirect ${from}`}
						description={`Ready to delete redirect mapping ${from} -> ${redirect.to}.`}
					/>
				</CMSLayout>,
			);
			return ok(body);
		},

		async edit(ctx) {
			let from = getRedirectFromParam(ctx.params.id);
			let redirect = from ? await Redirect.findByPath(env.REDIRECTS, from) : null;
			if (!from || !redirect) {
				let body = await renderToString(
					<CMSLayout title="Redirect Not Found" activePath="/cms/redirects">
						<CMSRedirectsActionView
							title="Redirect Not Found"
							description={`Redirect ${ctx.params.id} was not found in KV.`}
						/>
					</CMSLayout>,
				);
				return notFound(body);
			}

			let body = await renderToString(
				<CMSLayout title={`Edit Redirect ${from}`} activePath="/cms/redirects">
					<CMSRedirectsActionView
						title={`Edit Redirect ${from}`}
						description={`Editing redirect mapping ${from} -> ${redirect.to}.`}
					/>
				</CMSLayout>,
			);
			return ok(body);
		},

		async new(_ctx) {
			let redirects = await Redirect.findAll(env.REDIRECTS);
			let body = await renderToString(
				<CMSLayout title="New Redirect" activePath="/cms/redirects">
					<CMSRedirectsActionView
						title="New Redirect"
						description={`New Redirect form loaded. Current redirect count in KV: ${redirects.length}.`}
					/>
				</CMSLayout>,
			);
			return ok(body);
		},

		async show(ctx) {
			let from = getRedirectFromParam(ctx.params.id);
			let redirect = from ? await Redirect.findByPath(env.REDIRECTS, from) : null;
			if (!from || !redirect) {
				let body = await renderToString(
					<CMSLayout title="Redirect Not Found" activePath="/cms/redirects">
						<CMSRedirectsActionView
							title="Redirect Not Found"
							description={`Redirect ${ctx.params.id} was not found in KV.`}
						/>
					</CMSLayout>,
				);
				return notFound(body);
			}

			let body = await renderToString(
				<CMSLayout title={`Redirect ${from}`} activePath="/cms/redirects">
					<CMSRedirectsActionView
						title={`Redirect ${from}`}
						description={`Redirect ${from} currently points to ${redirect.to} with status ${String(redirect.status)}.`}
					/>
				</CMSLayout>,
			);
			return ok(body);
		},

		async update(ctx) {
			let from = getRedirectFromParam(ctx.params.id);
			let redirect = from ? await Redirect.findByPath(env.REDIRECTS, from) : null;
			if (!from || !redirect) {
				let body = await renderToString(
					<CMSLayout title="Redirect Not Found" activePath="/cms/redirects">
						<CMSRedirectsActionView
							title="Redirect Not Found"
							description={`Redirect ${ctx.params.id} was not found in KV.`}
						/>
					</CMSLayout>,
				);
				return notFound(body);
			}

			let body = await renderToString(
				<CMSLayout title={`Update Redirect ${from}`} activePath="/cms/redirects">
					<CMSRedirectsActionView
						title={`Update Redirect ${from}`}
						description={`Update flow loaded for redirect ${from} -> ${redirect.to}.`}
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
