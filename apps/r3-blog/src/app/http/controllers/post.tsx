import action from "@pkg/remix-helpers/action";

import type routes from "~/routes";

import { db } from "~/app/http/middleware/db";
import { loadPostByType } from "~/app/http/support/post/load";
import { resolveResponseFormat, validatePostRequestParams } from "~/app/http/support/post/request";
import {
	renderMarkdown,
	renderNotFoundPage,
	renderPostPage,
	renderUnsupportedPostType,
} from "~/app/http/support/post/response";
import { createPostPageViewModel } from "~/app/http/support/post/view-model";

export default action<typeof routes.post>(async (ctx) => {
	let validation = validatePostRequestParams({
		postType: ctx.params.postType,
		postSlug: ctx.params.postSlug,
		ext: ctx.params.ext,
	});

	if (validation.kind === "invalid-route") {
		return renderNotFoundPage({
			title: "Invalid Post URL",
			description: "The requested post URL is invalid.",
			emoji: "\ud83e\udded",
		});
	}

	if (validation.kind === "unsupported-content-type") {
		return renderNotFoundPage({
			title: "Unsupported Content Type",
			description: `The content type "${validation.contentType}" is not supported.`,
			emoji: "\ud83d\udeab",
		});
	}

	if (validation.kind === "unsupported-post-type") {
		return renderUnsupportedPostType();
	}

	let format = resolveResponseFormat(ctx.request, validation.params.contentType);
	let database = db();
	let loadedPost = await loadPostByType(
		database,
		validation.params.postType,
		validation.params.postSlug,
	);

	if (!loadedPost && validation.params.postType === "articles") {
		if (format === "md") {
			return renderMarkdown(
				404,
				"# Article Not Found\n\nThis article does not exist or is no longer available.\n\n",
			);
		}

		return renderNotFoundPage({
			title: "Article Not Found",
			description: "This article does not exist or is no longer available.",
			emoji: "\ud83d\udcdd",
		});
	}

	if (!loadedPost && validation.params.postType === "tutorials") {
		if (format === "md") {
			return renderMarkdown(
				404,
				"# Tutorial Not Found\n\nThis tutorial does not exist or is no longer available.\n\n",
			);
		}

		return renderNotFoundPage({
			title: "Tutorial Not Found",
			description: "This tutorial does not exist or is no longer available.",
			emoji: "\ud83d\udee0\ufe0f",
		});
	}

	if (!loadedPost) {
		if (format === "md") {
			return renderMarkdown(
				404,
				"# Page Not Found\n\nThe content you requested could not be found.\n\n",
			);
		}

		return renderNotFoundPage({
			title: "Page Not Found",
			description: "The content you requested could not be found.",
			emoji: "\ud83d\udd0e",
		});
	}

	let viewModel = createPostPageViewModel(loadedPost, ctx.request.url, ctx.params.ext);

	if (format === "md") {
		return renderMarkdown(200, viewModel.markdownBody);
	}

	return renderPostPage(viewModel);
});
