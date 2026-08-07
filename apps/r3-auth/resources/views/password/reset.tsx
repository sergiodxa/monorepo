/**
 * The form that sets a new password for an already-validated recovery link. The token
 * travels as a hidden field rather than in the action's query string, so the request that
 * spends it does not put it in a `Referer` header or an access log, and the page it posts
 * to is the one that rendered it.
 *
 * The address the account belongs to is never shown: the link is enough to reach this page
 * and repeating the mailbox on it would tell an interceptor whose account they are holding.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { Button, Card, Form, Text, TextField } from "@pkg/r3-ui";
import { fg } from "@pkg/u/color";
import { flex, flexCol, gap, items, justify } from "@pkg/u/layout";
import { is, maxIs, minBs, p } from "@pkg/u/size";
import { text, textAlign } from "@pkg/u/typography";

import routes from "~/routes/web";

/** Shortest password the form will submit, matching what the validator enforces. */
const MINIMUM_PASSWORD_LENGTH = 8;

namespace ResetPasswordView {
	export interface Props {
		/** Card heading. */
		title: string;
		/** Sentence under the heading. */
		description: string;
		/** The single-use token this form spends, carried hidden. */
		token: string;
		/** The new-password field's caption and hint. */
		password: { label: string; placeholder: string };
		/** The confirmation field's caption and hint. */
		confirmation: { label: string; placeholder: string };
		/** Submit label. */
		submit: string;
		/** Why the previous submission was refused — too short, or the two did not match. */
		error: string | null;
	}
}

/** Renders the new-password form for a validated recovery link. */
export default function ResetPasswordView(handle: Handle<ResetPasswordView.Props>) {
	return () => {
		let { title, description, token, password, confirmation, submit, error } = handle.props;

		return (
			<main mix={[flex(), flexCol(), items("center"), justify("center"), minBs("100dvh"), p(6)]}>
				<Card mix={[is("100%"), maxIs("22.5rem")]}>
					<Card.Header mix={[textAlign("center")]}>
						<Card.Title>{title}</Card.Title>
						<Card.Description>{description}</Card.Description>
					</Card.Header>

					<Form method="post" action={routes.password.reset.action.href()}>
						<Card.Content mix={[flex(), flexCol(), gap(6)]}>
							{error && (
								<Text role="alert" mix={[text("sm"), fg("danger.emphasis")]}>
									{error}
								</Text>
							)}

							<input type="hidden" name="token" value={token} />

							<TextField
								type="password"
								name="password"
								required
								label={password.label}
								placeholder={password.placeholder}
								autoComplete="new-password"
								minLength={MINIMUM_PASSWORD_LENGTH}
							/>

							<TextField
								type="password"
								name="passwordConfirmation"
								required
								label={confirmation.label}
								placeholder={confirmation.placeholder}
								autoComplete="new-password"
								minLength={MINIMUM_PASSWORD_LENGTH}
							/>
						</Card.Content>

						<Card.Footer>
							<Button type="submit" color="brand" mix={[is("100%")]}>
								{submit}
							</Button>
						</Card.Footer>
					</Form>
				</Card>
			</main>
		);
	};
}
