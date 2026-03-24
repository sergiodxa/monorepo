import { redirect } from "@pkg/http/response";
import { notFound, ok } from "@pkg/http/response/html";
import controller from "@pkg/remix-helpers/controller";
import { env } from "cloudflare:workers";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { CMSLayout } from "~/components/layout/cms";
import { Redirect } from "~/models/redirect";
import { CMSRedirectsActionView, CMSRedirectsIndexView } from "~/views/cms/redirects";

export default controller<typeof routes.cms.redirects>({
	middleware: [],

	actions: {
		async index(_ctx) {
			let redirects = await Redirect.findAll(env.REDIRECTS);
			let items: Array<CMSRedirectsIndexView.Item> = redirects.map((item) => {
				let showHref = `/cms/redirects/${encodeURIComponent(item.from)}`;
				return {
					from: item.from,
					to: item.to,
					status: item.status,
					href: showHref,
					showHref,
					deleteAction: showHref,
					publicHref: item.from,
				};
			});

			let body = await renderToString(
				<CMSLayout title="Redirects" activePath="/cms/redirects">
					<CMSRedirectsIndexView items={items} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async create(_ctx) {
			let formData = await _ctx.request.formData();
			let from = Redirect.normalizePath(readString(formData, "from"));
			let to = readString(formData, "to");
			let status = parseStatus(readString(formData, "status"));

			if (!from || !to) {
				return redirect("/cms/redirects/new", { status: redirect.Status.SeeOther });
			}

			await Redirect.upsert(env.REDIRECTS, { from, to, status });

			return redirect(`/cms/redirects/${encodeURIComponent(from)}`, {
				status: redirect.Status.SeeOther,
			});
		},

		async destroy(ctx) {
			let from = getRedirectFromParam(ctx.params.id);
			if (!from) return redirect("/cms/redirects", { status: redirect.Status.SeeOther });

			await Redirect.destroy(env.REDIRECTS, from);
			return redirect("/cms/redirects", { status: redirect.Status.SeeOther });
		},

		async edit(ctx) {
			let from = getRedirectFromParam(ctx.params.id);
			if (!from) return redirect("/cms/redirects", { status: redirect.Status.SeeOther });
			return redirect(`/cms/redirects/${encodeURIComponent(from)}`, {
				status: redirect.Status.SeeOther,
			});
		},

		async new(_ctx) {
			let redirects = await Redirect.findAll(env.REDIRECTS);
			let viewProps: CMSRedirectsActionView.Props = {
				title: "New Redirect",
				description: `New Redirect form loaded. Current redirect count in KV: ${redirects.length}.`,
				mode: "new",
				action: "/cms/redirects",
				submitLabel: "Create Redirect",
				values: {
					from: "",
					to: "",
					status: "302",
				},
			};
			let body = await renderToString(
				<CMSLayout title={viewProps.title} activePath="/cms/redirects">
					<CMSRedirectsActionView {...viewProps} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async show(ctx) {
			let from = getRedirectFromParam(ctx.params.id);
			let redirect = from ? await Redirect.findByPath(env.REDIRECTS, from) : null;
			if (!from || !redirect) {
				let viewProps: CMSRedirectsActionView.Props = {
					title: "Redirect Not Found",
					description: `Redirect ${ctx.params.id} was not found in KV.`,
					mode: "new",
					action: "/cms/redirects",
					submitLabel: "Create Redirect",
					values: {
						from: "",
						to: "",
						status: "302",
					},
				};
				let body = await renderToString(
					<CMSLayout title="Redirect Not Found" activePath="/cms/redirects">
						<CMSRedirectsActionView {...viewProps} />
					</CMSLayout>,
				);
				return notFound(body);
			}

			let viewProps: CMSRedirectsActionView.Props = {
				title: `Redirect ${from}`,
				description: `Redirect ${from} currently points to ${redirect.to} with status ${String(redirect.status)}.`,
				mode: "show",
				action: `/cms/redirects/${encodeURIComponent(from)}`,
				submitLabel: "Create Redirect",
				deleteAction: `/cms/redirects/${encodeURIComponent(from)}`,
				values: {
					from,
					to: redirect.to,
					status: String(redirect.status),
				},
			};

			let body = await renderToString(
				<CMSLayout title={viewProps.title} activePath="/cms/redirects">
					<CMSRedirectsActionView {...viewProps} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async update(_ctx) {
			return redirect("/cms/redirects", { status: redirect.Status.SeeOther });
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
