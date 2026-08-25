/**
 * The subject edit form: display name, username, avatar, role, and whether the address
 * counts as verified. The email address itself is shown read-only — it is what a social
 * identity is matched against, so an admin screen must not be able to re-point it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { flex, flexCol, gap } from "@pkg/u/layout";
import { Alert, Button, Card, Checkbox, Form, Label, LinkButton, Select, TextField } from "@pkg/ui";

import type { AdminView } from "~/app/http/view-models/admin";

import AdminLayout from "~/resources/layouts/admin";

namespace SubjectEditView {
	/** A field's caption and the hint shown while it is empty. */
	export interface Field {
		label: string;
		placeholder: string;
	}

	export interface Labels {
		title: string;
		description: string;
		fields: { displayName: Field; username: Field; avatar: Field; email: Field };
		role: string;
		roles: { user: string; admin: string };
		emailVerified: string;
		submit: string;
		cancel: string;
		invalid: string;
	}

	export interface Props {
		chrome: AdminView.Chrome;
		labels: Labels;
		subject: AdminView.SubjectDetail;
		/** Where cancel returns to. */
		detailHref: string;
		/**
		 * Validation failures from the previous submission. `Form` routes each one to the
		 * field its path names, so a field needs no message threaded to it by hand.
		 */
		issues?: Form.Issue[];
	}
}

/**
 * Renders the subject edit form. The role select marks the current value with
 * `selected` on the option, since the browser resolves the initial control state
 * from server-rendered HTML.
 */
export default function SubjectEditView(handle: Handle<SubjectEditView.Props>) {
	return () => {
		let { chrome, labels, subject, detailHref, issues } = handle.props;

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
								name="displayName"
								required
								defaultValue={subject.displayName}
								label={labels.fields.displayName.label}
								placeholder={labels.fields.displayName.placeholder}
							/>

							<TextField
								name="username"
								required
								defaultValue={subject.username}
								label={labels.fields.username.label}
								placeholder={labels.fields.username.placeholder}
							/>

							<TextField
								type="url"
								name="avatar"
								required
								defaultValue={subject.avatar}
								label={labels.fields.avatar.label}
								placeholder={labels.fields.avatar.placeholder}
							/>

							<div mix={[flex(), flexCol(), gap(1)]}>
								<Label htmlFor="subject-role">{labels.role}</Label>
								<Select id="subject-role" name="role">
									<Select.Option value="user" selected={subject.role === "user"}>
										{labels.roles.user}
									</Select.Option>
									<Select.Option value="admin" selected={subject.role === "admin"}>
										{labels.roles.admin}
									</Select.Option>
								</Select>
							</div>

							<TextField
								readOnly
								defaultValue={subject.emailAddress}
								label={labels.fields.email.label}
							/>

							<Checkbox name="emailVerified" defaultChecked={subject.emailVerified}>
								{labels.emailVerified}
							</Checkbox>
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
