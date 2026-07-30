/**
 * CMS route for creating and editing a glossary term at /cms/glossary/:id. Its
 * loader seeds an empty form for "new" or loads an existing term by id, and its
 * action validates the submission, creates or updates the term, busts the
 * glossary feed caches, and redirects to the term's anchor on the glossary page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ok } from "@pkg/response";
import { succeeded } from "@pkg/result";
import { slugify } from "@pkg/strings";
import {
	Button,
	Card,
	FieldError,
	Form,
	Heading,
	Input,
	Label,
	TextArea,
	TextField,
	Toolbar,
} from "@pkg/ui";
import { validate } from "@pkg/validate";
import { href, redirect, redirectDocument } from "react-router";
import { z } from "zod";

import { getCache } from "~/middleware/cache";
import { getDB } from "~/middleware/drizzle";
import { requireUser } from "~/middleware/session";
import { Glossary } from "~/models/glossary.server";
import { assertUUID } from "~/utils/uuid";

import type { Route } from "./+types/route";

import { INTENT } from "./types";

export async function loader({ params }: Route.LoaderArgs) {
	if (params.id === "new") {
		return ok({
			mode: INTENT.create,
			glossary: {
				id: null,
				title: "",
				term: "",
				definition: "",
				slug: "",
			},
		});
	}

	let db = getDB();
	assertUUID(params.id);

	let glossary = await Glossary.show({ db }, params.id);

	return ok({
		mode: INTENT.update,
		glossary: {
			id: glossary.id,
			title: glossary.title,
			term: glossary.term,
			definition: glossary.definition,
			slug: glossary.slug,
		},
	});
}

export async function action({ request, params }: Route.ActionArgs) {
	let formData = await request.formData();

	let intent = formData.get("intent");

	if (intent === INTENT.create) {
		let result = await validate(
			formData,
			z.object({
				term: z.string(),
				title: z.string().optional(),
				definition: z.string(),
			}),
		);
		succeeded(result, "Invalid form data");

		let slug = slugify(result.data.term);

		let db = getDB();
		let user = requireUser();

		await Glossary.create(
			{ db },
			{
				authorId: user.id,
				slug,
				term: result.data.term,
				title: result.data.title,
				definition: result.data.definition,
			},
		);

		let cache = getCache();
		let cacheKey = await cache.list("feed:glossary:");

		await Promise.all([cache.delete("feed:glossary"), ...cacheKey.map((key) => cache.delete(key))]);

		return redirectDocument(`${href("/glossary")}#${slug}`);
	}

	if (intent === INTENT.update) {
		let result = await validate(
			formData,
			z.object({
				term: z.string(),
				title: z.string().optional(),
				definition: z.string(),
				slug: z.string(),
			}),
		);
		succeeded(result, "Invalid form data");

		let db = getDB();

		let id = params.id;
		assertUUID(id);

		let user = requireUser();

		await Glossary.update({ db }, id, {
			authorId: user.id,
			term: result.data.term,
			title: result.data.title,
			definition: result.data.definition,
			slug: result.data.slug,
		});

		let cache = getCache();
		let cacheKey = await cache.list("feed:glossary:");

		await Promise.all([cache.delete("feed:glossary"), ...cacheKey.map((key) => cache.delete(key))]);

		return redirectDocument(`${href("/glossary")}#${result.data.slug}`);
	}

	return redirect(href("/glossary"));
}

export default function Component({ loaderData }: Route.ComponentProps) {
	return (
		<div className="flex flex-col gap-8 pb-10">
			<Toolbar className="items-center">
				<Heading level={2}>Glossary</Heading>
				<div className="grow" />
			</Toolbar>

			<Card className="w-fit">
				<Card.Content>
					<Form method="post" className="min-w-xs">
						<input type="hidden" name="intent" value={loaderData.mode} />

						<TextField name="term" isRequired defaultValue={loaderData.glossary.term}>
							<Label>Term</Label>
							<Input aria-label="Term" />
							<FieldError />
						</TextField>

						{loaderData.mode === INTENT.update && (
							<TextField name="slug" defaultValue={loaderData.glossary.slug}>
								<Label>Slug</Label>
								<Input aria-label="Slug" />
								<FieldError />
							</TextField>
						)}

						<TextField name="title" defaultValue={loaderData.glossary.title}>
							<Label>Title</Label>
							<Input aria-label="Title" />
							<FieldError />
						</TextField>

						<TextField name="definition" isRequired defaultValue={loaderData.glossary.definition}>
							<Label>Definition</Label>
							<TextArea rows={5} />
							<FieldError />
						</TextField>

						<Button type="submit" color="primary">
							{loaderData.mode === INTENT.create ? "Create" : "Update"}
						</Button>
					</Form>
				</Card.Content>
			</Card>
		</div>
	);
}
