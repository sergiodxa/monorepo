import { ok } from "@pkg/response";
import { Badge, Button, Card, Form, Heading, Separator, Text } from "@pkg/ui";
import { useTranslation } from "react-i18next";
import { href, redirect } from "react-router";

import type { SelectClient } from "~/db/schema";

import { db } from "~/middleware/drizzle";
import { session } from "~/middleware/session";
import Session from "~/models/session";
import Subject from "~/models/subject";
import { getSubjectFromAccessToken } from "~/utils/decode-access-token";
import { parseUserAgent } from "~/utils/user-agent";

import type { Route } from "./+types/_authenticated.sessions";

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
	let { subject: _subject, sessions, currentSessionId } = loaderData;

	return (
		<main className="mx-auto max-w-3xl p-6 md:p-10">
			<header className="mb-8">
				<Heading level={1} className="text-2xl font-semibold">
					{t("sessions.title")}
				</Heading>
				<Separator className="my-4" />
				<Text slot="description" className="text-neutral-600 dark:text-neutral-400">
					{t("sessions.description")}
				</Text>
			</header>

			{sessions.length === 0 ? (
				<Card>
					<Card.Content className="py-8 text-center">
						<Text className="text-neutral-500">{t("sessions.empty")}</Text>
					</Card.Content>
				</Card>
			) : (
				<Card>
					<ul className="divide-y divide-neutral-200 dark:divide-neutral-700">
						{sessions.map((sessionItem) => (
							<SessionItem
								key={sessionItem.id}
								session={sessionItem}
								isCurrent={sessionItem.id === currentSessionId}
							/>
						))}
					</ul>
				</Card>
			)}

			<footer className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				{sessions.length > 1 && (
					<Form method="POST">
						<input type="hidden" name="intent" value="revoke-all" />
						<Button type="submit" color="danger">
							{t("sessions.actions.revokeAll")}
						</Button>
					</Form>
				)}

				<Form method="POST" action={href("/oidc/logout")}>
					<Button type="submit" color="neutral">
						{t("sessions.actions.logout")}
					</Button>
				</Form>
			</footer>
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
	let ua = parseUserAgent(session.ua);
	let updatedAt = new Date(session.updatedAt);
	let isStale = !isCurrent && Date.now() - updatedAt.getTime() > 7 * 24 * 60 * 60 * 1000; // 7 days

	return (
		<li className="flex items-center gap-4 p-4">
			<DeviceIcon deviceType={ua.deviceType} className="size-10 text-neutral-400" />

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

			<Form method="POST">
				<input type="hidden" name="intent" value="revoke" />
				<input type="hidden" name="sessionId" value={session.id} />
				<Button type="submit" color="neutral">
					{t("sessions.actions.revoke")}
				</Button>
			</Form>
		</li>
	);
}

function DeviceIcon({ deviceType, className }: { deviceType: string; className?: string }) {
	if (deviceType === "mobile") {
		return (
			<svg
				className={className}
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				strokeWidth={1.5}
			>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"
				/>
			</svg>
		);
	}

	return (
		<svg
			className={className}
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			strokeWidth={1.5}
		>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25z"
			/>
		</svg>
	);
}
