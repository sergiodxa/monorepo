/**
 * The form that asks for the address a recovery link should go to. One field, posted back
 * to the URL that rendered it, and re-rendered server-side when the address is malformed —
 * so the page needs no JavaScript.
 *
 * It says up front that a link is only sent to a registered address without saying whether
 * the one typed is registered, which is the same promise the endpoint keeps: the page after
 * submitting reads identically either way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { fg } from "@pkg/u/color";
import { flex, flexCol, gap, items, justify } from "@pkg/u/layout";
import { is, maxIs, minBs, p } from "@pkg/u/size";
import { text, textAlign } from "@pkg/u/typography";
import { Button, Card, Form, Text, TextField } from "@pkg/ui";

import routes from "~/routes/web";

namespace ForgotPasswordView {
	export interface Props {
		/** Card heading. */
		title: string;
		/** Sentence under the heading, explaining what submitting does. */
		description: string;
		/** The address field's caption and hint. */
		email: { label: string; placeholder: string };
		/** What the address field starts with, so a refused submission keeps the typing. */
		value: string;
		/** Submit label. */
		submit: string;
		/** Why the previous submission was refused, when there was one. */
		error: string | null;
	}
}

/** Renders the reset-request form. */
export default function ForgotPasswordView(handle: Handle<ForgotPasswordView.Props>) {
	return () => {
		let { title, description, email, value, submit, error } = handle.props;

		return (
			<main mix={[flex(), flexCol(), items("center"), justify("center"), minBs("100dvh"), p(6)]}>
				<Card mix={[is("100%"), maxIs("22.5rem")]}>
					<Card.Header mix={[textAlign("center")]}>
						<Card.Title>{title}</Card.Title>
						<Card.Description>{description}</Card.Description>
					</Card.Header>

					<Form method="post" action={routes.password.forgot.action.href()}>
						<Card.Content mix={[flex(), flexCol(), gap(6)]}>
							{error && (
								<Text role="alert" mix={[text("sm"), fg("danger.emphasis")]}>
									{error}
								</Text>
							)}

							<TextField
								type="email"
								name="email"
								required
								label={email.label}
								placeholder={email.placeholder}
								defaultValue={value}
								autoComplete="email"
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
