/**
 * Full-page article editor route. Its loader seeds a blank or existing article, its
 * action validates and handles write/update/prettify intents (creating or updating
 * the article and clearing caches), and its component wires a live-preview Markdown
 * editor with controls and quick actions. Exists as the CMS authoring surface for articles.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { useValue } from "@pkg/hooks";
import { badRequest, ok } from "@pkg/response";
import { isFailure } from "@pkg/result";
import { Form } from "@pkg/ui";
import { validate } from "@pkg/validate";
import dark from "prism-theme-github/themes/prism-theme-github-copilot.css?url";
import light from "prism-theme-github/themes/prism-theme-github-light.css?url";
import { useEffect, useMemo, useRef } from "react";
import { redirectDocument, useFetcher } from "react-router";
import { z } from "zod";

import { getDB } from "~/middleware/drizzle";
import { requireUser } from "~/middleware/session";
import { Article } from "~/models/article.server";
import { assertUUID } from "~/utils/uuid";

import type { action as editorAction } from "../components.editor/route";

import { Preview } from "../components.editor/route";
import { Provider, useEditor } from "../components.editor/use-editor";

import type { Route } from "./+types/route";

import { Actions } from "./components/actions";
import { Controls } from "./components/controls";
import { Editor } from "./components/editor";
import { QuickActions } from "./components/quick-actions";
import { clearCache, prettify } from "./queries";

export const links: Route.LinksFunction = () => [
	{ rel: "stylesheet", href: light, media: "(prefers-color-scheme: light)" },
	{ rel: "stylesheet", href: dark, media: "(prefers-color-scheme: dark)" },
];

export async function loader({ params }: Route.LoaderArgs) {
	if (params.postId === "new") {
		return ok({
			mode: "write" as const,
			article: {
				id: null,
				content: "",
				excerpt: "",
				slug: "",
				title: "",
				tags: [],
				publishedAt: null,
				isPublished: false,
			},
		});
	}

	let postId = z.string().uuid().parse(params.postId);
	assertUUID(postId);

	let article = await Article.findById({ db: getDB() }, postId);

	return ok({
		mode: "update" as const,
		article: {
			id: postId,
			content: article.content,
			excerpt: article.excerpt,
			slug: article.slug,
			title: article.title,
			publishedAt: article.publishedAt?.toISOString().split("T")[0] ?? null,
			isPublished: article.isPublished,
		},
	});
}

export async function action({ request, params }: Route.ActionArgs) {
	let formData = await request.formData();

	let result = await validate(
		formData,
		z.object({
			content: z.string(),
			title: z.string().max(140),
			slug: z.string(),
			excerpt: z
				.string()
				.nullish()
				.default("")
				.transform((v) => v ?? ""),
			publishedAt: z
				.string()
				.optional()
				.transform((val) => (val ? new Date(`${val}T17:00:00Z`) : null)),
		}),
	);

	if (isFailure(result)) return badRequest({ error: result.error.issues });

	let body = result.data;

	let db = getDB();

	let intent = z.enum(["write", "update", "prettify"]).parse(formData.get("intent"));

	if (intent === "prettify") {
		try {
			let content = await prettify(body.content);
			return ok({ intent, content });
		} catch {
			return ok({ intent, content: body.content });
		}
	}

	let { id: authorId } = requireUser();
	assertUUID(authorId);

	if (intent === "write") {
		await Article.create({ db }, { ...body, authorId, locale: "en" });
		await clearCache();
	}

	if (intent === "update") {
		let postId = z.uuid().parse(params.postId);
		assertUUID(postId);

		await Article.update({ db }, postId, { ...body, authorId, locale: "en" });
	}

	return redirectDocument(`/articles/${body.slug}`);
}

export default function Component({ loaderData }: Route.ComponentProps) {
	let [title] = useValue(
		loaderData.article.id
			? Symbol.for(`article:${loaderData.article.id}:title`)
			: Symbol.for("article:new:title"),
		loaderData.article.title,
	);

	let { submit, data } = useFetcher<typeof editorAction>();
	let $textarea = useRef<HTMLTextAreaElement>(null);

	let [state, dispatch] = useEditor($textarea.current, loaderData.article.content);

	let stateValue = state.value;

	let providerValue = useMemo(() => {
		return { element: $textarea, state, dispatch };
	}, [dispatch, state]);

	useEffect(() => {
		let content = stateValue;
		if (title.trim() !== "") content = `# ${title}\n${stateValue}`;
		submit({ content }, { action: "/components/editor", method: "post" });
	}, [submit, title, stateValue]);

	return (
		<Provider value={providerValue}>
			<Form method="post" className="h-screen p-4">
				<Actions mode={loaderData.mode} />

				<div className="flex h-full w-full grow flex-row gap-4 overflow-hidden">
					<Controls article={loaderData.article} />

					<Editor
						value={stateValue}
						onChange={(value) => dispatch({ type: "write", payload: { value } })}
					/>

					<div className="h-full max-w-prose grow overflow-auto">
						<Preview rendereable={data?.content} />
					</div>

					<QuickActions dispatch={dispatch} />
				</div>
			</Form>
		</Provider>
	);
}
