/**
 * The active-sessions page: one table row per device holding a live refresh token, with
 * the session the page is being read on marked, and a revoke control per row plus one
 * for every other session at once.
 *
 * Each destructive control opens a native `<dialog>` through an invoker command, and the
 * dialog holds the real form that posts the intent — so the confirmation is the browser's
 * own modal and the action still works with no script on the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { fg } from "@pkg/u/color";
import { flex, flexCol, gap, justify } from "@pkg/u/layout";
import { nowrap, text } from "@pkg/u/typography";
import { AlertDialog, Badge, Button, Card, Empty, Form, Table, Text } from "@pkg/ui";

import type { SessionRow } from "~/app/http/view-models/account-session";

import routes from "~/routes/web";

/** `id` of the dialog confirming that every other session is revoked. */
const REVOKE_ALL_DIALOG_ID = "revoke-all-sessions";

/**
 * Prefix for each row's confirmation dialog id, completed with the row's position.
 *
 * The position rather than the session id: the id is the refresh token, and it has no
 * business being in an attribute that any stylesheet or extension on the page can
 * select on. The hidden input the form posts is the only place it appears.
 */
const REVOKE_DIALOG_ID_PREFIX = "revoke-session-";

namespace SessionsView {
	/** Copy for one confirmation dialog. */
	export interface Confirmation {
		title: string;
		description: string;
		confirm: string;
		cancel: string;
	}

	export interface Props {
		/** Card heading. */
		title: string;
		/** Sentence under the heading. */
		description: string;
		/** What the page says when there is no session at all to list. */
		empty: string;
		/** Column headers, in the order the table renders them. */
		columns: {
			device: string;
			ip: string;
			client: string;
			status: string;
			lastAccessed: string;
			expires: string;
			actions: string;
		};
		/** Row labels: the badges, the device names, and the two action captions. */
		labels: {
			current: string;
			active: string;
			stale: string;
			device: Record<SessionRow["deviceType"], string>;
			revoke: string;
			revokeAll: string;
			/** Accessible name for the table itself. */
			tableLabel: string;
		};
		/** Confirmation copy for revoking one session, one that is the current one, and all. */
		confirmations: {
			revoke: Confirmation;
			revokeCurrent: Confirmation;
			revokeAll: Confirmation;
		};
		/** The sessions to list, most recently used first. */
		sessions: SessionRow[];
	}
}

/**
 * The confirmation dialog for one destructive submission.
 *
 * The confirming control is a real submit button inside a real form, rather than the
 * component library's `Confirm`, whose action button carries `command="close"` and so
 * dismisses the dialog without submitting anything.
 */
function RevokeDialog(
	handle: Handle<{
		id: string;
		copy: SessionsView.Confirmation;
		intent: "revoke" | "revoke-all";
		sessionId?: string;
	}>,
) {
	return () => {
		let { id, copy, intent, sessionId } = handle.props;

		return (
			<AlertDialog id={id} aria-labelledby={`${id}-title`}>
				<AlertDialog.Header>
					<AlertDialog.Title id={`${id}-title`}>{copy.title}</AlertDialog.Title>
					<AlertDialog.Description>{copy.description}</AlertDialog.Description>
				</AlertDialog.Header>

				<AlertDialog.Footer>
					<AlertDialog.Cancel commandfor={id}>{copy.cancel}</AlertDialog.Cancel>

					<Form method="post" action={routes.account.sessions.action.href()}>
						<input type="hidden" name="intent" value={intent} />
						{sessionId && <input type="hidden" name="sessionId" value={sessionId} />}
						<Button type="submit" color="danger">
							{copy.confirm}
						</Button>
					</Form>
				</AlertDialog.Footer>
			</AlertDialog>
		);
	};
}

/** Renders the signed-in subject's sessions with their per-row and bulk revoke controls. */
export default function SessionsView(handle: Handle<SessionsView.Props>) {
	return () => {
		let { title, description, empty, columns, labels, confirmations, sessions } = handle.props;
		let others = sessions.filter((session) => !session.isCurrent);

		return (
			<Card>
				<Card.Header>
					<Card.Title>{title}</Card.Title>
					<Card.Description>{description}</Card.Description>
				</Card.Header>

				{sessions.length === 0 ? (
					<Card.Content>
						<Empty>
							<Empty.Description>{empty}</Empty.Description>
						</Empty>
					</Card.Content>
				) : (
					<Card.Content>
						<Table.Container>
							<Table aria-label={labels.tableLabel}>
								<Table.Header>
									<Table.Row>
										<Table.Column>{columns.device}</Table.Column>
										<Table.Column>{columns.ip}</Table.Column>
										<Table.Column>{columns.client}</Table.Column>
										<Table.Column>{columns.status}</Table.Column>
										<Table.Column>{columns.lastAccessed}</Table.Column>
										<Table.Column>{columns.expires}</Table.Column>
										<Table.Column align="end">{columns.actions}</Table.Column>
									</Table.Row>
								</Table.Header>

								<Table.Body>
									{sessions.map((session, index) => (
										<Table.Row key={session.id}>
											<Table.Cell>
												<div mix={[flex(), flexCol(), gap(1)]}>
													<Text mix={[fg("neutral.emphasis")]}>
														{session.browser} · {session.os}
													</Text>
													<Text mix={[text("sm"), fg("neutral.muted")]}>
														{labels.device[session.deviceType]}
													</Text>
												</div>
											</Table.Cell>

											<Table.Cell>
												<Text mix={[text("sm"), fg("neutral.muted")]}>{session.ip ?? "—"}</Text>
											</Table.Cell>

											<Table.Cell>
												<Text mix={[text("sm")]}>{session.clientName ?? "—"}</Text>
											</Table.Cell>

											<Table.Cell>
												<div mix={[flex(), gap(2)]}>
													<Badge color={session.isStale ? "neutral" : "success"}>
														{session.isStale ? labels.stale : labels.active}
													</Badge>
													{session.isCurrent && <Badge color="brand">{labels.current}</Badge>}
												</div>
											</Table.Cell>

											<Table.Cell mix={[nowrap()]}>
												<Text mix={[text("sm"), fg("neutral.muted")]}>{session.lastAccessed}</Text>
											</Table.Cell>

											<Table.Cell mix={[nowrap()]}>
												<Text mix={[text("sm"), fg("neutral.muted")]}>{session.expires}</Text>
											</Table.Cell>

											<Table.Cell>
												<div mix={[flex(), justify("end")]}>
													<Button
														commandfor={`${REVOKE_DIALOG_ID_PREFIX}${index}`}
														command="show-modal"
														color="danger"
														variant="outline"
														size="sm"
													>
														{labels.revoke}
													</Button>
												</div>

												<RevokeDialog
													id={`${REVOKE_DIALOG_ID_PREFIX}${index}`}
													copy={
														session.isCurrent ? confirmations.revokeCurrent : confirmations.revoke
													}
													intent="revoke"
													sessionId={session.id}
												/>
											</Table.Cell>
										</Table.Row>
									))}
								</Table.Body>
							</Table>
						</Table.Container>
					</Card.Content>
				)}

				{others.length > 0 && (
					<Card.Footer>
						<Button commandfor={REVOKE_ALL_DIALOG_ID} command="show-modal" color="danger">
							{labels.revokeAll}
						</Button>

						<RevokeDialog
							id={REVOKE_ALL_DIALOG_ID}
							copy={confirmations.revokeAll}
							intent="revoke-all"
						/>
					</Card.Footer>
				)}
			</Card>
		);
	};
}
