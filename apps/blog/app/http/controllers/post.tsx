/**
 * HTTP action for public post pages, one per kind with a page. Route params are validated
 * before any lookup, the response format (HTML, Markdown, EPUB or ActivityStreams) is
 * negotiated from the URL extension and the `Accept` header, unpublished posts stay
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Federation } from "@sdxc/activitypub";

import { wantsActivity } from "@sdxc/activitypub";
import * as ct from "@sdxc/http/content-type";
import { accepts } from "@sdxc/http/negotiate";
import { isFailure } from "@sdxc/result";
import { advertise } from "@sdxc/webmention/discover";
import { enum_, optional, parse } from "remix/data-schema";
import { createAction } from "remix/router";

import type { BlogModels } from "~/app/models";
import type { PublicTypePath } from "~/app/models/kinds";

import { NotFoundViewModel } from "~/app/http/view-models/not-found";
import { PostViewModel } from "~/app/http/view-models/post";
import { TopicViewModel } from "~/app/http/view-models/topic";
import { NEGOTIATED_ACTIVITY, PUBLIC_PAGE, TAGS } from "~/app/initializers/cache";
import { isPublicTypePath, kindAt, POST_KINDS } from "~/app/models/kinds";
import { isPublishedAt } from "~/app/models/post-values";
import abilities from "~/app/policies/abilities";
import { article, tombstone } from "~/app/services/federated-posts";
import { postEpub } from "~/app/services/post-epub";
import { findPublicPost, findTombstone, isTombstoned } from "~/app/services/posts";
import { NotFoundView } from "~/resources/views/not-found";
import { PostView } from "~/resources/views/post";
import routeMap from "~/routes/web";

type PostType = PublicTypePath;

interface ValidPostRequestParams {
	postType: PostType;
	postSlug: string;
	contentType: "html" | "md" | "epub" | undefined;
}

type ValidatePostRequestParamsResult =
	| { kind: "valid"; params: ValidPostRequestParams }
	| { kind: "invalid-route" }
	| { kind: "unsupported-content-type"; contentType: string }
	| { kind: "unsupported-post-type" };

let SUPPORTED_CONTENT_TYPES = new Set<string>(["html", "md", "epub"]);

/**
 * Handles public post requests for every kind with a page, rejecting unknown collections
 * and extensions before the lookup runs.
 */
export default createAction(
	routeMap.post,
	/**
	 * Serves one post resource in HTML, Markdown or EPUB.
	 * @returns The post response, or a typed 404 when nothing matches.
	 * @example URL `/articles/hello-world.md` returns raw markdown when the post exists.
	 * @example Header `Accept: text/markdown` negotiates markdown for an extensionless URL.
	 * @example URL `/articles/hello-world.epub` downloads the article as an ebook.
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

		let post = await findPublicPost(ctx.models, {
			postType: validation.params.postType,
			postSlug: validation.params.postSlug,
		});

		if (!post && (await isTombstoned(ctx.models, validation.params))) {
			if (prefersMarkdown) {
				return markdown(410, "# Gone\n\nThis post was deleted.\n\n");
			}

			return renderGonePage(ctx.render, {
				title: "Post Deleted",
				description: "This post was deleted and is no longer available.",
				emoji: "🪦",
			});
		}

		let kind = POST_KINDS[kindAt(validation.params.postType)];
		let noun = kind.label.toLowerCase();

		if (!post) {
			if (prefersMarkdown) {
				return markdown(
					404,
					`# ${kind.label} Not Found\n\nThis ${noun} does not exist or is no longer available.\n\n`,
				);
			}

			return renderNotFoundPage(ctx.render, {
				title: `${kind.label} Not Found`,
				description: `This ${noun} does not exist or is no longer available.`,
				emoji: kind.icon,
			});
		}

		let isPublished = isPublishedAt(post.post.published_at);

		if (!ctx.access.can(abilities.posts.read, { post: { published: isPublished } })) {
			if (prefersMarkdown) {
				return markdown(403, `# Forbidden\n\nThis ${noun} is not published yet.\n\n`);
			}

			return renderForbiddenPage(ctx.render, {
				title: `${kind.label} Not Published`,
				description: `This ${noun} is not available yet.`,
				emoji: "🔒",
			});
		}

		if (validation.params.contentType === "epub") {
			let page = PostViewModel.page(post, ctx.request.url, undefined);
			let built = postEpub({
				title: page.post.title,
				excerpt: "excerpt" in post.post.meta ? post.post.meta.excerpt : undefined,
				tags: page.post.tags,
				document: page.post.document,
				url: page.post.url,
				published: page.post.published,
				publishedLabel: page.post.publishedLabel,
				modified: new Date(post.post.updated_at),
			});

			if (isFailure(built)) {
				ctx.log.fail(built.error, { post: { slug: validation.params.postSlug, format: "epub" } });
				return renderNotFoundPage(
					ctx.render,
					{
						title: "EPUB Unavailable",
						description: "This post could not be turned into an ebook. Read it online instead.",
						emoji: "📚",
					},
					500,
				);
			}

			if (isPublished) {
				ctx.cache(PUBLIC_PAGE, TAGS.post(validation.params.postType, validation.params.postSlug));
			}
			return new Response(built.data.stream(), {
				headers: {
					"Content-Type": "application/epub+zip",
					"Content-Disposition": `attachment; filename="${validation.params.postSlug}.epub"`,
				},
			});
		}

		let mentions = await ctx.models.webmentions.findApprovedForPost(post.post.id);
		let viewModel = PostViewModel.page(
			post,
			ctx.request.url,
			validation.params.contentType,
			mentions,
		);
		let tagTopics = await ctx.models.topics.findForTags(viewModel.post.tags);
		viewModel.tagHrefs = TopicViewModel.tagHrefs(viewModel.post.tags, tagTopics);

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
 * `404` for anything else, drafts included.
 *
 * @param ctx The request context, carrying the models and `ctx.activityPub`.
 * @param params The validated collection and slug.
 */
async function activityFor(
	ctx: { models: BlogModels; request: Request; activityPub: Federation },
	params: ValidPostRequestParams,
): Promise<Response> {
	let options = { cache: NEGOTIATED_ACTIVITY };
	let post = await findPublicPost(ctx.models, params);
	let document = null;
	if (post && isPublishedAt(post.post.published_at)) document = article(post);

	let deleted = post ? null : await findTombstone(ctx.models, params);
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
	if (!isPublicTypePath(postType)) return { kind: "unsupported-post-type" };

	return {
		kind: "valid",
		params: {
			postType,
			postSlug,
			contentType: parse(optional(enum_(["html", "md", "epub"])), contentType),
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

		headers: { "Content-Type": `${ct.Markdown}; charset=utf-8`, Vary: "Accept" },
	});
}

/**
 * Maps a small semantic payload through `NotFoundViewModel` so every miss in this
 * controller shares one not-found page; an EPUB that fails to build answers it with 500.
 * @returns HTML 404 response, or the `status` given.
 */
async function renderNotFoundPage(
	render: import("~/app/http/context").BlogRenderer,
	input: NotFoundViewModel.Input,
	status = 404,
): Promise<Response> {
	let model = NotFoundViewModel.page(input);
	return render(NotFoundView, model, { status });
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
