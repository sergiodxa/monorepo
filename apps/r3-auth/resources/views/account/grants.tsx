/**
 * The authorized-apps page: one row per standing consent, with a revoke control
 * that also signs the person out of that app.
 *
 * This server's own registration renders read-only, since revoking it would end
 * the session reading this page; the revoke action refuses it server-side too.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { fg } from "@sdxc/u/color";
import { flex, flexCol, gap, items, justify } from "@sdxc/u/layout";
import { maxIs } from "@sdxc/u/size";
import { nowrap, text, weight } from "@sdxc/u/typography";
import { AlertDialog, Button, Card, Empty, Form, Logo, Table, Text } from "@sdxc/ui";

import type { GrantRow } from "~/app/http/view-models/account-grant";

import routes from "~/routes/web";

/** Prefix for each row's confirmation dialog id, completed with the row's position. */
const REVOKE_DIALOG_ID_PREFIX = "revoke-grant-";

namespace GrantsView {
	/**
	 * A row plus the confirmation sentence naming its client.
	 *
	 * The controller interpolates the sentence before the view renders it, so the
	 * person confirms against the exact app they picked.
	 */
	export interface Row extends GrantRow {
		confirmDescription: string;
	}

	export interface Props {
		/** Card heading. */
		title: string;
		/** Sentence under the heading. */
		description: string;
		/** What the page says when no app has been authorized. */
		empty: string;
		/** Column headers, in the order the table renders them. */
		columns: { app: string; authorizedOn: string; actions: string };
		/** Row labels and the accessible name for the table. */
		labels: {
			revoke: string;
			/** Shown in place of the control for the auth server's own consent. */
			cannotRevoke: string;
			tableLabel: string;
		};
		/** Confirmation copy shared by every row; the sentence itself lives on the row. */
		confirm: { title: string; confirm: string; cancel: string };
		/** The consents to list, oldest first. */
		grants: Row[];
	}
}

/**
 * Renders the signed-in subject's authorized apps and their revoke controls.
 *
 * Each revoke button opens a dialog whose own form performs the submission,
 * posting the revoke intent directly to the server.
 */
export default function GrantsView(handle: Handle<GrantsView.Props>) {
	return () => {
		let { title, description, empty, columns, labels, confirm, grants } = handle.props;

		return (
			<Card>
				<Card.Header>
					<Card.Title>{title}</Card.Title>
					<Card.Description>{description}</Card.Description>
				</Card.Header>

				<Card.Content>
					{grants.length === 0 ? (
						<Empty>
							<Empty.Description>{empty}</Empty.Description>
						</Empty>
					) : (
						<Table.Container>
							<Table aria-label={labels.tableLabel}>
								<Table.Header>
									<Table.Row>
										<Table.Column>{columns.app}</Table.Column>
										<Table.Column>{columns.authorizedOn}</Table.Column>
										<Table.Column align="end">{columns.actions}</Table.Column>
									</Table.Row>
								</Table.Header>

								<Table.Body>
									{grants.map((grant, index) => (
										<Table.Row key={grant.clientId}>
											<Table.Cell>
												<div mix={[flex(), items("center"), gap(3)]}>
													<Logo size="md">
														{grant.clientLogoUrl ? (
															<Logo.Image src={grant.clientLogoUrl} alt={grant.clientName} />
														) : (
															<Logo.Fallback>
																{grant.clientName.charAt(0).toUpperCase()}
															</Logo.Fallback>
														)}
													</Logo>

													<div mix={[flex(), flexCol(), gap(1)]}>
														<Text mix={[weight("medium"), fg("neutral.emphasis")]}>
															{grant.clientName}
														</Text>
														{grant.clientDescription && (
															<Text mix={[text("sm"), fg("neutral.muted"), maxIs("28rem")]}>
																{grant.clientDescription}
															</Text>
														)}
													</div>
												</div>
											</Table.Cell>

											<Table.Cell mix={[nowrap()]}>
												<Text mix={[text("sm"), fg("neutral.muted")]}>{grant.authorizedOn}</Text>
											</Table.Cell>

											<Table.Cell>
												<div mix={[flex(), justify("end")]}>
													{grant.isAuthServer ? (
														<Text mix={[text("sm"), fg("neutral.muted")]}>
															{labels.cannotRevoke}
														</Text>
													) : (
														<Button
															commandfor={`${REVOKE_DIALOG_ID_PREFIX}${index}`}
															command="show-modal"
															color="danger"
															variant="outline"
															size="sm"
														>
															{labels.revoke}
														</Button>
													)}
												</div>

												{!grant.isAuthServer && (
													<AlertDialog
														id={`${REVOKE_DIALOG_ID_PREFIX}${index}`}
														aria-labelledby={`${REVOKE_DIALOG_ID_PREFIX}${index}-title`}
													>
														<AlertDialog.Header>
															<AlertDialog.Title id={`${REVOKE_DIALOG_ID_PREFIX}${index}-title`}>
																{confirm.title}
															</AlertDialog.Title>
															<AlertDialog.Description>
																{grant.confirmDescription}
															</AlertDialog.Description>
														</AlertDialog.Header>

														<AlertDialog.Footer>
															<AlertDialog.Cancel commandfor={`${REVOKE_DIALOG_ID_PREFIX}${index}`}>
																{confirm.cancel}
															</AlertDialog.Cancel>

															<Form method="post" action={routes.account.grants.action.href()}>
																<input type="hidden" name="intent" value="revoke" />
																<input type="hidden" name="clientId" value={grant.clientId} />
																<Button type="submit" color="danger">
																	{confirm.confirm}
																</Button>
															</Form>
														</AlertDialog.Footer>
													</AlertDialog>
												)}
											</Table.Cell>
										</Table.Row>
									))}
								</Table.Body>
							</Table>
						</Table.Container>
					)}
				</Card.Content>
			</Card>
		);
	};
}
