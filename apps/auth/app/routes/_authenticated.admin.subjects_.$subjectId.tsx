import { ok } from "@pkg/response";
import { Avatar, Badge, Button, Card, confirm, Form, Label, LinkButton } from "@pkg/ui";
import { MonitorIcon, SmartphoneIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { data, href, redirect, useNavigation, useSubmit } from "react-router";

import type { SelectClient } from "~/db/schema";

import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";
import Session from "~/models/session";
import Subject from "~/models/subject";
import { parseUserAgent } from "~/utils/user-agent";

import type { Route } from "./+types/_authenticated.admin.subjects_.$subjectId";

export async function loader({ params }: Route.LoaderArgs) {
	let subject = await Subject.findById(db(), params.subjectId);

	if (!subject) {
		logger.info("admin.subject.not_found", { subjectId: params.subjectId });
		throw new Response("User not found", { status: 404 });
	}

	let sessions = await Session.findBySubjectId(db(), params.subjectId);

	logger.info("admin.subject.viewed", {
		subjectId: subject.id,
		sessionsCount: sessions.length,
	});

	return ok({
		subject: {
			id: subject.id,
			displayName: subject.displayName,
			username: subject.username,
			emailAddress: subject.emailAddress,
			avatar: subject.avatar,
			role: subject.role,
			emailVerifiedAt: subject.emailVerifiedAt?.toISOString() ?? null,
			createdAt: subject.createdAt.toISOString(),
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
	});
}

export async function action({ params, request }: Route.ActionArgs) {
	let formData = await request.formData();
	let intent = formData.get("intent");

	if (intent === "delete") {
		// Delete all sessions first
		await Session.deleteBySubjectId(db(), params.subjectId);
		// Then delete the subject
		await Subject.delete(db(), params.subjectId);
		logger.info("admin.subject.deleted", { subjectId: params.subjectId });
		return redirect(href("/admin/subjects"));
	}

	if (intent === "revoke-session") {
		let sessionId = formData.get("sessionId");
		if (typeof sessionId === "string") {
			await Session.deleteById(db(), sessionId);
			logger.info("admin.subject.session_revoked", {
				subjectId: params.subjectId,
				sessionId,
			});
		}
		return ok({ success: true });
	}

	if (intent === "revoke-all-sessions") {
		await Session.deleteBySubjectId(db(), params.subjectId);
		logger.info("admin.subject.all_sessions_revoked", { subjectId: params.subjectId });
		return ok({ success: true });
	}

	logger.error("admin.subject.invalid_intent", { intent: String(intent) });
	return data({ error: "Invalid intent" }, { status: 400 });
}

export default function SubjectDetailPage({ loaderData }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "admin.subjects" });
	let { subject, sessions } = loaderData;
	let navigation = useNavigation();
	let submit = useSubmit();
	let isDeleting = navigation.state === "submitting";

	async function handleDelete(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		let confirmed = await confirm(t("delete.title"), {
			description: t("delete.confirm"),
			confirmLabel: t("actions.delete"),
			color: "danger",
		});

		if (confirmed) {
			(e.target as HTMLFormElement).submit();
		}
	}

	async function handleRevokeAllSessions() {
		let confirmed = await confirm(t("sessions.confirm.revokeAll.title"), {
			description: t("sessions.confirm.revokeAll.description"),
			confirmLabel: t("sessions.confirm.revokeAll.confirm"),
			cancelLabel: t("sessions.confirm.cancel"),
			color: "danger",
		});

		if (confirmed) {
			submit({ intent: "revoke-all-sessions" }, { method: "POST" });
		}
	}

	return (
		<div className="flex flex-col gap-6">
			<Card>
				<Card.Header>
					<div className="flex items-center gap-4">
						<Avatar className="size-16">
							<Avatar.Image src={subject.avatar} alt={subject.displayName} />
							<Avatar.Fallback>{subject.displayName.slice(0, 2).toUpperCase()}</Avatar.Fallback>
						</Avatar>
						<div>
							<Card.Title>{subject.displayName}</Card.Title>
							<p className="text-sm text-neutral-500">@{subject.username}</p>
						</div>
					</div>
				</Card.Header>

				<Card.Content className="grid gap-4 sm:grid-cols-2">
					<div className="sm:col-span-2">
						<Label className="text-sm font-medium">{t("detail.id")}</Label>
						<p className="mt-1 font-mono text-sm">{subject.id}</p>
					</div>
					<div>
						<Label className="text-sm font-medium">{t("detail.email")}</Label>
						<p className="mt-1">{subject.emailAddress}</p>
					</div>
					<div>
						<Label className="text-sm font-medium">{t("detail.role")}</Label>
						<div className="mt-1">
							<Badge color={subject.role === "admin" ? "primary" : "neutral"}>
								{t(`roles.${subject.role}`)}
							</Badge>
						</div>
					</div>
					<div>
						<Label className="text-sm font-medium">{t("detail.emailVerifiedAt")}</Label>
						<p className="mt-1 text-sm">
							{subject.emailVerifiedAt
								? new Date(subject.emailVerifiedAt).toLocaleDateString(undefined, {
										year: "numeric",
										month: "long",
										day: "numeric",
									})
								: t("detail.notVerified")}
						</p>
					</div>
					<div>
						<Label className="text-sm font-medium">{t("detail.createdAt")}</Label>
						<p className="mt-1 text-sm">
							{new Date(subject.createdAt).toLocaleDateString(undefined, {
								year: "numeric",
								month: "long",
								day: "numeric",
								hour: "2-digit",
								minute: "2-digit",
							})}
						</p>
					</div>
				</Card.Content>

				<Card.Footer className="flex gap-2">
					<LinkButton href={href("/admin/subjects/:subjectId/edit", { subjectId: subject.id })}>
						{t("actions.edit")}
					</LinkButton>
					<Form method="POST" onSubmit={handleDelete}>
						<input type="hidden" name="intent" value="delete" />
						<Button type="submit" color="danger" isPending={isDeleting}>
							{t("actions.delete")}
						</Button>
					</Form>
				</Card.Footer>
			</Card>

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
						{sessions.map((session) => (
							<SessionItem key={session.id} session={session} />
						))}
					</ul>
				)}

				{sessions.length > 1 && (
					<Card.Footer>
						<Button type="button" color="danger" onPress={handleRevokeAllSessions}>
							{t("sessions.actions.revokeAll")}
						</Button>
					</Card.Footer>
				)}
			</Card>
		</div>
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
}

function SessionItem({ session }: SessionItemProps) {
	let { t } = useTranslation("translation", { keyPrefix: "admin.subjects" });
	let submit = useSubmit();
	let ua = parseUserAgent(session.ua);
	let updatedAt = new Date(session.updatedAt);
	let isStale = Date.now() - updatedAt.getTime() > 7 * 24 * 60 * 60 * 1000; // 7 days

	async function handleRevoke() {
		let confirmed = await confirm(t("sessions.confirm.revoke.title"), {
			description: t("sessions.confirm.revoke.description"),
			confirmLabel: t("sessions.confirm.revoke.confirm"),
			cancelLabel: t("sessions.confirm.cancel"),
			color: "danger",
		});

		if (confirmed) {
			submit({ intent: "revoke-session", sessionId: session.id }, { method: "POST" });
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
