import { ok } from "@pkg/http/response/html";
import action from "@pkg/remix-helpers/action";
import { renderToString } from "remix/component/server";

import type routes from "~/routes";

import { BlogLayout } from "~/components/layout/blog";
import { db } from "~/middleware/db";
import { GlossaryPost } from "~/models/posts/glossary";
import { GlossaryView } from "~/views/glossary";

export default action<typeof routes.glossary>(async (ctx) => {
	let glossary = await GlossaryPost.findAll(db(ctx));
	let entries = [...glossary]
		.sort((a, b) => a.meta.term.localeCompare(b.meta.term))
		.map((entry) => {
			return {
				id: entry.post.id,
				slug: entry.meta.slug,
				term: entry.meta.term,
				title: entry.meta.title,
				definition: entry.meta.definition,
			};
		});

	let body = await renderToString(
		<BlogLayout title="Glossary" description="My definition of some terms." activePath="/glossary">
			<GlossaryView entries={entries} />
		</BlogLayout>,
	);

	return ok(body);
});
