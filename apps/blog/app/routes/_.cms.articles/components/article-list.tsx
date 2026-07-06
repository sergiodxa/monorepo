/**
 * Table component listing articles in the CMS. It renders each article's title,
 * scheduled badge, and date, plus per-row actions to edit, move to a tutorial, or
 * delete (with a confirmation dialog and fetcher submission). Exists as the article
 * management table for the dashboard's articles section.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Badge, Button, Card, confirm, Form, Link, Table } from "@pkg/ui";
import { useTranslation } from "react-i18next";
import { useFetcher } from "react-router";

import type { UUID } from "~/utils/uuid";

import type { action } from "../route";

import { INTENT } from "../types";

interface Article {
	id: UUID;
	title: string;
	path: string;
	date: string;
	isPublished: boolean;
	publishedAt: string | null;
}

export function ArticlesList({ articles }: { articles: Article[] }) {
	let { t } = useTranslation("translation", { keyPrefix: "cms.articles.list" });

	return (
		<Card>
			<Table aria-label="Articles">
				<Table.Header>
					<Table.Column isRowHeader>Title</Table.Column>
					<Table.Column>Date</Table.Column>
					<Table.Column align="right">Actions</Table.Column>
				</Table.Header>
				<Table.Body items={articles}>
					{(article) => (
						<Table.Row key={article.id}>
							<Table.Cell>
								<Link href={article.path}>{article.title}</Link>
								{!article.isPublished && (
									<Badge color="warning" className="ml-2">
										{t("scheduled")}
									</Badge>
								)}
							</Table.Cell>
							<Table.Cell>
								<time>{article.date}</time>
							</Table.Cell>
							<Table.Cell>
								<Actions article={article} />
							</Table.Cell>
						</Table.Row>
					)}
				</Table.Body>
			</Table>
		</Card>
	);
}

function Actions({ article }: { article: Article }) {
	let fetcher = useFetcher<typeof action>();

	return (
		<div className="flex justify-end gap-2">
			<Form method="get" action={`/cms/articles/${article.id}`}>
				<Button type="submit" variant="outline" size="sm">
					Edit
				</Button>
			</Form>

			<fetcher.Form method="post">
				<input type="hidden" name="id" value={article.id} />
				<Button
					type="submit"
					name="intent"
					value={INTENT.moveToTutorial}
					variant="outline"
					size="sm"
				>
					Move to Tutorial
				</Button>
			</fetcher.Form>

			<DeleteButton id={article.id} />
		</div>
	);
}

function DeleteButton({ id }: { id: UUID }) {
	let fetcher = useFetcher();

	async function handleDelete() {
		let confirmed = await confirm("Delete article?", {
			description: "This action cannot be undone.",
			confirmLabel: "Delete",
			cancelLabel: "Cancel",
		});
		if (confirmed) {
			fetcher.submit({ intent: INTENT.delete, id }, { method: "POST" });
		}
	}

	return (
		<Button
			type="button"
			color="danger"
			size="sm"
			onPress={handleDelete}
			isPending={fetcher.state !== "idle"}
		>
			{fetcher.state !== "idle" ? "Deleting..." : "Delete"}
		</Button>
	);
}
