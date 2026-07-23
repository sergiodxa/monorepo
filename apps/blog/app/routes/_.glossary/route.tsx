/**
 * Public glossary route for the blog. Its loader fetches glossary terms and sets
 * page title, description and canonical meta, and its component renders a
 * definition list where each term is anchor-linkable and highlighted when
 * targeted, with admin-only edit links. It exists as the reader-facing glossary of
 * web development terms.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ok } from "@pkg/response";
import { Button, Card, Form } from "@pkg/ui";
import { useTranslation } from "react-i18next";

import { PageHeader } from "~/components/page-header";
import { useUser } from "~/hooks/use-user";

import type { Route } from "./+types/route";

import { queryGlossary } from "./query";

export const meta: Route.MetaFunction = ({ loaderData }) => loaderData?.meta ?? [];

export async function loader({ request }: Route.LoaderArgs) {
	return ok({
		glossary: await queryGlossary(),
		meta: [
			{ title: "Glossary of sergiodxa" },
			{
				name: "description",
				content: "My definition of terms used in web dev.",
			},
			{
				tagName: "link",
				rel: "canonical",
				href: new URL("/glossary", request.url).toString(),
			},
		] satisfies Route.MetaDescriptors,
	});
}

export default function Component({ loaderData }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "glossary" });
	let user = useUser();

	return (
		<main className="mx-auto mb-8 flex max-w-screen-sm flex-col gap-y-8">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
				<PageHeader t={t} />

				{user?.role === "admin" && (
					<Form method="get" action="/cms/glossary">
						<Button type="submit" color="primary">
							Define
						</Button>
					</Form>
				)}
			</div>

			<dl className="flex flex-col gap-8">
				{loaderData.glossary.map(({ id, slug, title, term, definition }) => {
					return (
						<Card
							key={id}
							id={slug}
							className="rounded-none border-2 border-transparent bg-transparent shadow-none target:-m-4 target:scroll-m-4 target:rounded-md target:border-neutral-500/50 target:bg-neutral-100 target:p-4 target:shadow-md target:dark:border-neutral-400/50 target:dark:bg-neutral-800 target:dark:text-neutral-100 target:dark:shadow-none"
						>
							<div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
								<dt className="text-xl font-bold">
									<a href={`#${slug}`}>
										{term}{" "}
										{title ? (
											<small className="text-sm text-neutral-700 dark:text-neutral-400">
												(aka {title})
											</small>
										) : null}
									</a>
								</dt>

								{user?.role === "admin" && (
									<Form method="get" action={`/cms/glossary/${id}`}>
										<Button type="submit" color="primary">
											Edit
										</Button>
									</Form>
								)}
							</div>
							<dd>{definition}</dd>
						</Card>
					);
				})}
			</dl>
		</main>
	);
}
