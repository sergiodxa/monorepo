import { Button, Card, confirm, Link, LinkButton, Table } from "@pkg/ui";
import { href, useFetcher } from "react-router";

import type { UUID } from "~/utils/uuid";

import { INTENT } from "../types";

interface Like {
	id: UUID;
	title: string;
	createdAt: string;
	url: URL;
}

interface LikesListProps {
	likes: Array<Like>;
}

export function LikesList({ likes }: LikesListProps) {
	return (
		<Card>
			<Table aria-label="Likes">
				<Table.Header>
					<Table.Column isRowHeader>Title</Table.Column>
					<Table.Column>Date</Table.Column>
					<Table.Column>Actions</Table.Column>
				</Table.Header>
				<Table.Body>
					{likes.map((like) => (
						<Table.Row key={like.id}>
							<Table.Cell>
								<Link href={like.url.toString()}>{like.title}</Link>
							</Table.Cell>
							<Table.Cell>{like.createdAt}</Table.Cell>
							<Table.Cell>
								<div className="flex items-center gap-1">
									<LinkButton
										href={href("/cms/likes/:postId", { postId: like.id })}
										size="sm"
										variant="outline"
									>
										Edit
									</LinkButton>
									<DeleteButton id={like.id} />
								</div>
							</Table.Cell>
						</Table.Row>
					))}
				</Table.Body>
			</Table>
		</Card>
	);
}

function DeleteButton({ id }: { id: UUID }) {
	let fetcher = useFetcher();

	async function handleDelete() {
		let confirmed = await confirm("Delete like?", {
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
