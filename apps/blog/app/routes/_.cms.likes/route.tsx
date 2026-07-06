/**
 * CMS route for managing likes (bookmarks). Its loader lists likes with
 * locale-formatted timestamps, its action handles a delete intent by removing the
 * selected like, and its component renders a toolbar and the likes list with a
 * link to create new ones. It exists to let admins review and delete bookmarks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ValidationErrors } from "@react-types/shared";

import { badRequest, ok } from "@pkg/response";
import { Button, Form, Heading, Toolbar } from "@pkg/ui";

import { getDB } from "~/middleware/drizzle";
import { getLocale } from "~/middleware/i18next";
import { Like } from "~/models/like.server";
import { assertUUID } from "~/utils/uuid";

import type { Route } from "./+types/route";

import { LikesList } from "./components/likes-list";
import { deleteLike } from "./queries";
import { INTENT } from "./types";

export async function loader(_: Route.LoaderArgs) {
	let likes = await Like.list({ db: getDB() });
	let locale = getLocale();

	return ok({
		likes: likes.map((like) => {
			return {
				id: like.id,
				title: like.title,
				url: like.url,
				createdAt: like.createdAt.toLocaleString(locale, {
					dateStyle: "medium",
				}),
				updatedAt: like.updatedAt.toLocaleString(locale, {
					dateStyle: "medium",
				}),
			};
		}),
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

		await deleteLike(id);

		return ok(null);
	}

	return badRequest<ValidationErrors>({ intent: `Invalid intent ${intent}` });
}

export default function Component({ loaderData }: Route.ComponentProps) {
	return (
		<div className="flex flex-col gap-8 pb-10">
			<Toolbar className="items-center">
				<Heading level={2}>Likes</Heading>
				<div className="grow" />
				<Form method="get" action="/cms/likes/new">
					<Button type="submit" color="primary">
						Create Like
					</Button>
				</Form>
			</Toolbar>

			<LikesList likes={loaderData.likes} />
		</div>
	);
}
