/**
 * HTTP action for public article and tutorial post pages. Route params are validated
 * before any lookup, the response format is negotiated from the URL extension and the
 * `Accept` header, and unpublished posts stay admin-only behind a 403.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as ct from "@sdxc/http/content-type";
import { accepts } from "@sdxc/http/negotiate";
import { inject } from "@sdxc/service-container";
import { enum_, optional, parse } from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import { isAdmin } from "~/app/http/middleware/auth";
import { NotFoundViewModel } from "~/app/http/view-models/not-found";
import { PostViewModel } from "~/app/http/view-models/post";
import { Post } from "~/app/repositories/post";
import { NotFoundView } from "~/resources/views/not-found";
import { PostView } from "~/resources/views/post";
import routeMap from "~/routes/web";

type PostType = Post.PublicTypePath;

interface ValidPostRequestParams {
	postType: PostType;
	postSlug: string;
	contentType: "html" | "md" | undefined;
}

type ValidatePostRequestParamsResult =
	| { kind: "valid"; params: ValidPostRequestParams }
	| { kind: "invalid-route" }
	| { kind: "unsupported-content-type"; contentType: string }
	| { kind: "unsupported-post-type" };

let SUPPORTED_POST_TYPES = new Set<string>(["articles", "tutorials"]);
let SUPPORTED_CONTENT_TYPES = new Set<string>(["html", "md"]);

/**
 * Handles public post requests for articles and tutorials, rejecting unknown collections
 * and extensions before the lookup runs.
 */
export default createAction(
	routeMap.post,
	/**
	 * Serves one post resource in HTML or Markdown.
	 * @returns The post response, or a typed 404 when nothing matches.
	 * @example URL `/articles/hello-world.md` returns raw markdown when the post exists.
	 * @example Header `Accept: text/markdown` negotiates markdown for an extensionless URL.
	 */
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let validation = validatePostRequestParams({
			postType: ctx.params.postType,
			postSlug: ctx.params.postSlug,
			ext: ctx.params.ext,
		});

		if (validation.kind === "invalid-route") {
			return renderNotFoundPage(ctx.render, {
				title: "Invalid Post URL",
				description: "The requested post URL is invalid.",
				emoji: "🧭",
			});
		}

		if (validation.kind === "unsupported-content-type") {
			return renderNotFoundPage(ctx.render, {
				title: "Unsupported Content Type",
				description: `The content type "${validation.contentType}" is not supported.`,
				emoji: "🚫",
			});
		}

		if (validation.kind === "unsupported-post-type") {
			return renderNotFoundPage(ctx.render, {
				title: "Page Not Found",
				description: "The content you requested could not be found.",
				emoji: "🔎",
			});
		}

		let prefersMarkdown =
			accepts(ctx.request).preferred(ct.HTML, ct.Markdown) === ct.Markdown ||
			validation.params.contentType === "md";

		let post = await Post.findByTypeAndSlug(db, {
			postType: validation.params.postType,
			postSlug: validation.params.postSlug,
		});

		if (!post) {
			if (prefersMarkdown) {
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
				return renderNotFoundPage(ctx.render, {
					title: "Article Not Found",
					description: "This article does not exist or is no longer available.",
					emoji: "📝",
				});
			}

			return renderNotFoundPage(ctx.render, {
				title: "Tutorial Not Found",
				description: "This tutorial does not exist or is no longer available.",
				emoji: "🛠️",
			});
		}

		if (!Post.isPublishedAt(post.post.published_at) && !isAdmin()) {
			if (prefersMarkdown) {
				if (validation.params.postType === "articles") {
					return markdown(403, "# Forbidden\n\nThis article is not published yet.\n\n");
				}

				return markdown(403, "# Forbidden\n\nThis tutorial is not published yet.\n\n");
			}

			if (validation.params.postType === "articles") {
				return renderForbiddenPage(ctx.render, {
					title: "Article Not Published",
					description: "This article is not available yet.",
					emoji: "🔒",
				});
			}

			return renderForbiddenPage(ctx.render, {
				title: "Tutorial Not Published",
				description: "This tutorial is not available yet.",
				emoji: "🔒",
			});
		}

		let viewModel = PostViewModel.page(post, ctx.request.url, validation.params.contentType);

		if (prefersMarkdown) {
			return markdown(200, viewModel.markdownBody);
		}

		return ctx.render(PostView, viewModel);
	}),
);

/**
 * Enforces supported post collections and extension values before the database lookup
 * runs, so downstream code works with normalized params.
 * @returns A discriminated result with normalized params or a rejection reason.
 */
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
			contentType: parse(optional(enum_(["html", "md"])), contentType),
		},
	};
}

/**
 * Builds a Markdown response with the charset-tagged Markdown content type, keeping
 * success and error bodies identical in shape.
 * @param status HTTP status for the response.
 * @param body Markdown response body text.
 */
function markdown(status: number, body: string): Response {
	return new Response(body, {
		status,
		headers: { "Content-Type": `${ct.Markdown}; charset=utf-8` },
	});
}

/**
 * Maps a small semantic payload through `NotFoundViewModel` so every miss in this
 * controller shares one not-found page.
 * @returns HTML 404 response.
 */
async function renderNotFoundPage(
	render: import("~/app/http/context").BlogRenderer,
	input: NotFoundViewModel.Input,
): Promise<Response> {
	let model = NotFoundViewModel.page(input);
	return render(NotFoundView, model, { status: 404 });
}

/**
 * Reports preview-only posts as denied, marking them as existing but withheld from the
 * public.
 * @returns HTML 403 response.
 */
async function renderForbiddenPage(
	render: import("~/app/http/context").BlogRenderer,
	input: NotFoundViewModel.Input,
): Promise<Response> {
	let model = NotFoundViewModel.page(input);
	return render(NotFoundView, model, { status: 403 });
}
