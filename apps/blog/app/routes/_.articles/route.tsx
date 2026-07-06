/**
 * Articles index route that lists published articles (plus drafts for admins)
 * with a page header and subscribe callout. Its loader fetches the articles,
 * sets short cache-control headers, and emits localized title plus RSS and
 * canonical link meta so the listing is discoverable and syndicated.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { internalServerError, ok } from "@pkg/response";
import { Badge, Link } from "@pkg/ui";
import { cacheHeader } from "pretty-cache-header";
import { useTranslation } from "react-i18next";

import { PageHeader } from "~/components/page-header";
import { Subscribe } from "~/components/subscribe";
import { getI18nextInstance } from "~/middleware/i18next";

import type { Route } from "./+types/route";

import { queryArticles } from "./queries";

export const meta: Route.MetaFunction = ({ data }) => data?.meta ?? [];

export async function loader({ request }: Route.LoaderArgs) {
	let url = new URL(request.url);

	let headers = new Headers({
		"cache-control": cacheHeader({ maxAge: "10s", sMaxage: "0s" }),
	});

	let { t } = getI18nextInstance();

	try {
		let articles = await queryArticles();

		return ok(
			{
				articles,
				meta: [
					{ title: t("articles.meta.title") },
					{
						tagName: "link",
						rel: "alternate",
						type: "application/rss+xml",
						href: "/articles.rss",
					},
					{
						tagName: "link",
						rel: "canonical",
						href: new URL("/articles", url).toString(),
					},
				] satisfies Route.MetaDescriptors,
			},
			{ headers },
		);
	} catch (error) {
		if (error instanceof Error) {
			throw internalServerError({ message: error.message });
		}
		throw error;
	}
}

export default function Articles({ loaderData }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "articles" });

	return (
		<main className="mx-auto max-w-screen-sm space-y-2">
			<PageHeader t={t} />

			<div className="flex flex-col gap-y-4">
				<Subscribe t={t} />

				<ul className="space-y-2">
					{loaderData.articles.map((article) => (
						<li key={article.path} className="list-inside list-disc">
							<Link href={article.path} prefetch="intent">
								{article.title}
							</Link>
							{!article.isPublished && (
								<Badge color="warning" className="ml-2">
									<Badge.Text>{t("list.preview")}</Badge.Text>
								</Badge>
							)}
						</li>
					))}
				</ul>
			</div>
		</main>
	);
}
