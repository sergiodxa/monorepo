import { notFound, ok } from "@pkg/response";
import { Alert, Link } from "@pkg/ui";
import dark from "prism-theme-github/themes/prism-theme-github-copilot.css?url";
import light from "prism-theme-github/themes/prism-theme-github-light.css?url";
import { useTranslation } from "react-i18next";
import { href, isRouteErrorResponse, redirect } from "react-router";
import { z } from "zod";

import { getBindings } from "~/middleware/bindings";
import { useHints } from "~/utils/client-hints";
import { formatPublishDate } from "~/utils/format-publish-date";

import type { Route } from "./+types/route";

import { ArticleView } from "./components/article-view";
import { TutorialView } from "./components/tutorial-view";
import { queryArticle, queryTutorial } from "./queries";

type LoaderData = Route.ComponentProps["loaderData"];
type SuccessData = Extract<LoaderData, { ok: true }>;
export type ArticleLoaderData = Extract<SuccessData, { postType: "articles" }>;
export type TutorialLoaderData = Extract<SuccessData, { postType: "tutorials" }>;

export const meta: Route.MetaFunction = ({ loaderData }) => {
	if (!loaderData?.ok) return [];
	return loaderData?.meta ?? [];
};

export const links: Route.LinksFunction = () => [
	{ rel: "stylesheet", href: light, media: "(prefers-color-scheme: light)" },
	{ rel: "stylesheet", href: dark, media: "(prefers-color-scheme: dark)" },
];

export const middleware: Route.MiddlewareFunction[] = [
	async function redirectsMiddleware({ params }, next) {
		let kvResult = await getBindings().kv.redirects.get(params["*"], "json");
		let redirectConfig = z.object({ from: z.string(), to: z.string() }).nullish().parse(kvResult);

		if (redirectConfig?.from === `/${params.postType}/${params["*"]}`) {
			throw redirect(redirectConfig.to);
		}

		return await next();
	},
];

export async function loader({ request, params }: Route.LoaderArgs) {
	let result = z
		.object({ postType: z.enum(["articles", "tutorials"]), slug: z.string() })
		.safeParse({ postType: params.postType, slug: params["*"] });

	if (!result.success) throw notFound(result.error);

	let { postType, slug } = result.data;

	try {
		if (postType === "articles") return ok(await queryArticle(request, slug));
		if (postType === "tutorials") return ok(await queryTutorial(request, slug));
	} catch (error) {
		if (error instanceof Error && error.message === "Article not published yet") {
			return notFound({ postType, publishedAt: error instanceof Error ? new Date() : null });
		}

		if (error instanceof Error && error.message === "Tutorial not published yet") {
			return notFound({ postType, publishedAt: error instanceof Error ? new Date() : null });
		}

		throw error;
	}

	throw new Error("Invalid post type");
}

export default function Component({ loaderData }: Route.ComponentProps) {
	if (!loaderData.ok) {
		return <ForbiddenView publishedAt={loaderData.publishedAt} />;
	}

	if (loaderData.postType === "articles") {
		return <ArticleView post={loaderData} />;
	}

	if (loaderData.postType === "tutorials") {
		return <TutorialView post={loaderData} />;
	}

	// @ts-expect-error - postType should be never, but you never know
	throw new Error(`Invalid post type: ${loaderData.postType ?? "Missing"}`);
}

function ForbiddenView({ publishedAt }: { publishedAt: Date | null }) {
	let { t, i18n } = useTranslation("translation", { keyPrefix: "forbidden" });
	let hints = useHints();

	let description: string;
	if (publishedAt) {
		let { formatted, isRelative } = formatPublishDate(publishedAt, {
			locale: i18n.language,
			timeZone: hints?.timeZone,
		});
		description = isRelative
			? t("descriptionRelative", { relativeTime: formatted })
			: t("description", { date: formatted });
	} else {
		description = t("descriptionNoDate");
	}

	return (
		<main className="mx-auto max-w-3xl p-4 pt-16">
			<Alert color="warning">
				<Alert.Content>
					<Alert.Title>{t("title")}</Alert.Title>
					<Alert.Description>{description}</Alert.Description>
				</Alert.Content>
				<Alert.Action>
					<Link href={href("/")}>{t("backHome")}</Link>
				</Alert.Action>
			</Alert>
		</main>
	);
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	let message = "Oops!";
	let details = "An unexpected error occurred.";
	let stack: string | undefined;

	if (isRouteErrorResponse(error)) {
		message = error.status === 404 ? "404" : "Error";
		details =
			error.status === 404 ? "The requested page could not be found." : error.statusText || details;
	} else if (import.meta.env.DEV && error && error instanceof Error) {
		details = error.message;
		stack = error.stack;
	}

	return (
		<main className="container mx-auto p-4 pt-16">
			<h1>{message}</h1>
			<p>{details}</p>
			{stack && (
				<pre className="w-full overflow-x-auto p-4">
					<code>{stack}</code>
				</pre>
			)}
		</main>
	);
}
