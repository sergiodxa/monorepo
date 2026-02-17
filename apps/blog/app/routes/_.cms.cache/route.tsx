import { ok } from "@pkg/response";
import { Button, Form, Heading, Toolbar } from "@pkg/ui";
import { useId } from "react";
import { href, redirect } from "react-router";
import { z } from "zod";

import { getCache } from "~/middleware/cache";

import type { Route } from "./+types/route";

import { CacheKeyList } from "./components/list";
import { INTENT } from "./types";

export async function loader(_: Route.LoaderArgs) {
	let cache = getCache();
	let keys = await cache.list();
	return ok({ keys });
}

export async function action({ request }: Route.ActionArgs) {
	let cache = getCache();
	let formData = await request.formData();

	if (formData.get("intent") === INTENT.clear) {
		let keys = await cache.list();
		await Promise.all(keys.map((key) => cache.delete(key)));
	}

	if (formData.get("intent") === INTENT.deleteSelected) {
		let keys = z.string().array().parse(formData.getAll("key"));
		await Promise.all(keys.map((key) => cache.delete(key)));
	}

	return redirect(href("/cms/cache"));
}

export default function Component({ loaderData }: Route.ComponentProps) {
	let id = useId();

	return (
		<div className="flex flex-col gap-8 pb-10">
			<Toolbar className="items-center">
				<Heading level={2}>Cache Keys</Heading>
				<div className="grow" />
				<Form method="post">
					<Button type="submit" name="intent" value={INTENT.clear} color="primary">
						Clear Cache
					</Button>
				</Form>
				<Button type="submit" name="intent" value={INTENT.deleteSelected} form={id} color="neutral">
					Delete Selected
				</Button>
			</Toolbar>

			<Form method="post" id={id}>
				<CacheKeyList keys={loaderData.keys} />
			</Form>
		</div>
	);
}
