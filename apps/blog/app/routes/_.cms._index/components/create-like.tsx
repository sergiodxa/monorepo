import { Button, FieldError, Form, Heading, Input, Label, TextField } from "@pkg/ui";
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
		<div className="flex flex-col gap-5">
			<Heading className="text-base leading-6 font-semibold text-zinc-900 dark:text-zinc-50">
				{t("title")}
			</Heading>

			<Form
				method="post"
				className="gap-2 rounded-lg bg-white px-4 py-5 shadow sm:p-6 dark:bg-zinc-600"
				reloadDocument
			>
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
		</div>
	);
}
