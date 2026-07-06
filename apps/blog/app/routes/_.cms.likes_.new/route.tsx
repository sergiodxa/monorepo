/**
 * CMS route for creating a new "like" (a bookmarked link) at /cms/likes/new. Its
 * action validates the submitted URL and optional title, persists the like for
 * the current user via the Like model, and redirects back to the likes list. The
 * component renders the corresponding creation form.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { succeeded } from "@pkg/result";
import { Button, Card, FieldError, Form, Input, Label, TextField } from "@pkg/ui";
import { validate } from "@pkg/validate";
import { href, redirect } from "react-router";
import { z } from "zod";

import { getDB } from "~/middleware/drizzle";
import { requireUser } from "~/middleware/session";
import { Like } from "~/models/like.server";

import type { Route } from "./+types/route";

export async function action({ request }: Route.ActionArgs) {
	let result = await validate(
		request,
		z.object({
			url: z.string().url(),
			title: z.string().optional().default(""),
		}),
	);
	succeeded(result, "Invalid form data");

	let db = getDB();
	let user = requireUser();

	await Like.create(
		{ db },
		{
			authorId: user.id,
			title: result.data.title,
			url: result.data.url,
		},
	);

	return redirect(href("/cms/likes"));
}

export default function Component(_: Route.ComponentProps) {
	return (
		<div className="flex flex-col gap-8 pb-10">
			<Card className="w-fit">
				<Card.Header>
					<Card.Title>Create Like</Card.Title>
				</Card.Header>
				<Card.Content>
					<Form method="post" className="min-w-xs">
						<TextField name="url" type="url" isRequired>
							<Label>URL</Label>
							<Input aria-label="URL" />
							<FieldError />
						</TextField>

						<TextField name="title">
							<Label>Title (optional)</Label>
							<Input aria-label="Title" />
							<FieldError />
						</TextField>

						<Button type="submit" color="primary">
							Create
						</Button>
					</Form>
				</Card.Content>
			</Card>
		</div>
	);
}
