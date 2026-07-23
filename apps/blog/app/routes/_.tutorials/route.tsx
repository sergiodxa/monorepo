/**
 * Tutorials listing route for the blog. Its loader reads an optional `q` search
 * term, fetches matching tutorials and page meta with short cache headers, and its
 * component renders the localized list with a subscribe box, draft badges and an
 * admin-only "Write" link. It exists as the public index of tutorials.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ok } from "@pkg/response";
import { Badge, Button, Form, Link } from "@pkg/ui";
import { cacheHeader } from "pretty-cache-header";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { PageHeader } from "~/components/page-header";
import { Subscribe } from "~/components/subscribe";
import { useUser } from "~/hooks/use-user";

import type { Route } from "./+types/route";

import { getMeta, queryTutorials } from "./queries";

export const meta: Route.MetaFunction = ({ loaderData }) => loaderData?.meta ?? [];

export async function loader({ request }: Route.LoaderArgs) {
	let url = new URL(request.url);

	let query = z
		.string()
		.transform((v) => v.toLowerCase().trim())
		.nullable()
		.parse(url.searchParams.get("q"));

	let tutorials = await queryTutorials(query);
	let headers = new Headers({
		"cache-control": cacheHeader({ maxAge: "10s", sMaxage: "0s" }),
	});

	return ok(
		{
			tutorials: tutorials.map((tutorial) => {
				return {
					path: tutorial.path,
					title: tutorial.title,
					isPublished: tutorial.isPublished,
				};
			}),
			meta: getMeta(url, query ?? ""),
		},
		{ headers },
	);
}

export default function Component({ loaderData }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "tutorials" });
	let user = useUser();

	return (
		<main className="mx-auto max-w-screen-sm space-y-2">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
				<PageHeader t={t} />
				{user?.role === "admin" && (
					<Form method="get" action="/cms/tutorials/new">
						<Button type="submit" color="primary">
							Write
						</Button>
					</Form>
				)}
			</div>

			<div className="flex flex-col gap-y-4">
				<Subscribe t={t} />

				<ul className="h-feed space-y-2">
					{loaderData.tutorials.map((tutorial) => (
						<li key={tutorial.path} className="h-entry list-inside list-disc">
							<Link href={tutorial.path} prefetch="intent" className="u-url">
								{tutorial.title}
							</Link>
							{!tutorial.isPublished && (
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
