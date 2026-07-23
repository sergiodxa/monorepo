/**
 * The admin edit-client route (/admin/clients/:clientId/edit). Its loader loads the
 * client (404 if missing); the action validates and persists changes and, when the
 * regenerate-secret box is checked, returns a freshly generated secret to display
 * once. The component renders the edit form and the one-time new-secret view. Exists
 * to let admins update a client and optionally rotate its secret.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ok } from "@pkg/response";
import { isFailure } from "@pkg/result";
import {
	Alert,
	Button,
	Card,
	Checkbox,
	Form,
	Input,
	Label,
	LinkButton,
	TextArea,
	TextField,
} from "@pkg/ui";
import { validate } from "@pkg/validate";
import { useTranslation } from "react-i18next";
import { data, href, redirect, useActionData, useNavigation } from "react-router";
import { z } from "zod";

import { db } from "~/middleware/drizzle";
import Client from "~/models/client";

import type { Route } from "./+types/route";

export function meta({ loaderData }: Route.MetaArgs) {
	let title = loaderData?.client?.name ?? "Client";
	return [{ title: `Edit ${title} | Auth` }];
}

let UpdateClientSchema = z.object({
	name: z.string().min(1),
	description: z.string().max(280).optional(),
	logoUrl: z.string().url().optional().or(z.literal("")),
	redirectUri: z.string().url(),
	logoutUri: z.string().url(),
	regenerateSecret: z
		.string()
		.optional()
		.transform((v) => v === "on"),
});

export async function loader({ params }: Route.LoaderArgs) {
	let client = await Client.findById(db(), params.clientId);

	if (!client) {
		throw new Response("Client not found", { status: 404 });
	}

	return ok({
		client: {
			id: client.id,
			name: client.name,
			description: client.description,
			logoUrl: client.logoUrl,
			redirectUri: client.redirectUri,
			logoutUri: client.logoutUri,
		},
	});
}

export async function action({ params, request }: Route.ActionArgs) {
	let result = await validate(request, UpdateClientSchema);

	if (isFailure(result)) {
		return data({ errors: result.error, newSecret: null }, { status: 400 });
	}

	let updated = await Client.update(db(), params.clientId, result.data);

	if (updated.newSecret) {
		return data({ errors: null, newSecret: updated.newSecret });
	}

	return redirect(href("/admin/clients/:clientId", { clientId: params.clientId }));
}

export default function EditClientPage({ loaderData }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "admin.clients" });
	let { client } = loaderData;
	let actionData = useActionData<typeof action>();
	let navigation = useNavigation();
	let isSubmitting = navigation.state === "submitting";

	// If a new secret was generated, show it
	if (actionData?.newSecret) {
		return (
			<>
				<Alert color="warning">
					<Alert.Title>{t("edit.secretRegenerated")}</Alert.Title>
					<Alert.Description>{t("create.secretWarning")}</Alert.Description>
				</Alert>

				<Card className="mt-6">
					<Card.Header>
						<Card.Title>{client.name}</Card.Title>
					</Card.Header>
					<Card.Content>
						<div>
							<Label className="text-sm font-medium">{t("detail.secret")}</Label>
							<p className="mt-1 rounded-md bg-neutral-100 p-2 font-mono text-sm dark:bg-neutral-800">
								{actionData.newSecret}
							</p>
						</div>
					</Card.Content>
					<Card.Footer>
						<LinkButton href={href("/admin/clients/:clientId", { clientId: client.id })}>
							{t("actions.view")}
						</LinkButton>
					</Card.Footer>
				</Card>
			</>
		);
	}

	return (
		<Card>
			<Card.Header>
				<Card.Title>{t("edit.title")}</Card.Title>
				<Card.Description>{t("edit.description")}</Card.Description>
			</Card.Header>

			<Form method="POST">
				<Card.Content className="flex flex-col gap-4">
					<TextField name="name" isRequired defaultValue={client.name}>
						<Label>{t("form.name.label")}</Label>
						<Input placeholder={t("form.name.placeholder")} />
					</TextField>

					<TextField name="description" defaultValue={client.description ?? ""}>
						<Label>{t("form.description.label")}</Label>
						<TextArea rows={3} maxLength={280} placeholder={t("form.description.placeholder")} />
					</TextField>

					<TextField name="logoUrl" defaultValue={client.logoUrl ?? ""}>
						<Label>{t("form.logoUrl.label")}</Label>
						<Input type="url" placeholder={t("form.logoUrl.placeholder")} />
					</TextField>

					<TextField name="redirectUri" isRequired defaultValue={client.redirectUri}>
						<Label>{t("form.redirectUri.label")}</Label>
						<Input type="url" placeholder={t("form.redirectUri.placeholder")} />
					</TextField>

					<TextField name="logoutUri" isRequired defaultValue={client.logoutUri}>
						<Label>{t("form.logoutUri.label")}</Label>
						<Input type="url" placeholder={t("form.logoutUri.placeholder")} />
					</TextField>

					<Checkbox name="regenerateSecret">
						<Label>{t("actions.regenerateSecret")}</Label>
					</Checkbox>

					{actionData?.errors && (
						<Alert color="danger">
							<Alert.Title>Validation Error</Alert.Title>
							<Alert.Description>Please check the form fields.</Alert.Description>
						</Alert>
					)}
				</Card.Content>

				<Card.Footer className="flex gap-2">
					<Button type="submit" isPending={isSubmitting}>
						{t("form.submit")}
					</Button>
					<LinkButton
						href={href("/admin/clients/:clientId", { clientId: client.id })}
						color="neutral"
						variant="ghost"
					>
						{t("form.cancel")}
					</LinkButton>
				</Card.Footer>
			</Form>
		</Card>
	);
}
