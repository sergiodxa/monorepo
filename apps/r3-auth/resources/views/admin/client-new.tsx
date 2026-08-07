/**
 * The client registration form, and the one-time reveal that follows it. A generated
 * secret is stored as the only copy the relying party will ever hold, so the success
 * state renders it once with a copy control and the page says plainly that it will not
 * be shown again — every later screen reads the client without its secret.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import {
	Alert,
	Button,
	Card,
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

namespace ClientNewView {
	/** A field's caption and the hint shown while it is empty. */
	export interface Field {
		label: string;
		placeholder: string;
	}

	/** The client as it exists for exactly one render, secret included. */
	export interface Created {
		id: string;
		name: string;
		secret: string;
		redirectUri: string;
		logoutUri: string;
		href: string;
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
		};
		submit: string;
		cancel: string;
		cancelHref: string;
		invalid: string;
		success: string;
		secretWarning: string;
		detail: { id: string; secret: string; redirectUri: string; logoutUri: string };
		view: string;
		copy: string;
		copied: string;
	}

	export interface Props {
		chrome: AdminView.Chrome;
		labels: Labels;
		/** Set only on the render that follows a successful creation. */
		created?: Created;
		/**
		 * Validation failures from the previous submission. `Form` routes each one to the
		 * field its path names, so a field needs no message threaded to it by hand.
		 */
		issues?: Form.Issue[];
	}
}

/** A monospaced read-only value, for the ids and URIs the reveal shows. */
function CodeValue(handle: Handle<{ label: string; value: string }>) {
	return () => (
		<div mix={[flex(), flexCol(), gap(1)]}>
			<Label>{handle.props.label}</Label>
			<Text mix={[font("mono")]}>{handle.props.value}</Text>
		</div>
	);
}

/** Renders the registration form, or the created client's one-time secret reveal. */
export default function ClientNewView(handle: Handle<ClientNewView.Props>) {
	return () => {
		let { chrome, labels, created, issues } = handle.props;

		if (created) {
			return (
				<AdminLayout chrome={chrome}>
					<Alert color="success">
						<Alert.Content>
							<Alert.Title>{labels.success}</Alert.Title>
							<Alert.Description>{labels.secretWarning}</Alert.Description>
						</Alert.Content>
					</Alert>

					<Card mix={[mbs(6)]}>
						<Card.Header>
							<Card.Title>{created.name}</Card.Title>
						</Card.Header>
						<Card.Content mix={[flex(), flexCol(), gap(4)]}>
							<CodeValue label={labels.detail.id} value={created.id} />

							<div mix={[flex(), flexCol(), gap(1)]}>
								<Label>{labels.detail.secret}</Label>
								<div mix={[flex(), gap(2)]}>
									<Text mix={[font("mono"), p(2)]}>{created.secret}</Text>
									<CopyButton
										value={created.secret}
										label={labels.copy}
										copiedLabel={labels.copied}
									/>
								</div>
							</div>

							<CodeValue label={labels.detail.redirectUri} value={created.redirectUri} />
							<CodeValue label={labels.detail.logoutUri} value={created.logoutUri} />
						</Card.Content>
						<Card.Footer>
							<LinkButton href={created.href}>{labels.view}</LinkButton>
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
									placeholder={labels.fields.description.placeholder}
								/>
							</div>

							<TextField
								type="url"
								name="logoUrl"
								label={labels.fields.logoUrl.label}
								placeholder={labels.fields.logoUrl.placeholder}
							/>

							<TextField
								type="url"
								name="redirectUri"
								required
								label={labels.fields.redirectUri.label}
								placeholder={labels.fields.redirectUri.placeholder}
							/>

							<TextField
								type="url"
								name="logoutUri"
								required
								label={labels.fields.logoutUri.label}
								placeholder={labels.fields.logoutUri.placeholder}
							/>
						</Card.Content>

						<Card.Footer mix={[flex(), gap(2)]}>
							<Button type="submit">{labels.submit}</Button>
							<LinkButton href={labels.cancelHref} color="neutral" variant="ghost">
								{labels.cancel}
							</LinkButton>
						</Card.Footer>
					</Form>
				</Card>
			</AdminLayout>
		);
	};
}
