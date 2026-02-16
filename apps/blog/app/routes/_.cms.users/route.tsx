import type { FocusEvent, FormEvent } from "react";

import { ok } from "@pkg/response";
import { Button, Form, Label, SearchField, Table } from "@pkg/ui";
import { eq } from "drizzle-orm";
import { useTranslation } from "react-i18next";
import { useSearchParams, useSubmit } from "react-router";
import { z } from "zod";

import * as schema from "~/db/schema";
import { getDB } from "~/middleware/drizzle";
import { getLocale } from "~/middleware/i18next";

import type { Route } from "./+types/route";

export async function loader({ request }: Route.LoaderArgs) {
	let db = getDB();

	let url = new URL(request.url);

	let query = z.string().nullable().parse(url.searchParams.get("q")) ?? "";

	let users = await db.query.users.findMany({
		where: query ? eq(schema.users.displayName, query) : undefined,
	});

	let locale = getLocale();

	return ok({
		users: users.map((user) => ({
			...user,
			createdAt: user.createdAt.toLocaleDateString(locale),
			updatedAt: user.updatedAt.toLocaleDateString(locale),
		})),
	});
}

export default function Component({ loaderData }: Route.ComponentProps) {
	return (
		<main className="mx-auto flex max-w-screen-lg flex-col gap-8">
			<h2 className="text-3xl font-bold">Users</h2>

			<SearchForm />
			<UsersTable users={loaderData.users} />
		</main>
	);
}

function SearchForm() {
	let [searchParams] = useSearchParams();
	let submit = useSubmit();
	let { t } = useTranslation("translation", { keyPrefix: "cms.users.search" });

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		submit(event.currentTarget);
	}

	function handleBlur(event: FocusEvent<HTMLInputElement>) {
		let target = event.currentTarget;
		if (target instanceof HTMLInputElement) submit(target.form);
	}

	function handleInput(event: FormEvent<HTMLInputElement>) {
		let target = event.currentTarget;
		if (target instanceof HTMLInputElement) submit(target.form);
	}

	return (
		<Form method="get" action="/cms/users" onSubmit={handleSubmit} className="flex gap-4">
			<SearchField
				name="q"
				defaultValue={searchParams.get("q") ?? undefined}
				onBlur={handleBlur}
				onInput={handleInput}
				className="contents"
			>
				<Label className="sr-only">{t("label")}</Label>
				<SearchField.Input className="rounded-md border-2 border-blue-600 px-3 py-1" />
			</SearchField>

			<Button type="submit" color="primary">
				{t("cta")}
			</Button>
		</Form>
	);
}

function UsersTable({ users }: Pick<Route.ComponentProps["loaderData"], "users">) {
	let { t } = useTranslation("translation", { keyPrefix: "cms.users.table" });

	return (
		<Table aria-label="Users" className="w-full">
			<Table.Header>
				<Table.Column align="left" isRowHeader>
					{t("header.name")}
				</Table.Column>
				<Table.Column align="left">{t("header.role")}</Table.Column>
				<Table.Column align="left">{t("header.email")}</Table.Column>
				<Table.Column align="right">{t("header.createdAt")}</Table.Column>
				<Table.Column align="right">{t("header.updatedAt")}</Table.Column>
			</Table.Header>

			<Table.Body>
				{users.map((user) => {
					return (
						<Table.Row key={user.id}>
							<Table.Cell>{user.displayName}</Table.Cell>
							<Table.Cell>{user.role}</Table.Cell>
							<Table.Cell>{user.email}</Table.Cell>
							<Table.Cell className="text-right">{user.createdAt}</Table.Cell>
							<Table.Cell className="text-right">{user.updatedAt}</Table.Cell>
						</Table.Row>
					);
				})}
			</Table.Body>
		</Table>
	);
}
