import { redirect } from "@pkg/http/response";
import { notFound, ok } from "@pkg/http/response/html";
import controller from "@pkg/remix-helpers/controller";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { CMSLayout } from "~/components/layout/cms";
import { authState } from "~/middleware/auth-state";
import { db } from "~/middleware/db";
import { GlossaryPost } from "~/models/posts/glossary";
import { CMSGlossaryActionView, CMSGlossaryIndexView } from "~/views/cms/glossary";

export default controller<typeof routes.cms.glossary>({
	middleware: [],

	actions: {
		async index(ctx) {
			let glossary = await GlossaryPost.findAll(db(ctx));
			let items = glossary.map((item) => ({
				id: item.post.id,
				term: item.meta.term,
				slug: item.meta.slug,
				date: formatListDate(item.post.created_at),
				href: `/cms/glossary/${item.post.id}/edit`,
				editHref: `/cms/glossary/${item.post.id}/edit`,
				showHref: `/cms/glossary/${item.post.id}`,
				deleteAction: `/cms/glossary/${item.post.id}`,
				publicHref: `/glossary#${item.meta.slug}`,
			}));

			let body = await renderToString(
				<CMSLayout title="Glossary" activePath="/cms/glossary">
					<CMSGlossaryIndexView items={items} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async create(ctx) {
			let user = authState().user;
			if (!user) return redirect("/login", { status: redirect.Status.SeeOther });

			let formData = await ctx.request.formData();
			let created = await GlossaryPost.create(db(ctx), {
				author_id: user.id,
				meta: {
					term: readString(formData, "term") || "Untitled term",
					title: readString(formData, "title") || undefined,
					slug: readString(formData, "slug") || crypto.randomUUID(),
					definition: readString(formData, "definition") || "",
				},
			});

			if (!created) return redirect("/cms/glossary", { status: redirect.Status.SeeOther });

			return redirect(`/cms/glossary/${created.post.id}/edit`, {
				status: redirect.Status.SeeOther,
			});
		},

		async destroy(ctx) {
			let glossaryId = ctx.params.id;
			if (!glossaryId) return redirect("/cms/glossary", { status: redirect.Status.SeeOther });

			await GlossaryPost.destroy(db(ctx), glossaryId);
			return redirect("/cms/glossary", { status: redirect.Status.SeeOther });
		},

		async edit(ctx) {
			let glossary = await GlossaryPost.findById(db(ctx), ctx.params.id);
			if (!glossary) {
				let viewProps = {
					title: "Glossary Term Not Found",
					description: `Glossary term ${ctx.params.id} was not found.`,
					mode: "new" as const,
					action: "/cms/glossary",
					submitLabel: "Create Glossary Term",
					values: {
						term: "",
						title: "",
						slug: "",
						definition: "",
					},
				};
				let body = await renderToString(
					<CMSLayout title="Glossary Term Not Found" activePath="/cms/glossary">
						<CMSGlossaryActionView {...(viewProps as CMSGlossaryActionView.Props)} />
					</CMSLayout>,
				);
				return notFound(body);
			}

			let viewProps = {
				title: `Edit Glossary ${glossary.meta.term}`,
				description: `Editing glossary term at /glossary#${glossary.meta.slug}.`,
				mode: "edit" as const,
				action: `/cms/glossary/${glossary.post.id}`,
				submitLabel: "Save Glossary Term",
				deleteAction: `/cms/glossary/${glossary.post.id}`,
				values: {
					term: glossary.meta.term ?? "",
					title: glossary.meta.title ?? "",
					slug: glossary.meta.slug ?? "",
					definition: glossary.meta.definition ?? "",
				},
			};

			let body = await renderToString(
				<CMSLayout title={viewProps.title} activePath="/cms/glossary">
					<CMSGlossaryActionView {...(viewProps as CMSGlossaryActionView.Props)} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async new(ctx) {
			let total = (await GlossaryPost.findAll(db(ctx))).length;
			let viewProps = {
				title: "New Glossary",
				description: `New Glossary form loaded. Current glossary count: ${total}.`,
				mode: "new" as const,
				action: "/cms/glossary",
				submitLabel: "Create Glossary Term",
				values: {
					term: "",
					title: "",
					slug: "",
					definition: "",
				},
			};
			let body = await renderToString(
				<CMSLayout title={viewProps.title} activePath="/cms/glossary">
					<CMSGlossaryActionView {...(viewProps as CMSGlossaryActionView.Props)} />
				</CMSLayout>,
			);
			return ok(body);
		},

		async show(ctx) {
			let glossary = await GlossaryPost.findById(db(ctx), ctx.params.id);
			if (!glossary) return notFound("<h1>404 Not Found</h1>");

			return redirect(`/glossary#${glossary.meta.slug}`, { status: redirect.Status.SeeOther });
		},

		async update(ctx) {
			let user = authState().user;
			let glossaryId = ctx.params.id;
			if (!user || !glossaryId) {
				return redirect("/cms/glossary", { status: redirect.Status.SeeOther });
			}

			let formData = await ctx.request.formData();
			let updated = await GlossaryPost.update(db(ctx), glossaryId, {
				author_id: user.id,
				meta: {
					term: readString(formData, "term") || "Untitled term",
					title: readString(formData, "title") || undefined,
					slug: readString(formData, "slug") || glossaryId,
					definition: readString(formData, "definition") || "",
				},
			});

			if (!updated) return notFound("<h1>404 Not Found</h1>");

			return redirect(`/cms/glossary/${glossaryId}/edit`, { status: redirect.Status.SeeOther });
		},
	},
});

function readString(formData: FormData, key: string) {
	let value = formData.get(key);
	if (typeof value !== "string") return "";
	return value.trim();
}

function formatListDate(value: string) {
	let parsed = new Date(value);
	if (Number.isNaN(parsed.getTime())) return "";
	return parsed.toISOString().slice(0, 10);
}
