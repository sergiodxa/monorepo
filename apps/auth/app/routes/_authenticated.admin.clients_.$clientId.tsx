import { ok } from "@pkg/response";
import { Button, Card, confirm, Form, Label, LinkButton } from "@pkg/ui";
import { useTranslation } from "react-i18next";
import { data, href, redirect, useNavigation } from "react-router";

import { db } from "~/middleware/drizzle";
import Client from "~/models/client";
import Grant from "~/models/grant";

import type { Route } from "./+types/_authenticated.admin.clients_.$clientId";

export function meta({ data }: Route.MetaArgs) {
	let title = data?.client?.name ?? "Client";
	return [{ title: `${title} | Auth` }];
}

export async function loader({ params }: Route.LoaderArgs) {
	let [client, authorizedUsersCount] = await Promise.all([
		Client.findById(db(), params.clientId),
		Grant.countByClientId(db(), params.clientId),
	]);

	if (!client) {
		throw new Response("Client not found", { status: 404 });
	}

	return ok({
		client: {
			id: client.id,
			name: client.name,
			description: client.description,
			redirectUri: client.redirectUri,
			logoutUri: client.logoutUri,
			createdAt: client.createdAt.toISOString(),
		},
		authorizedUsersCount,
	});
}

export async function action({ params, request }: Route.ActionArgs) {
	let formData = await request.formData();
	let intent = formData.get("intent");

	if (intent === "delete") {
		// Delete grants before deleting client
		await Grant.deleteByClientId(db(), params.clientId);
		await Client.delete(db(), params.clientId);
		return redirect(href("/admin/clients"));
	}

	return data({ error: "Invalid intent" }, { status: 400 });
}

export default function ClientDetailPage({ loaderData }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "admin.clients" });
	let { client, authorizedUsersCount } = loaderData;
	let navigation = useNavigation();
	let isDeleting = navigation.state === "submitting";

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
		<Card>
			<Card.Header>
				<Card.Title>{client.name}</Card.Title>
			</Card.Header>

			<Card.Content className="grid gap-4 sm:grid-cols-2">
				<div>
					<Label className="text-sm font-medium">{t("detail.id")}</Label>
					<p className="mt-1 font-mono text-sm">{client.id}</p>
				</div>
				<div>
					<Label className="text-sm font-medium">{t("detail.name")}</Label>
					<p className="mt-1">{client.name}</p>
				</div>
				<div className="sm:col-span-2">
					<Label className="text-sm font-medium">{t("detail.description")}</Label>
					<p className="mt-1 text-sm">
						{client.description || (
							<span className="text-neutral-500">{t("detail.noDescription")}</span>
						)}
					</p>
				</div>
				<div>
					<Label className="text-sm font-medium">{t("detail.secret")}</Label>
					<p className="mt-1 text-sm text-neutral-500">{t("detail.secretHidden")}</p>
				</div>
				<div>
					<Label className="text-sm font-medium">{t("detail.authorizedUsers")}</Label>
					<p className="mt-1 text-sm">{authorizedUsersCount}</p>
				</div>
				<div>
					<Label className="text-sm font-medium">{t("detail.createdAt")}</Label>
					<p className="mt-1 text-sm">
						{new Date(client.createdAt).toLocaleDateString(undefined, {
							year: "numeric",
							month: "long",
							day: "numeric",
							hour: "2-digit",
							minute: "2-digit",
						})}
					</p>
				</div>
				<div className="sm:col-span-2">
					<Label className="text-sm font-medium">{t("detail.redirectUri")}</Label>
					<p className="mt-1 font-mono text-sm break-all">{client.redirectUri}</p>
				</div>
				<div className="sm:col-span-2">
					<Label className="text-sm font-medium">{t("detail.logoutUri")}</Label>
					<p className="mt-1 font-mono text-sm break-all">{client.logoutUri}</p>
				</div>
			</Card.Content>

			<Card.Footer className="flex gap-2">
				<LinkButton href={href("/admin/clients/:clientId/edit", { clientId: client.id })}>
					{t("actions.edit")}
				</LinkButton>
				<Form method="POST" onSubmit={handleDelete}>
					<input type="hidden" name="intent" value="delete" />
					<Button type="submit" color="danger" isPending={isDeleting}>
						{t("actions.delete")}
					</Button>
				</Form>
			</Card.Footer>
		</Card>
	);
}
