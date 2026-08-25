/**
 * One relying party's registration, read-only: its identity, both logout channels, how
 * many subjects have authorized it, and the two actions that change it. The secret
 * displays as withheld, since its value lives in the database as plaintext and
 * surfacing it here would let a read-only view leak it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { fg } from "@pkg/u/color";
import { raw } from "@pkg/u/general";
import { flex, flexCol, gap, grid, gridTemplate } from "@pkg/u/layout";
import { at } from "@pkg/u/responsive";
import { font, overflowWrap } from "@pkg/u/typography";
import { Badge, Card, Label, LinkButton, Text } from "@pkg/ui";

import type { AdminView } from "~/app/http/view-models/admin";

import AdminLayout from "~/resources/layouts/admin";
import ConfirmAction from "~/resources/views/admin/confirm-action";

namespace ClientDetailView {
	export interface Labels {
		id: string;
		name: string;
		description: string;
		noDescription: string;
		secret: string;
		secretHidden: string;
		redirectUri: string;
		logoutUri: string;
		backchannelLogoutUri: string;
		frontchannelLogoutUri: string;
		sessionRequired: string;
		notSet: string;
		authorizedUsers: string;
		createdAt: string;
		edit: string;
		delete: string;
		confirm: { title: string; description: string; confirm: string; cancel: string };
	}

	export interface Props {
		chrome: AdminView.Chrome;
		labels: Labels;
		client: AdminView.ClientDetail;
		/** How many subjects have consented to this client. */
		authorizedUsers: number;
		editHref: string;
	}
}

/** One labelled read-only value, optionally spanning both columns of the detail grid. */
function Field(
	handle: Handle<{ label: string; value: string; mono?: boolean; wide?: boolean; muted?: boolean }>,
) {
	return () => {
		let { label, value, mono, wide, muted } = handle.props;

		return (
			<div
				mix={[
					flex(),
					flexCol(),
					gap(1),
					wide ? at("sm", raw({ gridColumn: "span 2" })) : undefined,
				]}
			>
				<Label>{label}</Label>
				<Text
					mix={[
						mono ? font("mono") : undefined,
						muted ? fg("neutral.muted") : undefined,
						overflowWrap("anywhere"),
					]}
				>
					{value}
				</Text>
			</div>
		);
	};
}

/** Renders a client's full registration with its edit and delete actions. */
export default function ClientDetailView(handle: Handle<ClientDetailView.Props>) {
	return () => {
		let { chrome, labels, client, authorizedUsers, editHref } = handle.props;

		return (
			<AdminLayout chrome={chrome}>
				<Card>
					<Card.Header>
						<Card.Title>{client.name}</Card.Title>
					</Card.Header>

					<Card.Content
						mix={[grid(), gap(4), at("sm", gridTemplate({ columns: "repeat(2, minmax(0, 1fr))" }))]}
					>
						<Field label={labels.id} value={client.id} mono />
						<Field label={labels.name} value={client.name} />

						<Field
							label={labels.description}
							value={client.description ?? labels.noDescription}
							muted={!client.description}
							wide
						/>

						<Field label={labels.secret} value={labels.secretHidden} muted />

						<div mix={[flex(), flexCol(), gap(1)]}>
							<Label>{labels.authorizedUsers}</Label>
							<Text>{String(authorizedUsers)}</Text>
						</div>

						<Field label={labels.createdAt} value={client.createdAt} />

						<Field label={labels.redirectUri} value={client.redirectUri} mono wide />
						<Field label={labels.logoutUri} value={client.logoutUri} mono wide />

						<div mix={[flex(), flexCol(), gap(1)]}>
							<Label>{labels.backchannelLogoutUri}</Label>
							<Text mix={[overflowWrap("anywhere")]}>
								{client.backchannelLogoutUri ?? labels.notSet}
							</Text>
							{client.backchannelLogoutSessionRequired && (
								<div>
									<Badge color="brand">{labels.sessionRequired}</Badge>
								</div>
							)}
						</div>

						<div mix={[flex(), flexCol(), gap(1)]}>
							<Label>{labels.frontchannelLogoutUri}</Label>
							<Text mix={[overflowWrap("anywhere")]}>
								{client.frontchannelLogoutUri ?? labels.notSet}
							</Text>
							{client.frontchannelLogoutSessionRequired && (
								<div>
									<Badge color="brand">{labels.sessionRequired}</Badge>
								</div>
							)}
						</div>
					</Card.Content>

					<Card.Footer mix={[flex(), gap(2)]}>
						<LinkButton href={editHref}>{labels.edit}</LinkButton>
						<ConfirmAction
							id={`delete-client-${client.id}`}
							trigger={labels.delete}
							title={labels.confirm.title}
							description={labels.confirm.description}
							confirmLabel={labels.confirm.confirm}
							cancelLabel={labels.confirm.cancel}
							fields={{ intent: "delete" }}
						/>
					</Card.Footer>
				</Card>
			</AdminLayout>
		);
	};
}
