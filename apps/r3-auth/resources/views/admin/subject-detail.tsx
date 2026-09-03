/**
 * One account, with everything that can sign in as it: the profile, the live sessions
 * (each revocable, plus a revoke-all), and the linked provider identities. Revoking a
 * session invalidates the refresh token it is named by, so each control names one
 * session by an opaque id that is never rendered as text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { flex, flexCol, flexWrap, gap, grid, gridTemplate, items } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { m, mis, p } from "@sdxc/u/size";
import { font, overflowWrap, weight } from "@sdxc/u/typography";
import { Avatar, Badge, Card, Label, LinkButton, Text } from "@sdxc/ui";
import { css } from "remix/ui";

import type { AdminView } from "~/app/http/view-models/admin";

import AdminLayout from "~/resources/layouts/admin";
import ConfirmAction from "~/resources/views/admin/confirm-action";

namespace SubjectDetailView {
	export interface Labels {
		detail: {
			id: string;
			email: string;
			role: string;
			emailVerifiedAt: string;
			notVerified: string;
			createdAt: string;
		};
		roles: { user: string; admin: string };
		edit: string;
		delete: string;
		deleteConfirm: { title: string; description: string; confirm: string; cancel: string };
		sessions: {
			title: string;
			description: string;
			empty: string;
			lastAccessed: string;
			expires: string;
			active: string;
			stale: string;
			revoke: string;
			revokeAll: string;
			revokeConfirm: { title: string; description: string; confirm: string; cancel: string };
			revokeAllConfirm: { title: string; description: string; confirm: string; cancel: string };
		};
		connections: {
			title: string;
			description: string;
			empty: string;
			externalId: string;
			linkedAt: string;
		};
	}

	export interface Props {
		chrome: AdminView.Chrome;
		labels: Labels;
		subject: AdminView.SubjectDetail;
		sessions: AdminView.SessionRow[];
		connections: AdminView.ConnectionRow[];
		editHref: string;
	}
}

/** One labelled read-only value in the profile grid. */
function Field(handle: Handle<{ label: string; value: string; mono?: boolean }>) {
	return () => (
		<div mix={[flex(), flexCol(), gap(1)]}>
			<Label>{handle.props.label}</Label>
			<Text mix={[handle.props.mono ? font("mono") : undefined, overflowWrap("anywhere")]}>
				{handle.props.value}
			</Text>
		</div>
	);
}

