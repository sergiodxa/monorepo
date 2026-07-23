/**
 * The admin edit-subject route (/admin/subjects/:subjectId/edit). Its loader loads the
 * target subject (404 if missing); the action validates and persists changes to display
 * name, username, avatar, role and email-verified state before redirecting to the
 * subject detail page, and the component renders the edit form. Exists to let admins
 * modify any user's account.
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
	ListBox,
	Popover,
	Select,
	TextField,
} from "@pkg/ui";
import { validate } from "@pkg/validate";
import { useTranslation } from "react-i18next";
import { data, href, redirect, useActionData, useNavigation } from "react-router";
import { z } from "zod";

import { db } from "~/middleware/drizzle";
import Subject from "~/models/subject";

import type { Route } from "./+types/route";

export function meta({ loaderData }: Route.MetaArgs) {
	let title = loaderData?.subject?.displayName ?? "User";
	return [{ title: `Edit ${title} | Auth` }];
}

let UpdateSubjectSchema = z.object({
	displayName: z.string().min(1),
	username: z.string().min(1),
	role: z.enum(["user", "admin"]),
	avatar: z.string().url(),
	emailVerified: z
		.string()
		.optional()
		.transform((v) => v === "on"),
});

export async function loader({ params }: Route.LoaderArgs) {
	let subject = await Subject.findById(db(), params.subjectId);

	if (!subject) {
		throw new Response("User not found", { status: 404 });
	}

	return ok({
		subject: {
			id: subject.id,
			displayName: subject.displayName,
			username: subject.username,
			emailAddress: subject.emailAddress,
			avatar: subject.avatar,
			role: subject.role,
			emailVerifiedAt: subject.emailVerifiedAt?.toISOString() ?? null,
		},
	});
}

export async function action({ params, request }: Route.ActionArgs) {
	let result = await validate(request, UpdateSubjectSchema);

	if (isFailure(result)) {
		return data({ errors: result.error }, { status: 400 });
	}

	let { emailVerified, ...updateData } = result.data;

	await Subject.update(db(), params.subjectId, {
		...updateData,
		emailVerifiedAt: emailVerified ? new Date() : null,
	});

	return redirect(href("/admin/subjects/:subjectId", { subjectId: params.subjectId }));
}

export default function EditSubjectPage({ loaderData }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "admin.subjects" });
	let { subject } = loaderData;
	let actionData = useActionData<typeof action>();
	let navigation = useNavigation();
	let isSubmitting = navigation.state === "submitting";

	return (
		<Card>
			<Card.Header>
				<Card.Title>{t("edit.title")}</Card.Title>
				<Card.Description>{t("edit.description")}</Card.Description>
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

					<Select name="role" defaultSelectedKey={subject.role}>
						<Label>{t("form.role.label")}</Label>
						<Select.Trigger />
						<Popover>
							<ListBox>
								<Select.Item id="user">{t("roles.user")}</Select.Item>
								<Select.Item id="admin">{t("roles.admin")}</Select.Item>
							</ListBox>
						</Popover>
					</Select>

					{/* Email is read-only */}
					<TextField isReadOnly defaultValue={subject.emailAddress}>
						<Label>{t("form.email.label")}</Label>
						<Input />
					</TextField>

					<Checkbox name="emailVerified" defaultSelected={Boolean(subject.emailVerifiedAt)}>
						<Label>{t("form.emailVerified.label")}</Label>
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
						href={href("/admin/subjects/:subjectId", { subjectId: subject.id })}
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
