import { ok } from "@pkg/response";
import { Button, Form, Heading, Toolbar } from "@pkg/ui";
import { href, redirect } from "react-router";
import { z } from "zod";

import { getDB } from "~/middleware/drizzle";
import { getLocale } from "~/middleware/i18next";
import { logger } from "~/middleware/logger";
import { Tutorial } from "~/models/tutorial.server";
import { assertUUID } from "~/utils/uuid";

import type { Route } from "./+types/route";

import { TutorialList } from "./components/tutorial-list";
import { deleteTutorial } from "./queries";
import { INTENT } from "./types";

export async function loader(_: Route.LoaderArgs) {
	let db = getDB();
	let tutorials = await Tutorial.list({ db }, { onlyPublished: false });
	let locale = getLocale();

	return ok({
		tutorials: tutorials.map((tutorial) => {
			return {
				id: tutorial.id,
				title: tutorial.title,
				path: tutorial.pathname,
				tags: tutorial.tags,
				date: tutorial.createdAt.toLocaleDateString(locale, {
					year: "numeric",
					month: "short",
					day: "numeric",
				}),
				isPublished: tutorial.isPublished,
				publishedAt: tutorial.publishedAt,
			};
		}),
	});
}

export async function action({ request }: Route.ActionArgs) {
	let formData = await request.formData();
	let intent = z.enum([INTENT.delete]).parse(formData.get("intent"));

	try {
		if (intent === INTENT.delete) {
			let id = formData.get("id");
			assertUUID(id);
			await deleteTutorial(id);
		}

		return redirect(href("/cms/tutorials"));
	} catch (exception) {
		if (exception instanceof Response) throw exception;
		if (exception instanceof Error)
			logger.error("cms-tutorials-action-failed", { error: exception.message });
		return redirect(href("/cms/tutorials"));
	}
}

export default function Component({ loaderData }: Route.ComponentProps) {
	return (
		<div className="flex flex-col gap-8 pb-10">
			<Toolbar className="items-center">
				<Heading level={2}>Tutorials</Heading>
				<div className="grow" />
				<Form method="get" action="/cms/tutorials/new">
					<Button type="submit" color="primary">
						Write Tutorial
					</Button>
				</Form>
			</Toolbar>

			<TutorialList tutorials={loaderData.tutorials} />
		</div>
	);
}