/** Renders a subject's profile, sessions and provider links with their actions. */
export default function SubjectDetailView(handle: Handle<SubjectDetailView.Props>) {
	return () => {
		let { chrome, labels, subject, sessions, connections, editHref } = handle.props;
		let roleLabel = subject.role === "admin" ? labels.roles.admin : labels.roles.user;

		return (
			<AdminLayout chrome={chrome}>
				<div mix={[flex(), flexCol(), gap(6)]}>
					<Card>
						<Card.Header>
							<div mix={[flex(), items("center"), gap(4)]}>
								<Avatar size="lg">
									<Avatar.Image src={subject.avatar} alt={subject.displayName} />
									<Avatar.Fallback>{subject.initials}</Avatar.Fallback>
								</Avatar>
								<div>
									<Card.Title mix={[m(0)]}>{subject.displayName}</Card.Title>
									<Text>{`@${subject.username}`}</Text>
								</div>
							</div>
						</Card.Header>

						<Card.Content
							mix={[
								grid(),
								gap(4),
								at("sm", gridTemplate({ columns: "repeat(2, minmax(0, 1fr))" })),
							]}
						>
							<Field label={labels.detail.id} value={subject.id} mono />
							<Field label={labels.detail.email} value={subject.emailAddress} />

							<div mix={[flex(), flexCol(), gap(1)]}>
								<Label>{labels.detail.role}</Label>
								<div>
									<Badge color={subject.role === "admin" ? "brand" : "neutral"}>{roleLabel}</Badge>
								</div>
							</div>

							<Field
								label={labels.detail.emailVerifiedAt}
								value={subject.emailVerifiedAt ?? labels.detail.notVerified}
							/>

							<Field label={labels.detail.createdAt} value={subject.createdAt} />
						</Card.Content>

						<Card.Footer mix={[flex(), gap(2)]}>
							<LinkButton href={editHref}>{labels.edit}</LinkButton>
							<ConfirmAction
								id={`delete-subject-${subject.id}`}
								trigger={labels.delete}
								title={labels.deleteConfirm.title}
								description={labels.deleteConfirm.description}
								confirmLabel={labels.deleteConfirm.confirm}
								cancelLabel={labels.deleteConfirm.cancel}
								fields={{ intent: "delete" }}
							/>
						</Card.Footer>
					</Card>

					<Card>
						<Card.Header>
							<Card.Title>{labels.sessions.title}</Card.Title>
							<Card.Description>{labels.sessions.description}</Card.Description>
						</Card.Header>

						{sessions.length === 0 ? (
							<Card.Content>
								<Text>{labels.sessions.empty}</Text>
							</Card.Content>
						) : (
							<Card.Content mix={[flex(), flexCol(), gap(4)]}>
								{sessions.map((session, index) => (
									<div
										key={session.id}
										mix={[flex(), flexWrap("wrap"), items("center"), gap(3), p(3, 0)]}
									>
										<div mix={[flex(), flexCol(), gap(1), css({ flex: "1 1 12rem" })]}>
											<Text mix={[weight("medium")]}>{session.device}</Text>
											{session.ip && <Text mix={[font("mono")]}>{session.ip}</Text>}
											{session.clientName && <Text>{session.clientName}</Text>}
											<Text>{`${labels.sessions.lastAccessed} ${session.lastUsedAt}`}</Text>
											<Text>{`${labels.sessions.expires} ${session.expiresAt}`}</Text>
										</div>

										<Badge color={session.stale ? "neutral" : "success"}>
											{session.stale ? labels.sessions.stale : labels.sessions.active}
										</Badge>

										<div mix={[mis("auto")]}>
											<ConfirmAction
												id={`revoke-session-${index}`}
												size="sm"
												trigger={labels.sessions.revoke}
												title={labels.sessions.revokeConfirm.title}
												description={labels.sessions.revokeConfirm.description}
												confirmLabel={labels.sessions.revokeConfirm.confirm}
												cancelLabel={labels.sessions.revokeConfirm.cancel}
												fields={{ intent: "revoke-session", sessionId: session.id }}
											/>
										</div>
									</div>
								))}
							</Card.Content>
						)}

						{sessions.length > 1 && (
							<Card.Footer>
								<ConfirmAction
									id={`revoke-all-sessions-${subject.id}`}
									trigger={labels.sessions.revokeAll}
									title={labels.sessions.revokeAllConfirm.title}
									description={labels.sessions.revokeAllConfirm.description}
									confirmLabel={labels.sessions.revokeAllConfirm.confirm}
									cancelLabel={labels.sessions.revokeAllConfirm.cancel}
									fields={{ intent: "revoke-all-sessions" }}
								/>
							</Card.Footer>
						)}
					</Card>

					<Card>
						<Card.Header>
							<Card.Title>{labels.connections.title}</Card.Title>
							<Card.Description>{labels.connections.description}</Card.Description>
						</Card.Header>

						{connections.length === 0 ? (
							<Card.Content>
								<Text>{labels.connections.empty}</Text>
							</Card.Content>
						) : (
							<Card.Content mix={[flex(), flexCol(), gap(4)]}>
								{connections.map((connection) => (
									<div key={connection.id} mix={[flex(), flexCol(), gap(1)]}>
										<Text mix={[weight("medium")]}>{connection.provider}</Text>
										<Text mix={[font("mono")]}>
											{`${labels.connections.externalId} ${connection.externalId}`}
										</Text>
										<Text>{`${labels.connections.linkedAt} ${connection.createdAt}`}</Text>
									</div>
								))}
							</Card.Content>
						)}
					</Card>
				</div>
			</AdminLayout>
		);
	};
}
