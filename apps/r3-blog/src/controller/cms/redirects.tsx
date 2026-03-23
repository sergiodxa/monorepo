import { notFound, ok } from "@pkg/http/response/html";
import controller from "@pkg/remix-helpers/controller";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { CMSActionPage, CMSResourcePage } from "~/components/cms-pages";
import { db } from "~/middleware/db";
import { PostMeta } from "~/models/post-meta";

function render(title: string, activePath: string, description: string) {
	return renderToString(
		<CMSActionPage title={title} activePath={activePath} description={description} />,
	);
}

export default controller<typeof routes.cms.redirects>({
	middleware: [],

	actions: {
		async index(ctx) {
			let rows = await PostMeta.findAll(db(ctx));
			let redirects = rows.filter((row) => row.key.toLowerCase().includes("redirect"));
			let items = redirects.map((row) => ({
				label: `${row.key}: ${row.value}`,
				href: `/cms/redirects/${row.id}`,
			}));

			let body = await renderToString(
				<CMSResourcePage
					title="Redirects"
					activePath="/cms/redirects"
					searchLabel="What're you looking for?"
					searchCta="Search"
					primaryCta={{ href: "/cms/redirects/new", label: "New Redirect" }}
					items={items}
					emptyLabel="No redirect metadata entries found in the database yet."
				/>,
			);
			return ok(body);
		},

		async create(ctx) {
			let rows = await PostMeta.findAll(db(ctx));
			let redirects = rows.filter((row) => row.key.toLowerCase().includes("redirect"));
			let body = await render(
				"Create Redirect",
				"/cms/redirects",
				`Create Redirect. There are currently ${redirects.length} redirect-like metadata rows.`,
			);
			return ok(body);
		},

		async destroy(ctx) {
			let redirect = await PostMeta.findById(db(ctx), ctx.params.id);
			if (!redirect || !redirect.key.toLowerCase().includes("redirect")) {
				let body = await render(
					"Redirect Not Found",
					"/cms/redirects",
					`Redirect ${ctx.params.id} was not found.`,
				);
				return notFound(body);
			}

			let body = await render(
				`Delete Redirect ${redirect.id}`,
				"/cms/redirects",
				`Ready to delete redirect mapping ${redirect.key} -> ${redirect.value}.`,
			);
			return ok(body);
		},

		async edit(ctx) {
			let redirect = await PostMeta.findById(db(ctx), ctx.params.id);
			if (!redirect || !redirect.key.toLowerCase().includes("redirect")) {
				let body = await render(
					"Redirect Not Found",
					"/cms/redirects",
					`Redirect ${ctx.params.id} was not found.`,
				);
				return notFound(body);
			}

			let body = await render(
				`Edit Redirect ${redirect.id}`,
				"/cms/redirects",
				`Editing redirect metadata ${redirect.key} -> ${redirect.value}.`,
			);
			return ok(body);
		},

		async new(ctx) {
			let rows = await PostMeta.findAll(db(ctx));
			let redirects = rows.filter((row) => row.key.toLowerCase().includes("redirect"));
			let body = await render(
				"New Redirect",
				"/cms/redirects",
				`New Redirect form loaded. Current redirect-like metadata count: ${redirects.length}.`,
			);
			return ok(body);
		},

		async show(ctx) {
			let redirect = await PostMeta.findById(db(ctx), ctx.params.id);
			if (!redirect || !redirect.key.toLowerCase().includes("redirect")) {
				let body = await render(
					"Redirect Not Found",
					"/cms/redirects",
					`Redirect ${ctx.params.id} was not found.`,
				);
				return notFound(body);
			}

			let body = await render(
				`Redirect ${redirect.id}`,
				"/cms/redirects",
				`Redirect metadata ${redirect.key} currently points to ${redirect.value}.`,
			);
			return ok(body);
		},

		async update(ctx) {
			let redirect = await PostMeta.findById(db(ctx), ctx.params.id);
			if (!redirect || !redirect.key.toLowerCase().includes("redirect")) {
				let body = await render(
					"Redirect Not Found",
					"/cms/redirects",
					`Redirect ${ctx.params.id} was not found.`,
				);
				return notFound(body);
			}

			let body = await render(
				`Update Redirect ${redirect.id}`,
				"/cms/redirects",
				`Update flow loaded for redirect ${redirect.key} -> ${redirect.value}.`,
			);
			return ok(body);
		},
	},
});
