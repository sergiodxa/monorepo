/**
 * Route that serves the raw Markdown source of a post. Its loader validates the
 * post type ("articles" or "tutorials") and slug, then returns the corresponding
 * content with a Markdown media type via queryArticle/queryTutorial. Exists to
 * expose LLM- and tooling-friendly plain-text versions of published posts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { markdown } from "@pkg/http/response";
import { notFound } from "@pkg/response";
import { z } from "zod";

import type { Route } from "./+types/route";

import { queryArticle, queryTutorial } from "./queries";

export async function loader({ params }: Route.LoaderArgs) {
	let result = z
		.object({ postType: z.enum(["articles", "tutorials"]), slug: z.string() })
		.safeParse({ postType: params.postType, slug: params["*"] });

	if (!result.success) throw notFound(result.error);

	let { postType, slug } = result.data;

	if (postType === "articles") {
		return markdown(await queryArticle(slug));
	}

	if (postType === "tutorials") {
		return markdown(await queryTutorial(slug));
	}

	throw new Error("Invalid post type");
}
