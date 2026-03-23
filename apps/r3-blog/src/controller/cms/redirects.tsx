import { notFound, ok } from "@pkg/http/response/html";
import controller from "@pkg/remix-helpers/controller";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { CMSLayout } from "~/components/layout/cms";
import { db } from "~/middleware/db";
import { PostMeta } from "~/models/post-meta";
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
		async index(ctx) {
			let rows = await PostMeta.findAll(db(ctx));
			let redirects = rows.filter((row) => row.key.toLowerCase().includes("redirect"));
			let items: Array<CMSRedirectsController.RedirectItem> = redirects.map((row) => ({
				label: `${row.key}: ${row.value}`,
				href: `/cms/redirects/${row.id}`,
			}));

			let body = await renderToString(
				<CMSLayout title="Redirects" activePath="/cms/redirects">
					<CMSRedirectsIndexView items={items} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async create(ctx) {
			let rows = await PostMeta.findAll(db(ctx));
			let redirects = rows.filter((row) => row.key.toLowerCase().includes("redirect"));
			let body = await renderToString(
				<CMSLayout title="Create Redirect" activePath="/cms/redirects">
					<CMSRedirectsActionView
						title="Create Redirect"
						description={`Create Redirect. There are currently ${redirects.length} redirect-like metadata rows.`}
					/>
				</CMSLayout>,
			);
			return ok(body);
		},

		async destroy(ctx) {
			let redirect = await PostMeta.findById(db(ctx), ctx.params.id);
			if (!redirect || !redirect.key.toLowerCase().includes("redirect")) {
				let body = await renderToString(
					<CMSLayout title="Redirect Not Found" activePath="/cms/redirects">
						<CMSRedirectsActionView
							title="Redirect Not Found"
							description={`Redirect ${ctx.params.id} was not found.`}
						/>
					</CMSLayout>,
				);
				return notFound(body);
			}

			let body = await renderToString(
				<CMSLayout title={`Delete Redirect ${redirect.id}`} activePath="/cms/redirects">
					<CMSRedirectsActionView
						title={`Delete Redirect ${redirect.id}`}
						description={`Ready to delete redirect mapping ${redirect.key} -> ${redirect.value}.`}
					/>
				</CMSLayout>,
			);
			return ok(body);
		},

		async edit(ctx) {
			let redirect = await PostMeta.findById(db(ctx), ctx.params.id);
			if (!redirect || !redirect.key.toLowerCase().includes("redirect")) {
				let body = await renderToString(
					<CMSLayout title="Redirect Not Found" activePath="/cms/redirects">
						<CMSRedirectsActionView
							title="Redirect Not Found"
							description={`Redirect ${ctx.params.id} was not found.`}
						/>
					</CMSLayout>,
				);
				return notFound(body);
			}

			let body = await renderToString(
				<CMSLayout title={`Edit Redirect ${redirect.id}`} activePath="/cms/redirects">
					<CMSRedirectsActionView
						title={`Edit Redirect ${redirect.id}`}
						description={`Editing redirect metadata ${redirect.key} -> ${redirect.value}.`}
					/>
				</CMSLayout>,
			);
			return ok(body);
		},

		async new(ctx) {
			let rows = await PostMeta.findAll(db(ctx));
			let redirects = rows.filter((row) => row.key.toLowerCase().includes("redirect"));
			let body = await renderToString(
				<CMSLayout title="New Redirect" activePath="/cms/redirects">
					<CMSRedirectsActionView
						title="New Redirect"
						description={`New Redirect form loaded. Current redirect-like metadata count: ${redirects.length}.`}
					/>
				</CMSLayout>,
			);
			return ok(body);
		},

		async show(ctx) {
			let redirect = await PostMeta.findById(db(ctx), ctx.params.id);
			if (!redirect || !redirect.key.toLowerCase().includes("redirect")) {
				let body = await renderToString(
					<CMSLayout title="Redirect Not Found" activePath="/cms/redirects">
						<CMSRedirectsActionView
							title="Redirect Not Found"
							description={`Redirect ${ctx.params.id} was not found.`}
						/>
					</CMSLayout>,
				);
				return notFound(body);
			}

			let body = await renderToString(
				<CMSLayout title={`Redirect ${redirect.id}`} activePath="/cms/redirects">
					<CMSRedirectsActionView
						title={`Redirect ${redirect.id}`}
						description={`Redirect metadata ${redirect.key} currently points to ${redirect.value}.`}
					/>
				</CMSLayout>,
			);
			return ok(body);
		},

		async update(ctx) {
			let redirect = await PostMeta.findById(db(ctx), ctx.params.id);
			if (!redirect || !redirect.key.toLowerCase().includes("redirect")) {
				let body = await renderToString(
					<CMSLayout title="Redirect Not Found" activePath="/cms/redirects">
						<CMSRedirectsActionView
							title="Redirect Not Found"
							description={`Redirect ${ctx.params.id} was not found.`}
						/>
					</CMSLayout>,
				);
				return notFound(body);
			}

			let body = await renderToString(
				<CMSLayout title={`Update Redirect ${redirect.id}`} activePath="/cms/redirects">
					<CMSRedirectsActionView
						title={`Update Redirect ${redirect.id}`}
						description={`Update flow loaded for redirect ${redirect.key} -> ${redirect.value}.`}
					/>
				</CMSLayout>,
			);
			return ok(body);
		},
	},
});
