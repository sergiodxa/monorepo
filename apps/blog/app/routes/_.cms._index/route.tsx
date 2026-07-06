/**
 * CMS dashboard home route. Its loader gathers post stats, recent search terms, and
 * GitHub sponsors; its action handles the quick-like and database-dump intents with
 * validation and error reporting; its component lays out the stats, quick actions,
 * and recent-search panels. Exists as the landing screen of the admin dashboard.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { badRequest, ok } from "@pkg/response";
import { isFailure, isSuccess } from "@pkg/result";
import { validate } from "@pkg/validate";
import { href, redirect } from "react-router";
import { z } from "zod";

import { getBindings } from "~/middleware/bindings";
import { requireUser } from "~/middleware/session";
import { GitHub } from "~/modules/github.server";
import { assertUUID } from "~/utils/uuid";

import type { Route } from "./+types/route";

import { CreateLike } from "./components/create-like";
import { DumpDatabase } from "./components/dump-database";
import { LastDaySearch } from "./components/last-day-search";
import { Stats } from "./components/stats";
import { createQuickLike, queryLastDaySearch, queryStats } from "./queries";
import { INTENT } from "./types";

export async function loader(_: Route.LoaderArgs) {
	let user = requireUser();
	if (user.role !== "admin") throw redirect(href("/"));

	let [stats, lastDaySearch] = await Promise.all([queryStats(), queryLastDaySearch()]);

	let bindings = getBindings();

	let gh = new GitHub(bindings.env.GH_APP_ID, bindings.env.GH_APP_PEM);
	let sponsorsResult = await gh.sponsors();
	let sponsors = isSuccess(sponsorsResult)
		? sponsorsResult.data.node.sponsorshipsAsMaintainer.nodes.map((n) => n.sponsorEntity)
		: [];

	return ok({ stats, lastDaySearch, sponsors });
}

export async function action({ request }: Route.ActionArgs) {
	let user = requireUser();
	if (user.role !== "admin") throw redirect("/");

	let formData = await request.formData();

	if (formData.get("intent") === INTENT.createLike) {
		assertUUID(user.id);

		let result = await validate(
			formData,
			z.object({
				url: z
					.string()
					.url()
					.transform((value) => new URL(value)),
			}),
		);

		if (isFailure(result)) {
			return badRequest({
				intent: INTENT.createLike,
				errors: result.error.issues.reduce(
					(errors, issue) => {
						let path = issue.path?.[0];
						if (typeof path === "string" || typeof path === "number") {
							errors[String(path)] = issue.message;
						}
						return errors;
					},
					{} as Record<string, string>,
				),
			});
		}

		try {
			await createQuickLike(result.data.url, user.id);
			throw redirect("/cms");
		} catch (error) {
			if (error instanceof Response) throw error;
			if (error instanceof Error) {
				return badRequest({
					intent: INTENT.createLike,
					errors: { url: error.message },
				});
			}
			throw error;
		}
	}

	if (formData.get("intent") === INTENT.dump) {
		try {
			let bindings = getBindings();
			let dump = await bindings.db.dump();
			let date = new Date();
			await bindings.fs.backups.put(`${date.toISOString()}.sql`, dump);
			return ok({ intent: INTENT.dump });
		} catch (error) {
			let intent = "Failed to dump database.";
			if (error instanceof Error) intent = error.message;
			return badRequest({ intent: INTENT.dump, errors: { intent } });
		}
	}

	throw redirect(href("/cms"));
}

export default function Component({ loaderData, actionData }: Route.ComponentProps) {
	return (
		<div className="flex flex-col gap-8">
			<Stats stats={loaderData.stats} />
			<div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
				<div className="flex flex-col gap-5">
					<CreateLike actionData={actionData} />
					<DumpDatabase actionData={actionData} />
				</div>

				<div className="col-span-2">
					<LastDaySearch result={loaderData.lastDaySearch} />
				</div>
			</div>
		</div>
	);
}
