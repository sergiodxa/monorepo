import { MarkdownView } from "@pkg/markdown/client/react";
import { notFound } from "@pkg/response";
import { isFailure } from "@pkg/result";
import { Heading, Text } from "@pkg/ui";
import { useTranslation } from "react-i18next";

import { generateMeta } from "~/lib/seo";
import { i18next, locale } from "~/middleware/i18next";
import { logger } from "~/middleware/logger";
import { getDocLoader, markdown } from "~/modules/docs";

import type { Route } from "./+types/docs.$";

export let meta: Route.MetaFunction = ({ loaderData }) => loaderData?.meta ?? [];

export async function loader({ request, params, context }: Route.LoaderArgs) {
	let log = logger();
	let { t } = i18next(context);
	let slug = params["*"];

	if (!slug) {
		log.info("docs.load.missing_slug");
		throw notFound({ slug });
	}

	let currentLocale = locale();

	let docLoader = getDocLoader(slug, currentLocale);
	if (!docLoader) {
		log.info("docs.load.not_found", { slug, locale: currentLocale });
		throw notFound({ slug });
	}

	let content = await docLoader.loader();
	let result = markdown.parse(content);

	if (isFailure(result)) {
		log.error("docs.load.parse_error", {
			slug,
			error: result.error.message,
			issues: result.error.issues,
		});
		throw notFound({ slug, parseError: true });
	}

	let { content: parsedContent, frontmatter } = result.data;

	log.info("docs.load.success", { slug, title: frontmatter.title });

	return {
		content: parsedContent,
		frontmatter,
		meta: generateMeta({
			title: `${frontmatter.title} - ${t("docs.meta.title")}`,
			description: frontmatter.description,
			url: request.url,
		}),
	};
}

export default function Component({ loaderData }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "docs" });
	let { content, frontmatter } = loaderData;

	return (
		<div className="flex flex-col">
			<header className="flex flex-col gap-0.5">
				<Heading level={1} className="text-3xl font-bold tracking-tight">
					{frontmatter.title}
				</Heading>

				<Text className="mt-1.5 text-lg text-neutral-500 dark:text-neutral-400">
					{frontmatter.description}
				</Text>

				{frontmatter.lastUpdated && (
					<Text className="text-sm text-neutral-500 dark:text-neutral-400">
						{t("lastUpdated", { date: frontmatter.lastUpdated })}
					</Text>
				)}
			</header>

			<MarkdownView content={content} />
		</div>
	);
}

export function ErrorBoundary(_props: Route.ErrorBoundaryProps) {
	let { t } = useTranslation("translation", { keyPrefix: "docs.error" });

	return (
		<div className="flex flex-col gap-4">
			<Heading level={1}>{t("notFoundTitle")}</Heading>
			<Text className="text-neutral-500 dark:text-neutral-400">{t("notFoundDescription")}</Text>
		</div>
	);
}
