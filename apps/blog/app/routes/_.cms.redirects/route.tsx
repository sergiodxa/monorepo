/**
 * CMS route that lists configured redirects. Its loader reads every key from the
 * redirects KV namespace and parses each entry's from/to metadata, and its
 * component renders that list in a toolbar with a link to create a new redirect.
 * It exists to give admins an overview of all active URL redirects.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ok } from "@pkg/response";
import { Button, Form, Heading, Toolbar } from "@pkg/ui";
import { z } from "zod";

import { getBindings } from "~/middleware/bindings";

import type { Route } from "./+types/route";

import { RedirectsList } from "./components/list";

export async function loader(_: Route.LoaderArgs) {
	let bindings = getBindings();
	let { keys } = await bindings.kv.redirects.list();
	let list = z
		.object({ from: z.string(), to: z.string() })
		.array()
		.parse(keys.map((key) => key.metadata));

	return ok({ list });
}

export default function Component({ loaderData }: Route.ComponentProps) {
	return (
		<div className="flex flex-col gap-8 pb-10">
			<Toolbar className="items-center">
				<Heading level={2}>Redirects</Heading>
				<div className="grow" />
				<Form method="get" action="/cms/redirects/new">
					<Button type="submit" color="primary">
						Create Redirect
					</Button>
				</Form>
			</Toolbar>

			<RedirectsList list={loaderData.list} />
		</div>
	);
}
