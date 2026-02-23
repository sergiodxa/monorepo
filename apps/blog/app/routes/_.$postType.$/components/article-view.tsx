import { Badge } from "@pkg/ui";
import { useTranslation } from "react-i18next";

import { MarkdownView } from "~/components/markdown";
import { Support } from "~/components/support";
import { useHints } from "~/utils/client-hints";
import { formatPublishDate } from "~/utils/format-publish-date";

import type { ArticleLoaderData } from "../route";

export type ArticleData = ArticleLoaderData;

export function ArticleView({ post }: { post: ArticleData }) {
	if (post.postType !== "articles") return null;

	return (
		<article className="mx-auto mb-8 flex max-w-3xl flex-col gap-8">
			<div className="mx-auto prose w-full max-w-prose space-y-8 prose-blue sm:prose-lg dark:prose-invert">
				{post.isPreview && post.publishedAt && (
					<Badge color="warning">
						<Badge.Text>
							<PublishDateBadge publishedAt={post.publishedAt} />
						</Badge.Text>
					</Badge>
				)}

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
