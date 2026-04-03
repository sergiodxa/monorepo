import * as ct from "@pkg/http/content-type";
import action from "@pkg/remix-helpers/action";

import type routeMap from "~/routes/web";

import { db } from "~/app/http/middleware/db";
import { type ContentTypeParam, resolveResponseFormat } from "~/app/http/responses/format";
import { NotFoundViewModel } from "~/app/http/view-models/not-found";
import { PostViewModel } from "~/app/http/view-models/post";
import { view } from "~/app/infrastructure/view";
import { Post } from "~/app/repositories/post";
import { NotFoundView } from "~/resources/views/not-found";
import { PostView } from "~/resources/views/post";

type PostType = Post.PublicTypePath;

interface ValidPostRequestParams {
	postType: PostType;
	postSlug: string;
	contentType: ContentTypeParam | undefined;
}

type ValidatePostRequestParamsResult =
	| { kind: "valid"; params: ValidPostRequestParams }
	| { kind: "invalid-route" }
	| { kind: "unsupported-content-type"; contentType: string }
	| { kind: "unsupported-post-type" };

let SUPPORTED_POST_TYPES = new Set<string>(["articles", "tutorials"]);
let SUPPORTED_CONTENT_TYPES = new Set<string>(["html", "md"]);

export default action<typeof routeMap.post>(async (ctx) => {
	let validation = validatePostRequestParams({
		postType: ctx.params.postType,
		postSlug: ctx.params.postSlug,
		ext: ctx.params.ext,
	});

	if (validation.kind === "invalid-route") {
		return renderNotFoundPage({
			title: "Invalid Post URL",
			description: "The requested post URL is invalid.",
			emoji: "🧭",
		});
	}

	if (validation.kind === "unsupported-content-type") {
		return renderNotFoundPage({
			title: "Unsupported Content Type",
			description: `The content type "${validation.contentType}" is not supported.`,
			emoji: "🚫",
		});
	}

	if (validation.kind === "unsupported-post-type") {
		return renderNotFoundPage({
			title: "Page Not Found",
			description: "The content you requested could not be found.",
			emoji: "🔎",
		});
	}

	let responseFormat = resolveResponseFormat(ctx.request, validation.params.contentType);
	let post = await Post.findByTypeAndSlug(db(), {
		postType: validation.params.postType,
		postSlug: validation.params.postSlug,
	});

	if (!post) {
		if (responseFormat === "md") {
			if (validation.params.postType === "articles") {
				return markdown(
					404,
					"# Article Not Found\n\nThis article does not exist or is no longer available.\n\n",
				);
			}

			return markdown(
				404,
				"# Tutorial Not Found\n\nThis tutorial does not exist or is no longer available.\n\n",
			);
		}

		if (validation.params.postType === "articles") {
			return renderNotFoundPage({
				title: "Article Not Found",
				description: "This article does not exist or is no longer available.",
				emoji: "📝",
			});
		}

		return renderNotFoundPage({
			title: "Tutorial Not Found",
			description: "This tutorial does not exist or is no longer available.",
			emoji: "🛠️",
		});
	}

	let viewModel = PostViewModel.page(post, ctx.request.url, validation.params.contentType);

	if (responseFormat === "md") {
		return markdown(200, viewModel.markdownBody);
	}

	return view(PostView, viewModel);
});

function validatePostRequestParams(params: {
	postType: string | undefined;
	postSlug: string | undefined;
	ext: string | undefined;
}): ValidatePostRequestParamsResult {
	let postType = params.postType;
	let postSlug = params.postSlug;
	let contentType = params.ext;

	if (!postType || !postSlug) return { kind: "invalid-route" };
	if (contentType && !SUPPORTED_CONTENT_TYPES.has(contentType)) {
		return { kind: "unsupported-content-type", contentType };
	}
	if (!SUPPORTED_POST_TYPES.has(postType)) return { kind: "unsupported-post-type" };

	return {
		kind: "valid",
		params: {
			postType: postType as PostType,
			postSlug,
			contentType: contentType as ContentTypeParam | undefined,
		},
	};
}

function markdown(status: number, body: string): Response {
	return new Response(body, { status, headers: { "Content-Type": ct.Markdown } });
}

async function renderNotFoundPage(input: NotFoundViewModel.Input): Promise<Response> {
	let model = NotFoundViewModel.page(input);
	return view(NotFoundView, model, { status: 404 });
}
