import { ok } from "@pkg/http/response/html";
import action from "@pkg/remix-helpers/action";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { GlossaryPage } from "~/components/pages";
import { metaPath, metaTitle } from "~/lib/post-meta-view";
import { db } from "~/middleware/db";
import { GlossaryPost } from "~/models/posts/glossary";

export default action<typeof routes.glossary>(async (ctx) => {
	let glossary = await GlossaryPost.findAll(db(ctx));
	let entries = [...glossary]
		.sort((a, b) => {
			return metaTitle(a.meta, "").localeCompare(metaTitle(b.meta, ""), "en");
		})
		.map((entry) => {
			let path = metaPath(entry.meta, "/glossary");
			let slug = (
				entry.meta.slug || path.replace("/glossary/", "").replace("/glossary#", "")
			).replace("/", "");

			return {
				id: entry.post.id,
				slug,
				term: entry.meta.term || metaTitle(entry.meta, "Term"),
				title: entry.meta.title || undefined,
				definition: entry.meta.definition || "",
			};
		});

	let body = await renderToString(<GlossaryPage entries={entries} />);

	return ok(body);
});
