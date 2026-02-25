import { ok } from "@pkg/response";
import { Avatar, Card, Label, LinkButton } from "@pkg/ui";
import { useTranslation } from "react-i18next";
import { href, redirect } from "react-router";

import { AccountNav } from "~/components/account-nav";
import { getSubjectFromAccessToken } from "~/helpers/decode-token";
import { db } from "~/middleware/drizzle";
import { session } from "~/middleware/session";
import Subject from "~/models/subject";

import type { Route } from "./+types/_authenticated.profile";

export function meta(): Route.MetaDescriptors {
	return [{ title: "Profile | Auth" }];
}

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
			emailAddress: subject.emailAddress,
			avatar: subject.avatar,
			role: subject.role,
		},
	});
}

export default function ProfilePage({ loaderData }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "profile" });
	let { subject } = loaderData;

	return (
		<main className="mx-auto max-w-5xl p-6 md:p-10">
			<AccountNav isAdmin={subject.role === "admin"} />

			<Card>
				<Card.Header>
					<Card.Title>{t("view.title")}</Card.Title>
				</Card.Header>
				<Card.Content className="flex flex-col gap-4">
					<div className="flex items-center gap-4">
						<Avatar className="size-20">
							<Avatar.Image src={subject.avatar} alt={subject.displayName} />
							<Avatar.Fallback>{subject.displayName.slice(0, 2).toUpperCase()}</Avatar.Fallback>
						</Avatar>
						<div>
							<h2 className="text-xl font-semibold">{subject.displayName}</h2>
							<p className="text-neutral-500">@{subject.username}</p>
						</div>
					</div>

					<div>
						<Label className="text-sm font-medium">{t("view.displayName")}</Label>
						<p className="mt-1">{subject.displayName}</p>
					</div>
					<div>
						<Label className="text-sm font-medium">{t("view.username")}</Label>
						<p className="mt-1">@{subject.username}</p>
					</div>
					<div>
						<Label className="text-sm font-medium">{t("view.email")}</Label>
						<p className="mt-1">{subject.emailAddress}</p>
					</div>
				</Card.Content>

				<Card.Footer>
					<LinkButton href={href("/profile/edit")}>{t("view.actions.edit")}</LinkButton>
				</Card.Footer>
			</Card>
		</main>
	);
}
