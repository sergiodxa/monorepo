/**
 * CMS route for editing a single bookmark ("like"). Its loader fetches the like
 * by UUID and its action validates a title/URL form before updating the record on
 * behalf of the current user; the component renders the edit form. Exists so admins
 * can amend saved links from the dashboard.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ok } from "@pkg/response";
import { succeeded } from "@pkg/result";
import { Button, Card, FieldError, Form, Input, Label, TextField } from "@pkg/ui";
import { validate } from "@pkg/validate";
import { href, redirect } from "react-router";
import { z } from "zod";

import { getDB } from "~/middleware/drizzle";
import { requireUser } from "~/middleware/session";
import { Like } from "~/models/like.server";
import { assertUUID } from "~/utils/uuid";

import type { Route } from "./+types/route";

export async function loader({ params }: Route.LoaderArgs) {
	let id = z.string().parse(params.postId);
	assertUUID(id);

	let db = getDB();

	let like = await Like.show({ db }, id);

	return ok({ like: { title: like.title, url: like.url } });
}

export async function action({ request, params }: Route.ActionArgs) {
	let id = z.string().parse(params.postId);
	assertUUID(id);

	let db = getDB();

	let result = await validate(request, z.object({ title: z.string(), url: z.string().url() }));
	succeeded(result, "Invalid form data");

	let user = requireUser();
	await Like.update({ db }, id, {
		authorId: user.id,
		title: result.data.title,
		url: result.data.url,
	});

	return redirect(href("/cms/likes"));
}

export default function Component({ loaderData }: Route.ComponentProps) {
	return (
		<div className="flex flex-col gap-8 pb-10">
			<Card className="w-fit">
				<Card.Header>
					<Card.Title>Edit Like</Card.Title>
				</Card.Header>
				<Card.Content>
					<Form method="post" className="min-w-xs">
						<TextField
							name="url"
							type="url"
							isRequired
							defaultValue={loaderData.like.url.toString()}
						>
							<Label>URL</Label>
							<Input />
							<FieldError />
						</TextField>

						<TextField name="title" type="text" defaultValue={loaderData.like.title}>
							<Label>Title (optional)</Label>
							<Input />
							<FieldError />
						</TextField>

						<Button type="submit" color="primary">
							Save
						</Button>
					</Form>
				</Card.Content>
			</Card>
		</div>
	);
}
