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
