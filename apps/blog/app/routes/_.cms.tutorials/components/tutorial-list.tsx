/**
 * Table component listing tutorials in the CMS. It renders each tutorial's title,
 * tags (with a scheduled marker for unpublished ones), and date, plus per-row edit
 * and delete actions where delete goes through a confirmation dialog. Exists as the
 * tutorial management table for the dashboard's tutorials section.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Button, Card, confirm, Form, Link, Table, TagGroup } from "@pkg/ui";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { useFetcher } from "react-router";

import type { UUID } from "~/utils/uuid";

import { INTENT } from "../types";

interface Tutorial {
	id: UUID;
	title: string;
	path: string;
	date: string;
	tags: string[];
	isPublished: boolean;
}

export function TutorialList({ tutorials }: { tutorials: Tutorial[] }) {
	return (
		<Card>
			<Table aria-label="Tutorials">
				<Table.Header>
					<Table.Column isRowHeader width={440}>
						Title
					</Table.Column>
					<Table.Column>Tags</Table.Column>
					<Table.Column className="w-32">Date</Table.Column>
					<Table.Column align="right">Actions</Table.Column>
				</Table.Header>
				<Table.Body items={tutorials}>
					{(tutorial) => (
						<Table.Row key={tutorial.id}>
							<Table.Cell>
								<Link href={tutorial.path}>{tutorial.title}</Link>
							</Table.Cell>
							<Table.Cell>
								<Tags tags={tutorial.tags} isScheduled={!tutorial.isPublished} />
							</Table.Cell>
							<Table.Cell>
								<time>{tutorial.date}</time>
							</Table.Cell>
							<Table.Cell>
								<Actions tutorial={tutorial} />
							</Table.Cell>
						</Table.Row>
					)}
				</Table.Body>
			</Table>
		</Card>
	);
}

function Tags({ tags, isScheduled }: { tags: string[]; isScheduled: boolean }) {
	let { t } = useTranslation("translation", { keyPrefix: "cms.tutorials.list" });
	let id = useId();

	return (
		<>
			<span id={id} className="sr-only">
				Tags
			</span>
			<TagGroup aria-labelledby={id}>
				<TagGroup.List className="flex-row">
					{isScheduled && (
						<TagGroup.Tag color="warning" size="sm">
							{t("scheduled")}
						</TagGroup.Tag>
					)}
					{tags.map((tag) => (
						<TagGroup.Tag key={tag} color="primary" size="sm">
							{tag}
						</TagGroup.Tag>
					))}
				</TagGroup.List>
			</TagGroup>
		</>
	);
}

function Actions({ tutorial }: { tutorial: Tutorial }) {
	return (
		<div className="flex justify-end gap-2">
			<Form method="get" action={`/cms/tutorials/${tutorial.id}`}>
				<Button type="submit" variant="outline" size="sm">
					Edit
				</Button>
			</Form>

			<DeleteButton id={tutorial.id} />
		</div>
	);
}

function DeleteButton({ id }: { id: UUID }) {
	let fetcher = useFetcher();

	async function handleDelete() {
		let confirmed = await confirm("Delete tutorial?", {
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
