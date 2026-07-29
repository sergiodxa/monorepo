/**
 * The admin clients-list route (/admin/clients). Its loader returns a paginated list
 * of OAuth clients with total counts; the action deletes a client by id. The component
 * renders the clients table with view/edit links, confirm-guarded delete forms, and
 * pagination controls. Exists as the admin overview for managing registered clients.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ok } from "@pkg/response";
import {
	Button,
	confirm,
	Form,
	Link,
	LinkButton,
	Pagination,
	PaginationButton,
	PaginationItem,
	PaginationLink,
	PaginationList,
	Table,
} from "@pkg/ui";
import { useTranslation } from "react-i18next";
import { data, href, redirect, useSearchParams } from "react-router";

import { AppHeader } from "~/components/app-header";
import { db } from "~/middleware/drizzle";
import Client from "~/models/client";

import type { Route } from "./+types/route";

export function meta(): Route.MetaDescriptors {
	return [{ title: "Clients | Auth" }];
}

const PAGE_SIZE = 10;

export async function action({ request }: Route.ActionArgs) {
	let formData = await request.formData();
	let intent = formData.get("intent");
	let clientId = formData.get("clientId");

	if (intent === "delete" && typeof clientId === "string") {
		await Client.delete(db(), clientId);
		return redirect(href("/admin/clients"));
	}

	return data({ error: "Invalid intent" }, { status: 400 });
}

export async function loader({ request }: Route.LoaderArgs) {
	let url = new URL(request.url);
	let page = Math.max(1, Number(url.searchParams.get("page")) || 1);
	let offset = (page - 1) * PAGE_SIZE;

	let [clients, totalCount] = await Promise.all([
		Client.findAll(db(), { limit: PAGE_SIZE, offset }),
		Client.count(db()),
	]);

	let totalPages = Math.ceil(totalCount / PAGE_SIZE);

	return ok({
		clients: clients.map((c) => ({
			id: c.id,
			name: c.name,
			redirectUri: c.redirectUri,
			createdAt: c.createdAt.toISOString(),
		})),
		pagination: {
			page,
			totalPages,
			totalCount,
		},
	});
}

export default function ClientsListPage({ loaderData }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "admin.clients" });
	let { clients, pagination } = loaderData;
	let [searchParams] = useSearchParams();

	function getPageUrl(page: number) {
		let params = new URLSearchParams(searchParams);
		params.set("page", page.toString());
		return `?${params.toString()}`;
	}

	async function handleDelete(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		let confirmed = await confirm(t("delete.title"), {
			description: t("delete.confirm"),
			confirmLabel: t("actions.delete"),
			color: "danger",
		});

		if (confirmed) {
			(e.target as HTMLFormElement).submit();
		}
	}

	return (
		<>
			<AppHeader heading={t("title")}>
				<LinkButton href={href("/admin/clients/new")}>{t("actions.create")}</LinkButton>
			</AppHeader>

			<p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{t("description")}</p>

			{clients.length === 0 ? (
				<div className="mt-8 rounded-lg border border-neutral-200 p-8 text-center dark:border-neutral-700">
					<p className="text-neutral-500">{t("empty")}</p>
				</div>
			) : (
				<>
					<Table aria-label={t("title")} className="mt-6">
						<Table.Header>
							<Table.Column isRowHeader>{t("table.name")}</Table.Column>
							<Table.Column>{t("table.redirectUri")}</Table.Column>
							<Table.Column>{t("table.createdAt")}</Table.Column>
							<Table.Column>{t("table.actions")}</Table.Column>
						</Table.Header>
						<Table.Body items={clients}>
							{(client) => (
								<Table.Row id={client.id}>
									<Table.Cell>
										<Link href={`clients/${client.id}`} className="font-medium hover:underline">
											{client.name}
										</Link>
									</Table.Cell>
									<Table.Cell className="font-mono text-sm">{client.redirectUri}</Table.Cell>
									<Table.Cell>
										{new Date(client.createdAt).toLocaleDateString(undefined, {
											year: "numeric",
											month: "short",
											day: "numeric",
										})}
									</Table.Cell>
									<Table.Cell>
										<div className="flex gap-2">
											<LinkButton href={`clients/${client.id}`} size="sm" color="neutral">
												{t("actions.view")}
											</LinkButton>
											<LinkButton href={`clients/${client.id}/edit`} size="sm" color="neutral">
												{t("actions.edit")}
											</LinkButton>
											<Form method="POST" onSubmit={handleDelete}>
												<input type="hidden" name="intent" value="delete" />
												<input type="hidden" name="clientId" value={client.id} />
												<Button type="submit" size="sm" color="danger">
													{t("actions.delete")}
												</Button>
											</Form>
										</div>
									</Table.Cell>
								</Table.Row>
							)}
						</Table.Body>
					</Table>

					{pagination.totalPages > 1 && (
						<Pagination aria-label="Clients pagination" className="mt-4 flex justify-center">
							<PaginationList>
								<PaginationItem>
									<PaginationButton
										aria-label="Previous page"
										isDisabled={pagination.page === 1}
										onPress={() => {
											window.location.href = getPageUrl(pagination.page - 1);
										}}
									>
										Previous
									</PaginationButton>
								</PaginationItem>
								{Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
									<PaginationItem key={page}>
										<PaginationLink href={getPageUrl(page)} isCurrent={page === pagination.page}>
											{page}
										</PaginationLink>
									</PaginationItem>
								))}
								<PaginationItem>
									<PaginationButton
										aria-label="Next page"
										isDisabled={pagination.page === pagination.totalPages}
										onPress={() => {
											window.location.href = getPageUrl(pagination.page + 1);
										}}
									>
										Next
									</PaginationButton>
								</PaginationItem>
							</PaginationList>
						</Pagination>
					)}
				</>
			)}
		</>
	);
}
