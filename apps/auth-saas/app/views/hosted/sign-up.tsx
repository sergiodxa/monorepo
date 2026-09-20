/**
 * The `/u/sign-up` screen: an identifier, a password, and an optional display
 * name. Legal acknowledgement and any tenant-declared required profile field
 * have no backing configuration anywhere in this app yet, so this screen asks
 * for nothing beyond what a subject and a password actually need.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@sdxc/i18n";
import type { Handle } from "remix/ui";

import { is, maxIs } from "@sdxc/u/size";
import { Button, Card, Form, TextField } from "@sdxc/ui";

import type { PasswordPolicy } from "~/database/passwords";

export namespace SignUpPage {
	export interface Props {
		t: TFunction;
		/** Where the form posts back to, carrying `ui_locales` (when present) in its query. */
		action: string;
		policy: PasswordPolicy;
		issues?: ReadonlyArray<Form.Issue>;
	}
}

/**
 * Renders the sign-up form inside a centered card.
 *
 * @param handle - Component handle exposing the screen's props.
 * @returns A render function producing the sign-up screen's markup.
 */
export function SignUpPage(handle: Handle<SignUpPage.Props>) {
	return () => {
		let { t, action, policy, issues } = handle.props;

		return (
			<Card mix={[is("100%"), maxIs("24rem")]}>
				<Card.Header>
					<Card.Title>{t("hostedSignUp.title")}</Card.Title>
					<Card.Description>
						{t("hostedSignUp.passwordHint", { minLength: policy.minLength })}
					</Card.Description>
				</Card.Header>

				<Card.Content>
					<Form method="post" action={action} issues={issues}>
						<TextField
							label={t("hostedSignUp.identifier.label")}
							name="email"
							type="email"
							required
							autoComplete="email"
						/>

						<TextField
							label={t("hostedSignUp.password.label")}
							name="password"
							type="password"
							required
							autoComplete="new-password"
						/>

						<TextField
							label={t("hostedSignUp.name.label")}
							name="name"
							type="text"
							autoComplete="name"
						/>

						<Button type="submit" color="brand" mix={[is("100%")]}>
							{t("hostedSignUp.submit")}
						</Button>
					</Form>
				</Card.Content>
			</Card>
		);
	};
}
