/**
 * The admin new-client route (/admin/clients/new). Its action validates the client
 * details and creates the OAuth client, then returns the generated client secret once
 * so it can be shown to the admin. The component renders the creation form and, after
 * success, a one-time display of the new client's id, secret and URIs. Exists to let
 * admins register new OAuth clients.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@pkg/result";
import { Alert, Button, Card, Form, Input, Label, LinkButton, TextArea, TextField } from "@pkg/ui";
import { validate } from "@pkg/validate";
import { useTranslation } from "react-i18next";
import { data, href, useActionData, useNavigation } from "react-router";
import { z } from "zod";

import { db } from "~/middleware/drizzle";
import Client from "~/models/client";

import type { Route } from "./+types/route";

export function meta(): Route.MetaDescriptors {
	return [{ title: "New Client | Auth" }];
}

let CreateClientSchema = z.object({
	name: z.string().min(1),
	description: z.string().max(280).optional(),
	logoUrl: z.string().url().optional().or(z.literal("")),
	redirectUri: z.string().url(),
	logoutUri: z.string().url(),
});

export async function action({ request }: Route.ActionArgs) {
	let result = await validate(request, CreateClientSchema);

	if (isFailure(result)) {
		return data({ errors: result.error, client: null }, { status: 400 });
	}

	let client = await Client.create(db(), result.data);

	// Return the new client with the secret (only shown once)
	return data({
		errors: null,
		client: {
			id: client.id,
			name: client.name,
			secret: client.secret,
			redirectUri: client.redirectUri,
			logoutUri: client.logoutUri,
		},
	});
}

export default function NewClientPage() {
	let { t } = useTranslation("translation", { keyPrefix: "admin.clients" });
	let actionData = useActionData<typeof action>();
	let navigation = useNavigation();
	let isSubmitting = navigation.state === "submitting";

	// If we just created a client, show the secret
	if (actionData?.client) {
		return (
			<>
				<Alert color="success">
					<Alert.Title>{t("create.success")}</Alert.Title>
					<Alert.Description>{t("create.secretWarning")}</Alert.Description>
				</Alert>

				<Card className="mt-6">
					<Card.Header>
						<Card.Title>{actionData.client.name}</Card.Title>
					</Card.Header>
					<Card.Content className="flex flex-col gap-4">
						<div>
							<Label className="text-sm font-medium">{t("detail.id")}</Label>
							<p className="mt-1 font-mono text-sm">{actionData.client.id}</p>
						</div>
						<div>
							<Label className="text-sm font-medium">{t("detail.secret")}</Label>
							<p className="mt-1 rounded-md bg-neutral-100 p-2 font-mono text-sm dark:bg-neutral-800">
								{actionData.client.secret}
							</p>
						</div>
						<div>
							<Label className="text-sm font-medium">{t("detail.redirectUri")}</Label>
							<p className="mt-1 font-mono text-sm">{actionData.client.redirectUri}</p>
						</div>
						<div>
							<Label className="text-sm font-medium">{t("detail.logoutUri")}</Label>
							<p className="mt-1 font-mono text-sm">{actionData.client.logoutUri}</p>
						</div>
					</Card.Content>
					<Card.Footer>
						<LinkButton href={href("/admin/clients/:clientId", { clientId: actionData.client.id })}>
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
				<Card.Title>{t("create.title")}</Card.Title>
				<Card.Description>{t("create.description")}</Card.Description>
			</Card.Header>

			<Form method="POST">
				<Card.Content className="flex flex-col gap-4">
					<TextField name="name" isRequired>
						<Label>{t("form.name.label")}</Label>
						<Input placeholder={t("form.name.placeholder")} />
					</TextField>

					<TextField name="description">
						<Label>{t("form.description.label")}</Label>
						<TextArea rows={3} maxLength={280} placeholder={t("form.description.placeholder")} />
					</TextField>

					<TextField name="logoUrl">
						<Label>{t("form.logoUrl.label")}</Label>
						<Input type="url" placeholder={t("form.logoUrl.placeholder")} />
					</TextField>

					<TextField name="redirectUri" isRequired>
						<Label>{t("form.redirectUri.label")}</Label>
						<Input type="url" placeholder={t("form.redirectUri.placeholder")} />
					</TextField>

					<TextField name="logoutUri" isRequired>
						<Label>{t("form.logoutUri.label")}</Label>
						<Input type="url" placeholder={t("form.logoutUri.placeholder")} />
					</TextField>

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
					<LinkButton href={href("/admin/clients")} color="neutral" variant="ghost">
						{t("form.cancel")}
					</LinkButton>
				</Card.Footer>
			</Form>
		</Card>
	);
}
