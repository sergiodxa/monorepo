/**
 * The client edit form, including both logout channels and their `session_required`
 * switches, plus the opt-in that rotates the secret. When a rotation happens the new
 * secret is revealed once here and nowhere else, because rotating invalidates the copy
 * the relying party is holding.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import {
	Alert,
	Button,
	Card,
	Checkbox,
	Form,
	Label,
	LinkButton,
	Text,
	TextArea,
	TextField,
} from "@pkg/r3-ui";
import { flex, flexCol, gap } from "@pkg/u/layout";
import { mbs, p } from "@pkg/u/size";
import { font } from "@pkg/u/typography";

import type { AdminView } from "~/app/http/view-models/admin";

import CopyButton from "~/resources/components/copy-button";
import AdminLayout from "~/resources/layouts/admin";

/** Longest description the field accepts, matching the validator. */
const DESCRIPTION_MAX_LENGTH = 280;

namespace ClientEditView {
	/** A field's caption and the hint shown while it is empty. */
	export interface Field {
		label: string;
		placeholder: string;
	}

	export interface Labels {
		title: string;
		description: string;
		fields: {
			name: Field;
			description: Field;
			logoUrl: Field;
			redirectUri: Field;
			logoutUri: Field;
			backchannelLogoutUri: Field;
			frontchannelLogoutUri: Field;
		};
		backchannelSessionRequired: string;
		frontchannelSessionRequired: string;
		regenerateSecret: string;
		submit: string;
		cancel: string;
		invalid: string;
		secretRegenerated: string;
		secretWarning: string;
		secret: string;
		view: string;
		copy: string;
		copied: string;
	}

	export interface Props {
		chrome: AdminView.Chrome;
		labels: Labels;
		client: AdminView.ClientDetail;
		/** Where cancel and the post-rotation link go. */
		detailHref: string;
		/** Set only on the render that follows a secret rotation. */
		newSecret?: string;
		/**
		 * Validation failures from the previous submission. `Form` routes each one to the
		 * field its path names, so a field needs no message threaded to it by hand.
		 */
		issues?: Form.Issue[];
	}
}

/** Renders the client edit form, or the rotated secret's one-time reveal. */
export default function ClientEditView(handle: Handle<ClientEditView.Props>) {
	return () => {
		let { chrome, labels, client, detailHref, newSecret, issues } = handle.props;

		if (newSecret) {
			return (
				<AdminLayout chrome={chrome}>
					<Alert color="warning">
						<Alert.Content>
							<Alert.Title>{labels.secretRegenerated}</Alert.Title>
							<Alert.Description>{labels.secretWarning}</Alert.Description>
						</Alert.Content>
					</Alert>

					<Card mix={[mbs(6)]}>
						<Card.Header>
							<Card.Title>{client.name}</Card.Title>
						</Card.Header>
						<Card.Content mix={[flex(), flexCol(), gap(1)]}>
							<Label>{labels.secret}</Label>
							<div mix={[flex(), gap(2)]}>
								<Text mix={[font("mono"), p(2)]}>{newSecret}</Text>
								<CopyButton value={newSecret} label={labels.copy} copiedLabel={labels.copied} />
							</div>
						</Card.Content>
						<Card.Footer>
							<LinkButton href={detailHref}>{labels.view}</LinkButton>
						</Card.Footer>
					</Card>
				</AdminLayout>
			);
		}

		return (
			<AdminLayout chrome={chrome}>
				<Card>
					<Card.Header>
						<Card.Title>{labels.title}</Card.Title>
						<Card.Description>{labels.description}</Card.Description>
					</Card.Header>

					<Form method="post" issues={issues}>
						<Card.Content mix={[flex(), flexCol(), gap(4)]}>
							{issues && issues.length > 0 && (
								<Alert color="danger">
									<Alert.Content>
										<Alert.Title>{labels.invalid}</Alert.Title>
									</Alert.Content>
								</Alert>
							)}

							<TextField
								name="name"
								required
								defaultValue={client.name}
								label={labels.fields.name.label}
								placeholder={labels.fields.name.placeholder}
							/>

							<div mix={[flex(), flexCol(), gap(1)]}>
								<Label htmlFor="client-description">{labels.fields.description.label}</Label>
								<TextArea
									id="client-description"
									name="description"
									rows={3}
									maxLength={DESCRIPTION_MAX_LENGTH}
									defaultValue={client.description ?? ""}
									placeholder={labels.fields.description.placeholder}
								/>
							</div>

							<TextField
								type="url"
								name="logoUrl"
								defaultValue={client.logoUrl ?? ""}
								label={labels.fields.logoUrl.label}
								placeholder={labels.fields.logoUrl.placeholder}
							/>

							<TextField
								type="url"
								name="redirectUri"
								required
								defaultValue={client.redirectUri}
								label={labels.fields.redirectUri.label}
								placeholder={labels.fields.redirectUri.placeholder}
							/>

							<TextField
								type="url"
								name="logoutUri"
								required
								defaultValue={client.logoutUri}
								label={labels.fields.logoutUri.label}
								placeholder={labels.fields.logoutUri.placeholder}
							/>

							<TextField
								type="url"
								name="backchannelLogoutUri"
								defaultValue={client.backchannelLogoutUri ?? ""}
								label={labels.fields.backchannelLogoutUri.label}
								placeholder={labels.fields.backchannelLogoutUri.placeholder}
							/>

							{/* The stored column is the text "true"/"false", so the checked state has to
							be derived from that string and posts back as the same one. */}
							<Checkbox
								name="backchannelLogoutSessionRequired"
								defaultChecked={client.backchannelLogoutSessionRequired}
							>
								{labels.backchannelSessionRequired}
							</Checkbox>

							<TextField
								type="url"
								name="frontchannelLogoutUri"
								defaultValue={client.frontchannelLogoutUri ?? ""}
								label={labels.fields.frontchannelLogoutUri.label}
								placeholder={labels.fields.frontchannelLogoutUri.placeholder}
							/>

							<Checkbox
								name="frontchannelLogoutSessionRequired"
								defaultChecked={client.frontchannelLogoutSessionRequired}
							>
								{labels.frontchannelSessionRequired}
							</Checkbox>

							<Checkbox name="regenerateSecret">{labels.regenerateSecret}</Checkbox>
						</Card.Content>

						<Card.Footer mix={[flex(), gap(2)]}>
							<Button type="submit">{labels.submit}</Button>
							<LinkButton href={detailHref} color="neutral" variant="ghost">
								{labels.cancel}
							</LinkButton>
						</Card.Footer>
					</Form>
				</Card>
			</AdminLayout>
		);
	};
}
