import * as ct from "@pkg/http/content-type";
import { notFound, ok } from "@pkg/http/response/html";
import { renderToString } from "remix/component/server";

import { BlogLayout } from "~/components/layout/blog";
import prismStyles from "~/styles/prism.css?url";
import { NotFoundView } from "~/views/not-found";
import { PostView } from "~/views/post";

import type { PostPageViewModel } from "./view-model";

export interface NotFoundPageInput {
	title: string;
	description: string;
	emoji: string;
}

export async function renderNotFoundPage(input: NotFoundPageInput): Promise<Response> {
	let body = await renderToString(
		<BlogLayout title={input.title} description={input.description}>
			<NotFoundView title={input.title} description={input.description} emoji={input.emoji} />
		</BlogLayout>,
	);

	return notFound(body);
}

export function renderMarkdown(status: number, body: string): Response {
	return new Response(body, {
		status,
		headers: { "Content-Type": ct.Markdown },
	});
}

export function renderUnsupportedPostType(): Response {
	return notFound("<h1>404 Not Found</h1>");
}

export async function renderPostPage(viewModel: PostPageViewModel): Promise<Response> {
	let body = await renderToString(
		<BlogLayout
			title={viewModel.title}
			description={viewModel.description}
			activePath={viewModel.activePath}
			stylesheets={[{ href: prismStyles }]}
			canonical={viewModel.canonical}
			meta={viewModel.meta}
		>
			<PostView
				title={viewModel.post.title}
				content={viewModel.post.content}
				slug={viewModel.post.slug}
				typePath={viewModel.post.typePath}
				eyebrow={viewModel.post.eyebrow}
				publishedAt={viewModel.post.publishedAt}
				format={viewModel.post.format}
				tags={viewModel.post.tags}
				related={viewModel.post.related}
			/>
		</BlogLayout>,
	);

	return ok(body);
}
