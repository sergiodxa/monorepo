import { ok } from "@pkg/response";
import { isFailure } from "@pkg/result";
import { Alert, Button, Card, Form, Input, Label, LinkButton, TextField } from "@pkg/ui";
import { validate } from "@pkg/validate";
import { useTranslation } from "react-i18next";
import { data, href, redirect, useActionData, useNavigation } from "react-router";
import { z } from "zod";

import { AccountNav } from "~/components/account-nav";
import { getSubjectFromAccessToken } from "~/helpers/decode-token";
import { db } from "~/middleware/drizzle";
import { session } from "~/middleware/session";
import Subject from "~/models/subject";

import type { Route } from "./+types/_authenticated.profile_.edit";

export function meta(): Route.MetaDescriptors {
	return [{ title: "Edit Profile | Auth" }];
}

let UpdateProfileSchema = z.object({
	displayName: z.string().min(1),
	username: z.string().min(1),
	avatar: z.string().url(),
});

export async function loader(_: Route.LoaderArgs) {
	let accessToken = session().get("accessToken");

	if (!accessToken) {
		return redirect(href("/authorize"));
	}

	let subjectId = getSubjectFromAccessToken(accessToken);
	let subject = await Subject.findById(db(), subjectId);

	if (!subject) {
		return redirect(href("/authorize"));
	}

	return ok({
		subject: {
			id: subject.id,
			displayName: subject.displayName,
			username: subject.username,
			avatar: subject.avatar,
			role: subject.role,
		},
	});
}

export async function action({ request }: Route.ActionArgs) {
	let accessToken = session().get("accessToken");

	if (!accessToken) {
		return redirect(href("/authorize"));
	}

	let subjectId = getSubjectFromAccessToken(accessToken);
	let result = await validate(request, UpdateProfileSchema);

	if (isFailure(result)) {
		return data({ errors: result.error }, { status: 400 });
	}

	await Subject.update(db(), subjectId, result.data);

	return redirect(href("/profile"));
}

export default function EditProfilePage({ loaderData }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "profile.edit" });
	let { subject } = loaderData;
	let actionData = useActionData<typeof action>();
	let navigation = useNavigation();
	let isSubmitting = navigation.state === "submitting";

	return (
		<main className="mx-auto max-w-5xl p-6 md:p-10">
			<AccountNav isAdmin={subject.role === "admin"} />

			<Card>
				<Card.Header>
					<Card.Title>{t("title")}</Card.Title>
					<Card.Description>{t("description")}</Card.Description>
				</Card.Header>

				<Form method="POST">
					<Card.Content className="flex flex-col gap-4">
						<TextField name="displayName" isRequired defaultValue={subject.displayName}>
							<Label>{t("form.displayName.label")}</Label>
							<Input placeholder={t("form.displayName.placeholder")} />
						</TextField>

						<TextField name="username" isRequired defaultValue={subject.username}>
							<Label>{t("form.username.label")}</Label>
							<Input placeholder={t("form.username.placeholder")} />
						</TextField>

						<TextField name="avatar" isRequired defaultValue={subject.avatar}>
							<Label>{t("form.avatar.label")}</Label>
							<Input type="url" placeholder={t("form.avatar.placeholder")} />
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
						<LinkButton href={href("/profile")} color="neutral" variant="ghost">
							{t("form.cancel")}
						</LinkButton>
					</Card.Footer>
				</Form>
			</Card>
		</main>
	);
}
