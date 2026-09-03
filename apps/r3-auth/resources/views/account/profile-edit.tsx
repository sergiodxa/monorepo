/**
 * The profile edit form. Three fields, posted to the same URL that rendered them, and
 * re-rendered server-side with the submitted values and the validator's own messages
 * when something is wrong, so a rejected submission never loses what was typed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { fg } from "@sdxc/u/color";
import { flex, flexCol, gap } from "@sdxc/u/layout";
import { text } from "@sdxc/u/typography";
import { Button, Card, Form, LinkButton, Text, TextField } from "@sdxc/ui";

import routes from "~/routes/web";

namespace ProfileEditView {
	/** A field's caption, hint text, the value it starts with, and its own failure. */
	export interface Field {
		label: string;
		placeholder: string;
		value: string;
		/** The validator's message for this field, or `null` when it is fine. */
		error: string | null;
	}

	export interface Props {
		/** Card heading. */
		title: string;
		/** Sentence under the heading. */
		description: string;
		/** The three editable fields, keyed by the name each posts under. */
		fields: {
			displayName: Field;
			username: Field;
			avatar: Field;
		};
		/** Submit and cancel labels. */
		labels: { submit: string; cancel: string };
		/**
		 * Why the previous submission was refused, when no single field owns the reason —
		 * a username already taken, for instance. Shown above the fields.
		 */
		error: string | null;
	}
}

/** Renders the profile edit form, pre-filled and with any validation feedback. */
export default function ProfileEditView(handle: Handle<ProfileEditView.Props>) {
	return () => {
		let { title, description, fields, labels, error } = handle.props;

		return (
			<Card>
				<Card.Header>
					<Card.Title>{title}</Card.Title>
					<Card.Description>{description}</Card.Description>
				</Card.Header>

				<Form method="post" action={routes.account.profileEdit.action.href()}>
					<Card.Content mix={[flex(), flexCol(), gap(6)]}>
						{error && (
							<Text role="alert" mix={[text("sm"), fg("danger.emphasis")]}>
								{error}
							</Text>
						)}

						<TextField
							name="displayName"
							required
							label={fields.displayName.label}
							placeholder={fields.displayName.placeholder}
							defaultValue={fields.displayName.value}
							errorMessage={fields.displayName.error ?? undefined}
							autoComplete="name"
						/>

						<TextField
							name="username"
							required
							label={fields.username.label}
							placeholder={fields.username.placeholder}
							defaultValue={fields.username.value}
							errorMessage={fields.username.error ?? undefined}
							autoComplete="username"
						/>

						<TextField
							type="url"
							name="avatar"
							required
							label={fields.avatar.label}
							placeholder={fields.avatar.placeholder}
							defaultValue={fields.avatar.value}
							errorMessage={fields.avatar.error ?? undefined}
						/>
					</Card.Content>

					<Card.Footer mix={[flex(), gap(2)]}>
						<Button type="submit" color="brand">
							{labels.submit}
						</Button>
						<LinkButton href={routes.account.profile.href()} color="neutral" variant="ghost">
							{labels.cancel}
						</LinkButton>
					</Card.Footer>
				</Form>
			</Card>
		);
	};
}
