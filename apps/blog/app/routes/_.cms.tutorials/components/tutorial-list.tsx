import { Button, Form, Link, TagGroup } from "@pkg/ui";
import { useId } from "react";
import { Trans, useTranslation } from "react-i18next";

import type { UUID } from "~/utils/uuid";

import { INTENT } from "../types";

interface Tutorial {
	id: UUID;
	title: string;
	path: string;
	date: string;
	tags: string[];
}

export function TutorialList({ tutorials }: { tutorials: Tutorial[] }) {
	return (
		<ol className="rouned-lg divide-zinc-100 dark:divide-zinc-700 dark:bg-zinc-800 divide-y bg-white px-5">
			{tutorials.map((tutorial) => (
				<Item key={tutorial.id} {...tutorial} />
			))}
		</ol>
	);
}

function Item(props: Tutorial) {
	let { t } = useTranslation("translation", {
		keyPrefix: "cms.tutorials.list.item",
	});
	let id = useId();

	return (
		<li className="flex items-center justify-between gap-3 gap-x-6 py-5">
			<div className="flex flex-col gap-1">
				<Link href={props.path}>
					<h3 className="text-zinc-900 dark:text-zinc-50 text-sm leading-6 font-semibold underline">
						{props.title}
					</h3>
				</Link>

				<div className="text-zinc-500 dark:text-zinc-300 flex items-baseline gap-x-2 text-xs leading-5">
					<Trans
						t={t}
						className="whitespace-nowrap"
						parent="time"
						i18nKey="publishedOn"
						values={{ date: props.date }}
					/>
					<svg viewBox="0 0 2 2" className="h-0.5 w-0.5 fill-current" aria-hidden="true">
						<circle cx="1" cy="1" r="1" />
					</svg>

					<span id={id}>Tags:</span>

					<TagGroup aria-labelledby={id}>
						<TagGroup.List
							className="flex-row"
							items={props.tags.map((tag) => ({ id: tag, name: tag }))}
						>
							{(item) => <TagGroup.Tag color="primary">{item.name}</TagGroup.Tag>}
						</TagGroup.List>
					</TagGroup>
				</div>
			</div>

			<div className="flex shrink-0 items-center gap-2">
				<Form method="get" action={`/cms/tutorials/${props.id}`}>
					<Button type="submit" color="primary">
						{t("edit")}
					</Button>
				</Form>

				<DeleteButton id={props.id} />
			</div>
		</li>
	);
}

function DeleteButton({ id }: { id: UUID }) {
	return (
		<Form navigate={false} method="POST">
			<input type="hidden" name="intent" value={INTENT.delete} />
			<input type="hidden" name="id" value={id} />
			<Button type="submit" color="danger">
				Delete
			</Button>
		</Form>
	);
}
