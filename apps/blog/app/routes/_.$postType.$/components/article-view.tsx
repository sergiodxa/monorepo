import { Badge, Button, Form } from "@pkg/ui";
import { useTranslation } from "react-i18next";

import { MarkdownView } from "~/components/markdown";
import { Support } from "~/components/support";
import { useUser } from "~/hooks/use-user";
import { useHints } from "~/utils/client-hints";
import { formatPublishDate } from "~/utils/format-publish-date";

import type { ArticleLoaderData } from "../route";

export type ArticleData = ArticleLoaderData;

export function ArticleView({ post }: { post: ArticleData }) {
	let { t } = useTranslation("translation", { keyPrefix: "article" });
	let user = useUser();

	if (post.postType !== "articles") return null;

	return (
		<article className="mx-auto mb-8 flex max-w-3xl flex-col gap-8">
			<div className="mx-auto prose w-full max-w-prose space-y-8 prose-blue sm:prose-lg dark:prose-invert">
				<div className="not-prose flex flex-wrap items-center justify-between gap-2">
					{post.isPreview && post.publishedAt && (
						<Badge color="warning">
							<Badge.Text>
								<PublishDateBadge publishedAt={post.publishedAt} />
							</Badge.Text>
						</Badge>
					)}

					{user?.role === "admin" && (
						<Form method="get" action={`/cms/articles/${post.article.id}`}>
							<Button type="submit" color="primary" size="sm">
								{t("header.edit")}
							</Button>
						</Form>
					)}
				</div>

				<MarkdownView content={post.article.body} />
			</div>
			<Support />
		</article>
	);
}

function PublishDateBadge({ publishedAt }: { publishedAt: Date }) {
	let { t, i18n } = useTranslation("translation", { keyPrefix: "article.preview" });
	let hints = useHints();

	let { formatted, isRelative } = formatPublishDate(publishedAt, {
		locale: i18n.language,
		timeZone: hints?.timeZone,
	});

	if (isRelative) {
		return t("badgeRelative", { relativeTime: formatted });
	}

	return t("badge", { date: formatted });
}
