/**
 * Dashboard card component for quickly saving a bookmark. It renders a URL form that
 * posts the create-like intent, reloading the document on submit and displaying any
 * validation error returned for the URL field. Exists to let admins add a new "like"
 * from the dashboard without leaving the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Button, Card, FieldError, Form, Input, Label, TextField } from "@pkg/ui";
import { useTranslation } from "react-i18next";

import type { Route } from "../+types/route";

import { INTENT } from "../types";

interface CreateLikeProps {
	actionData: Route.ComponentProps["actionData"];
}

export function CreateLike({ actionData }: CreateLikeProps) {
	let { t } = useTranslation("translation", {
		keyPrefix: "cms._index.quickAction.like",
	});

	let errors =
		actionData?.ok === false && "url" in actionData.errors ? actionData.errors : undefined;

	return (
		<Card>
			<Card.Header>
				<Card.Title>{t("title")}</Card.Title>
			</Card.Header>
			<Card.Content>
				<Form method="post" className="flex flex-col gap-4" reloadDocument>
					<input type="hidden" name="intent" value={INTENT.createLike} />

					<TextField name="url" type="url" isRequired>
						<Label>{t("label")}</Label>
						<Input />
						{errors?.url && <FieldError>{errors.url}</FieldError>}
					</TextField>

					<Button type="submit" color="primary">
						{t("cta")}
					</Button>
				</Form>
			</Card.Content>
		</Card>
	);
}
