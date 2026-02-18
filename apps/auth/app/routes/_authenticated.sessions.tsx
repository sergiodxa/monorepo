import { ok } from "@pkg/response";
import { Badge, Button, Card, confirm } from "@pkg/ui";
import { MonitorIcon, SmartphoneIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { href, redirect, useSubmit } from "react-router";

import type { SelectClient } from "~/db/schema";

import { AccountNav } from "~/components/account-nav";
import { db } from "~/middleware/drizzle";
import { session } from "~/middleware/session";
import Session from "~/models/session";
import Subject from "~/models/subject";
import { getSubjectFromAccessToken } from "~/utils/decode-access-token";
import { parseUserAgent } from "~/utils/user-agent";

import type { Route } from "./+types/_authenticated.sessions";

export function meta(): Route.MetaDescriptors {
	return [{ title: "Sessions | Auth" }];
}

export async function loader(_: Route.LoaderArgs) {
	let accessToken = session().get("accessToken");
	let refreshToken = session().get("refreshToken");

	// Auth check is handled by _authenticated layout middleware, but double-check
	if (!accessToken || !refreshToken) {
		return redirect(href("/authorize"), { headers: { "Clear-Site-Data": '"cookies"' } });
	}

	let subjectId = getSubjectFromAccessToken(accessToken);

	let [subject, sessions] = await Promise.all([
		Subject.findById(db(), subjectId),
		Session.findBySubjectId(db(), subjectId),
	]);

	if (!subject)
		return redirect(href("/authorize"), { headers: { "Clear-Site-Data": '"cookies"' } });

	// The refresh token doubles as the session ID
	let currentSessionId = refreshToken;

	return ok({
		subject: {
			id: subject.id,
			displayName: subject.displayName,
			avatar: subject.avatar,
			username: subject.username,
			role: subject.role,
		},
		sessions: sessions.map((s) => ({
			id: s.id,
			ip: s.ip,
			ua: s.ua,
			client: s.client,
			createdAt: s.createdAt.toISOString(),
			updatedAt: s.updatedAt.toISOString(),
			expiresAt: s.expiresAt.toISOString(),
		})),
		currentSessionId,
	});
}

export async function action({ request }: Route.ActionArgs) {
	let accessToken = session().get("accessToken");
	let refreshToken = session().get("refreshToken");

	// Auth check is handled by _authenticated layout middleware, but double-check
	if (!accessToken || !refreshToken) return redirect(href("/authorize"));

	let subjectId = getSubjectFromAccessToken(accessToken);

	// The refresh token doubles as the session ID
	let currentSessionId = refreshToken;
	let formData = await request.formData();
	let intent = formData.get("intent");
	let sessionId = formData.get("sessionId");

	if (intent === "revoke" && typeof sessionId === "string") {
		await Session.deleteById(db(), sessionId);

		// If revoking the current session, log out
		if (sessionId === currentSessionId) {
			session().unset("accessToken");
			session().unset("refreshToken");
			return redirect(href("/authorize"), { headers: { "Clear-Site-Data": '"cookies"' } });
		}

		// Check if user has any remaining sessions, if not log them out
		let remainingSessions = await Session.findBySubjectId(db(), subjectId);
		if (remainingSessions.length === 0) {
			session().unset("accessToken");
			session().unset("refreshToken");
			return redirect(href("/authorize"), { headers: { "Clear-Site-Data": '"cookies"' } });
		}
	}

	if (intent === "revoke-all") {
		let sessions = await Session.findBySubjectId(db(), subjectId);
		await Promise.all(sessions.map((s) => Session.deleteById(db(), s.id)));
		session().unset("accessToken");
		session().unset("refreshToken");
		return redirect(href("/authorize"), { headers: { "Clear-Site-Data": '"cookies"' } });
	}

	return ok({ success: true });
}

export default function Component({ loaderData }: Route.ComponentProps) {
	let { t } = useTranslation();
	let submit = useSubmit();
	let { subject, sessions, currentSessionId } = loaderData;

	async function handleRevokeAll() {
		let confirmed = await confirm(t("sessions.confirm.revokeAll.title"), {
			description: t("sessions.confirm.revokeAll.description"),
			confirmLabel: t("sessions.confirm.revokeAll.confirm"),
			cancelLabel: t("sessions.confirm.cancel"),
			color: "danger",
		});

		if (confirmed) {
			submit({ intent: "revoke-all" }, { method: "POST" });
		}
	}

	return (
		<main className="mx-auto max-w-5xl p-6 md:p-10">
			<AccountNav isAdmin={subject.role === "admin"} />

			<Card>
				<Card.Header>
					<Card.Title>{t("sessions.title")}</Card.Title>
					<Card.Description>{t("sessions.description")}</Card.Description>
				</Card.Header>

				{sessions.length === 0 ? (
					<Card.Content className="py-8 text-center">
						<p className="text-neutral-500">{t("sessions.empty")}</p>
					</Card.Content>
				) : (
					<ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
						{sessions.map((sessionItem) => (
							<SessionItem
								key={sessionItem.id}
								session={sessionItem}
								isCurrent={sessionItem.id === currentSessionId}
							/>
						))}
					</ul>
				)}

				{sessions.length > 1 && (
					<Card.Footer>
						<Button type="button" color="danger" onPress={handleRevokeAll}>
							{t("sessions.actions.revokeAll")}
						</Button>
					</Card.Footer>
				)}
			</Card>
		</main>
	);
}

interface SessionItemProps {
	session: {
		id: string;
		ip: string | null;
		ua: string | null;
		client: SelectClient;
		createdAt: string;
		updatedAt: string;
		expiresAt: string;
	};
	isCurrent: boolean;
}

function SessionItem({ session, isCurrent }: SessionItemProps) {
	let { t } = useTranslation();
	let submit = useSubmit();
	let ua = parseUserAgent(session.ua);
	let updatedAt = new Date(session.updatedAt);
	let isStale = !isCurrent && Date.now() - updatedAt.getTime() > 7 * 24 * 60 * 60 * 1000; // 7 days

	async function handleRevoke() {
		let confirmed = await confirm(t("sessions.confirm.revoke.title"), {
			description: isCurrent
				? t("sessions.confirm.revoke.descriptionCurrent")
				: t("sessions.confirm.revoke.description"),
			confirmLabel: t("sessions.confirm.revoke.confirm"),
			cancelLabel: t("sessions.confirm.cancel"),
			color: "danger",
		});

		if (confirmed) {
			submit({ intent: "revoke", sessionId: session.id }, { method: "POST" });
		}
	}

	let DeviceIcon = ua.deviceType === "mobile" ? SmartphoneIcon : MonitorIcon;

	return (
		<li className="flex items-center gap-4 p-4">
			<DeviceIcon className="size-10 text-neutral-400" />

			<div className="flex flex-1 flex-col gap-1">
				<div className="font-medium">
					{ua.browser} {session.ip && <span className="text-neutral-500">{session.ip}</span>}
				</div>
				<div className="flex items-center gap-2">
					<Badge color={isStale ? "neutral" : "success"}>
						{isStale ? t("sessions.status.stale") : t("sessions.status.active")}
					</Badge>
					{isCurrent && <Badge color="primary">{t("sessions.current")}</Badge>}
				</div>
				<div className="text-sm text-neutral-500">
					{t("sessions.lastAccessed", {
						date: updatedAt.toLocaleDateString(undefined, {
							year: "numeric",
							month: "short",
							day: "2-digit",
						}),
					})}
				</div>
				<div className="text-sm text-neutral-400">{session.client.name}</div>
			</div>

			<Button type="button" color="danger" variant="outline" onPress={handleRevoke}>
				{t("sessions.actions.revoke")}
			</Button>
		</li>
	);
}
