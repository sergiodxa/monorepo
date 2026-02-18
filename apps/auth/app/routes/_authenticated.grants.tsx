import { ok } from "@pkg/response";
import { Button, Card, confirm, Logo, Text } from "@pkg/ui";
import { useTranslation } from "react-i18next";
import { href, redirect, useSubmit } from "react-router";

import type { SelectClient } from "~/db/schema";

import { AccountNav } from "~/components/account-nav";
import { AUTH_SERVER_CLIENT_ID } from "~/config";
import { db } from "~/middleware/drizzle";
import { session } from "~/middleware/session";
import Grant from "~/models/grant";
import Session from "~/models/session";
import Subject from "~/models/subject";
import { getSubjectFromAccessToken } from "~/utils/decode-access-token";

import type { Route } from "./+types/_authenticated.grants";

export function meta(): Route.MetaDescriptors {
	return [{ title: "Authorized Apps | Auth" }];
}

export async function loader(_: Route.LoaderArgs) {
	let accessToken = session().get("accessToken");
	let refreshToken = session().get("refreshToken");

	if (!accessToken || !refreshToken) {
		return redirect(href("/authorize"), { headers: { "Clear-Site-Data": '"cookies"' } });
	}

	let subjectId = getSubjectFromAccessToken(accessToken);

	let [subject, grants] = await Promise.all([
		Subject.findById(db(), subjectId),
		Grant.findBySubjectId(db(), subjectId),
	]);

	if (!subject) {
		return redirect(href("/authorize"), { headers: { "Clear-Site-Data": '"cookies"' } });
	}

	return ok({
		subject: {
			id: subject.id,
			displayName: subject.displayName,
			avatar: subject.avatar,
			username: subject.username,
			role: subject.role,
		},
		grants: grants.map((g) => ({
			id: g.id,
			clientId: g.clientId,
			client: {
				id: g.client.id,
				name: g.client.name,
				description: g.client.description,
				logoUrl: g.client.logoUrl,
			},
			createdAt: g.createdAt.toISOString(),
		})),
		authServerClientId: AUTH_SERVER_CLIENT_ID,
	});
}

export async function action({ request }: Route.ActionArgs) {
	let accessToken = session().get("accessToken");
	let refreshToken = session().get("refreshToken");

	if (!accessToken || !refreshToken) {
		return redirect(href("/authorize"));
	}

	let subjectId = getSubjectFromAccessToken(accessToken);

	let formData = await request.formData();
	let intent = formData.get("intent");
	let clientId = formData.get("clientId");

	if (intent === "revoke" && typeof clientId === "string") {
		// Don't allow revoking the auth server itself
		if (clientId === AUTH_SERVER_CLIENT_ID) {
			return ok({ success: false, error: "Cannot revoke auth server" });
		}

		// Delete the grant
		await Grant.deleteBySubjectAndClient(db(), subjectId, clientId);

		// Delete all sessions for this client (logs user out of that app)
		await Session.deleteBySubjectAndClient(db(), subjectId, clientId);
	}

	return ok({ success: true });
}

export default function Component({ loaderData }: Route.ComponentProps) {
	let { t } = useTranslation();
	let { subject, grants, authServerClientId } = loaderData;

	return (
		<main className="mx-auto max-w-5xl p-6 md:p-10">
			<AccountNav isAdmin={subject.role === "admin"} />

			<Card>
				<Card.Header>
					<Card.Title>{t("grants.title")}</Card.Title>
					<Card.Description>{t("grants.description")}</Card.Description>
				</Card.Header>

				{grants.length === 0 ? (
					<Card.Content className="py-8 text-center">
						<p className="text-neutral-500">{t("grants.empty")}</p>
					</Card.Content>
				) : (
					<ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
						{grants.map((grant) => (
							<GrantItem
								key={grant.id}
								grant={grant}
								isAuthServer={grant.clientId === authServerClientId}
							/>
						))}
					</ul>
				)}
			</Card>
		</main>
	);
}

interface GrantItemProps {
	grant: {
		id: string;
		clientId: string;
		client: Pick<SelectClient, "id" | "name" | "description" | "logoUrl">;
		createdAt: string;
	};
	isAuthServer: boolean;
}

function GrantItem({ grant, isAuthServer }: GrantItemProps) {
	let { t } = useTranslation();
	let submit = useSubmit();

	async function handleRevoke() {
		let confirmed = await confirm(t("grants.confirm.revoke.title"), {
			description: t("grants.confirm.revoke.description", { client: grant.client.name }),
			confirmLabel: t("grants.confirm.revoke.confirm"),
			cancelLabel: t("grants.confirm.cancel"),
			color: "danger",
		});

		if (confirmed) {
			submit({ intent: "revoke", clientId: grant.clientId }, { method: "POST" });
		}
	}

	return (
		<li className="flex items-center gap-4 p-4">
			<Logo size="lg">
				{grant.client.logoUrl ? (
					<Logo.Image src={grant.client.logoUrl} alt={grant.client.name} />
				) : (
					<Logo.Fallback className="bg-neutral-200 dark:bg-neutral-700">
						{grant.client.name.charAt(0).toUpperCase()}
					</Logo.Fallback>
				)}
			</Logo>

			<div className="flex flex-1 flex-col gap-1">
				<div className="font-medium">{grant.client.name}</div>
				{grant.client.description && (
					<Text className="text-sm text-neutral-500">{grant.client.description}</Text>
				)}
				<div className="text-sm text-neutral-400">
					{t("grants.authorizedOn", {
						date: new Date(grant.createdAt).toLocaleDateString(undefined, {
							year: "numeric",
							month: "short",
							day: "numeric",
						}),
					})}
				</div>
			</div>

			{isAuthServer ? (
				<Text className="text-sm text-neutral-400">{t("grants.cannotRevoke")}</Text>
			) : (
				<Button type="button" color="danger" variant="outline" onPress={handleRevoke}>
					{t("grants.actions.revoke")}
				</Button>
			)}
		</li>
	);
}
