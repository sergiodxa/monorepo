/**
 * CMS route for managing glossary terms. Its loader lists glossary entries, its
 * action handles a delete intent by destroying the selected term, and its
 * component renders a table of terms with edit links and a confirming delete
 * button. It exists to let admins review, edit and remove glossary definitions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ValidationErrors } from "@react-types/shared";

import { badRequest, ok } from "@pkg/response";
import { Button, Card, confirm, Form, Heading, Table, Toolbar } from "@pkg/ui";
import { useFetcher } from "react-router";

import { getDB } from "~/middleware/drizzle";
import { Glossary } from "~/models/glossary.server";
import { assertUUID, type UUID } from "~/utils/uuid";

import type { Route } from "./+types/route";

const INTENT = { delete: "DELETE_GLOSSARY" as const };

export async function loader(_: Route.LoaderArgs) {
	let glossary = await Glossary.list({ db: getDB() });

	return ok({
		glossary: glossary.map((item) => ({
			id: item.id,
			term: item.term,
			title: item.title,
			definition: item.definition,
		})),
	});
}

export async function action({ request }: Route.ActionArgs) {
	let formData = await request.formData();
	let intent = formData.get("intent");

	if (!intent) {
		return badRequest<ValidationErrors>({ error: "Missing intent" });
	}

	if (intent === INTENT.delete) {
		let id = formData.get("id");
		assertUUID(id);

		await Glossary.destroy({ db: getDB() }, id);

		return ok(null);
	}

	return badRequest<ValidationErrors>({ intent: `Invalid intent ${intent}` });
}

export default function Component({ loaderData }: Route.ComponentProps) {
	return (
		<div className="flex flex-col gap-8 pb-10">
			<Toolbar className="items-center">
				<Heading level={2}>Glossary</Heading>
				<div className="grow" />
				<Form method="get" action="/cms/glossary/new">
					<Button type="submit" color="primary">
						New Term
					</Button>
				</Form>
			</Toolbar>

			<Card>
				<Table aria-label="Glossary">
					<Table.Header>
						<Table.Column isRowHeader>Term</Table.Column>
						<Table.Column>Title</Table.Column>
						<Table.Column>Definition</Table.Column>
						<Table.Column align="right">Actions</Table.Column>
					</Table.Header>
					<Table.Body>
						{loaderData.glossary.map((item) => (
							<Table.Row key={item.id}>
								<Table.Cell>{item.term}</Table.Cell>
								<Table.Cell>{item.title ?? "-"}</Table.Cell>
								<Table.Cell>
									{item.definition.length > 50
										? `${item.definition.slice(0, 50)}...`
										: item.definition}
								</Table.Cell>
								<Table.Cell>
									<Actions item={item} />
								</Table.Cell>
							</Table.Row>
						))}
					</Table.Body>
				</Table>
			</Card>
		</div>
	);
}

interface GlossaryItem {
	id: UUID;
	term: string;
	title: string | undefined;
	definition: string;
}

function Actions({ item }: { item: GlossaryItem }) {
	return (
		<div className="flex justify-end gap-2">
			<Form method="get" action={`/cms/glossary/${item.id}`}>
				<Button type="submit" variant="outline" size="sm">
					Edit
				</Button>
			</Form>
			<DeleteButton id={item.id} />
		</div>
	);
}

function DeleteButton({ id }: { id: UUID }) {
	let fetcher = useFetcher();

	async function handleDelete() {
		let confirmed = await confirm("Delete glossary term?", {
			description: "This action cannot be undone.",
			confirmLabel: "Delete",
			cancelLabel: "Cancel",
		});
		if (confirmed) {
			fetcher.submit({ intent: INTENT.delete, id }, { method: "POST" });
		}
	}

	let isDeleting = fetcher.state !== "idle";

	return (
		<Button type="button" color="danger" size="sm" onPress={handleDelete} isPending={isDeleting}>
			{isDeleting ? "Deleting..." : "Delete"}
		</Button>
	);
}
