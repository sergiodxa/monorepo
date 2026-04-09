import * as ct from "@pkg/http/content-type";
import { accepts } from "@pkg/http/negotiate";
import action from "@pkg/remix-helpers/action";
import { enum_, optional, parse } from "remix/data-schema";
import { Database } from "remix/data-table";

import type routeMap from "~/routes/web";

import { isAdmin } from "~/app/http/middleware/auth";
import { NotFoundViewModel } from "~/app/http/view-models/not-found";
import { PostViewModel } from "~/app/http/view-models/post";
import { view } from "~/app/infrastructure/view";
import { Post } from "~/app/repositories/post";
import { NotFoundView } from "~/resources/views/not-found";
import { PostView } from "~/resources/views/post";

/**
 * Canonical public post type segments accepted by this controller.
 */
type PostType = Post.PublicTypePath;

/**
 * Normalized route params used after runtime validation succeeds.
 */
interface ValidPostRequestParams {
	postType: PostType;
	postSlug: string;
	contentType: "html" | "md" | undefined;
}

/**
 * Validation outcome for incoming post route params.
 */
type ValidatePostRequestParamsResult =
	| { kind: "valid"; params: ValidPostRequestParams }
	| { kind: "invalid-route" }
	| { kind: "unsupported-content-type"; contentType: string }
	| { kind: "unsupported-post-type" };

/**
 * Public post collections that can be resolved from URL segments.
 */
let SUPPORTED_POST_TYPES = new Set<string>(["articles", "tutorials"]);
/**
 * Optional route extensions this controller can render explicitly.
 */
let SUPPORTED_CONTENT_TYPES = new Set<string>(["html", "md"]);

/**
 * Handles public post requests for articles and tutorials.
 *
 * The handler validates route params first, negotiates response format from
 * URL extension and request headers, then returns markdown or HTML views.
 */
export default action<typeof routeMap.post>(
	/**
	 * Serves one post resource in HTML or Markdown.
	 * @param ctx Route action context with params, request, and model access.
	 * @returns A success response for an existing post, otherwise a typed 404 response.
	 * @example URL `/articles/hello-world.md` returns raw markdown when the post exists.
	 * @example Header `Accept: text/markdown` can negotiate markdown when no extension is provided.
	 */
	async (ctx) => {
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

		let prefersMarkdown =
			accepts(ctx.request).preferred(ct.HTML, ct.Markdown) === ct.Markdown ||
			validation.params.contentType === "md";

		let post = await Post.findByTypeAndSlug(ctx.get(Database), {
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

		if (!Post.isPublishedAt(post.post.published_at) && !isAdmin()) {
			if (prefersMarkdown) {
				if (validation.params.postType === "articles") {
					return markdown(403, "# Forbidden\n\nThis article is not published yet.\n\n");
				}

				return markdown(403, "# Forbidden\n\nThis tutorial is not published yet.\n\n");
			}

			if (validation.params.postType === "articles") {
				return renderForbiddenPage({
					title: "Article Not Published",
					description: "This article is not available yet.",
					emoji: "🔒",
				});
			}

			return renderForbiddenPage({
				title: "Tutorial Not Published",
				description: "This tutorial is not available yet.",
				emoji: "🔒",
			});
		}

		let viewModel = PostViewModel.page(post, ctx.request.url, validation.params.contentType);

		if (prefersMarkdown) {
			return markdown(200, viewModel.markdownBody);
		}

		return view(PostView, viewModel);
	},
);

/**
 * Validates route params and converts them into a safe controller contract.
 *
 * This function is the guardrail that enforces supported post collections and
 * optional extension values before the database lookup runs.
 * @param params Raw route params from the matched URL.
 * @returns A discriminated result describing either normalized params or a rejection reason.
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
 * Creates a plain Markdown `Response` with a fixed markdown content type.
 *
 * This bypasses HTML view rendering for explicit markdown responses and
 * keeps response construction consistent for both success and 404 bodies.
 * @param status HTTP status for the response.
 * @param body Markdown response body text.
 * @returns Markdown response with the Markdown content type header.
 */
function markdown(status: number, body: string): Response {
	return new Response(body, {
		status,
		headers: { "Content-Type": `${ct.Markdown}; charset=utf-8` },
	});
}

/**
 * Renders the canonical HTML not-found page for this controller.
 *
 * The input is mapped through `NotFoundViewModel` so callers can provide a
 * small semantic payload while preserving shared not-found page behavior.
 * @param input View model input used to build the not-found UI.
 * @returns HTML 404 response for missing or unsupported content.
 */
async function renderNotFoundPage(input: NotFoundViewModel.Input): Promise<Response> {
	let model = NotFoundViewModel.page(input);
	return view(NotFoundView, model, { status: 404 });
}

/**
 * Renders the shared error page with HTTP 403 status for preview-only posts.
 *
 * This keeps the public post route explicit about access denial instead of
 * pretending the resource does not exist.
 * @param input View model input used to build the forbidden UI.
 * @returns HTML 403 response for unpublished content.
 */
async function renderForbiddenPage(input: NotFoundViewModel.Input): Promise<Response> {
	let model = NotFoundViewModel.page(input);
	return view(NotFoundView, model, { status: 403 });
}
