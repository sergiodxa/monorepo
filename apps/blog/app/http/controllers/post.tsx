/**
 * HTTP action for public article and tutorial post pages. Route params are validated
 * before any lookup, the response format (HTML, Markdown or ActivityStreams) is negotiated
 * from the URL extension and the `Accept` header, unpublished posts stay admin-only behind
 * a 403, and deleted posts answer 410. HTML pages advertise the Webmention endpoint.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Federation } from "@sdxc/activitypub";
import type { Database } from "remix/data-table";

import { wantsActivity } from "@sdxc/activitypub";
import * as ct from "@sdxc/http/content-type";
import { accepts } from "@sdxc/http/negotiate";
import { advertise } from "@sdxc/webmention/discover";
import { enum_, optional, parse } from "remix/data-schema";
import { createAction } from "remix/router";

import { isAdmin } from "~/app/http/middleware/auth";
import { NotFoundViewModel } from "~/app/http/view-models/not-found";
import { PostViewModel } from "~/app/http/view-models/post";
import { Post } from "~/app/repositories/post";
import { Webmention } from "~/app/repositories/webmention";
import { NEGOTIATED_ACTIVITY, PUBLIC_PAGE, TAGS } from "~/app/services/cache";
import { article, tombstone } from "~/app/services/federated-posts";
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
	async (ctx) => {
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

		if (validation.params.contentType === undefined && wantsActivity(ctx.request)) {
			return await activityFor(ctx, validation.params);
		}

		let prefersMarkdown =
			accepts(ctx.request).preferred(ct.HTML, ct.Markdown) === ct.Markdown ||
			validation.params.contentType === "md";

		let post = await Post.findByTypeAndSlug(ctx.db, {
			postType: validation.params.postType,
			postSlug: validation.params.postSlug,
		});

		if (!post && (await Post.isTombstoned(ctx.db, validation.params))) {
			if (prefersMarkdown) {
				return markdown(410, "# Gone\n\nThis post was deleted.\n\n");
			}

			return renderGonePage(ctx.render, {
				title: "Post Deleted",
				description: "This post was deleted and is no longer available.",
				emoji: "🪦",
			});
		}

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

		let isPublished = Post.isPublishedAt(post.post.published_at);

		if (!isPublished && !isAdmin()) {
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

		let mentions = await Webmention.findApprovedForPost(ctx.db, post.post.id);
		let viewModel = PostViewModel.page(
			post,
			ctx.request.url,
			validation.params.contentType,
			mentions,
		);

		// Only a published post is edge-cacheable. An admin previewing a draft reaches
		// here too, and the middleware would refuse their session anyway, but the draft
		// stays out of a shared cache on its own terms rather than on that check's.
		// Markdown negotiated from `Accept` on the extensionless URL stays out too: the
		// edge keys an entry by URL, so storing it would serve Markdown to browsers.
		let negotiatedMarkdown = prefersMarkdown && validation.params.contentType !== "md";
		if (isPublished && !negotiatedMarkdown) {
			ctx.cache(PUBLIC_PAGE, TAGS.post(validation.params.postType, validation.params.postSlug));
		}

		if (prefersMarkdown) {
			return markdown(200, viewModel.markdownBody);
		}

		let endpoint = advertise(new URL(routeMap.webmention.href(), ctx.url));
		return ctx.render(PostView, viewModel, {
			headers: { Vary: "Accept", Link: endpoint.header },
		});
	},
);

/**
 * The post as ActivityStreams, for a server that asked for it on the extensionless URL: the
 * `Article` of a published post, the `Tombstone` of a deleted one with `410`, and an empty
 * `404` for anything else, drafts included. Answered before the edge-cache declaration,
 * with a private policy, so only the HTML variant is ever stored under this URL.
 *
 * @param ctx The request context, carrying the database and `ctx.activityPub`.
 * @param params The validated collection and slug.
 */
async function activityFor(
	ctx: { db: Database; request: Request; activityPub: Federation },
	params: ValidPostRequestParams,
): Promise<Response> {
	let options = { cache: NEGOTIATED_ACTIVITY };
	let post = await Post.findByTypeAndSlug(ctx.db, params);
	let document = null;
	if (post && Post.isPublishedAt(post.post.published_at)) document = article(post);

	let deleted = post ? null : await Post.findTombstone(ctx.db, params);
	if (deleted) {
		document = tombstone({
			postType: params.postType,
			slug: params.postSlug,
			deleted_at: deleted.deleted_at,
		});
	}

	let as2 =
		document === null ? null : await ctx.activityPub.respond(ctx.request, document, options);
	return as2 ?? new Response(null, { status: 404, headers: { Vary: "Accept" } });
}

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
		// An extensionless URL picks this body from the `Accept` header, so a shared
		// cache has to key on it or a browser is served the raw Markdown.
		headers: { "Content-Type": `${ct.Markdown}; charset=utf-8`, Vary: "Accept" },
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
 * Reports a deleted post as gone for good, which a Webmention receiver reads as the
 * withdrawal of every mention the post sent.
 * @returns HTML 410 response.
 */
async function renderGonePage(
	render: import("~/app/http/context").BlogRenderer,
	input: NotFoundViewModel.Input,
): Promise<Response> {
	let model = NotFoundViewModel.page(input);
	return render(NotFoundView, model, { status: 410 });
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
