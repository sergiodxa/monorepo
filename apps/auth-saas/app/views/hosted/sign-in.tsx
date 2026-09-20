/**
 * The `/u/sign-in` screen: identifier and password, and a passkey button. Magic-link
 * and social-provider sign-in have no operation to post to yet anywhere in this
 * codebase, so this screen offers only the two factors that already exist.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@sdxc/i18n";
import type { Handle } from "remix/ui";

import { gap, vstack } from "@sdxc/u/layout";
import { is, maxIs } from "@sdxc/u/size";
import { textAlign } from "@sdxc/u/typography";
import { Alert, Button, Card, Checkbox, Separator, Text, TextField } from "@sdxc/ui";

import { PasskeySignInButton } from "./passkey-button";

export namespace SignInPage {
	export interface Props {
		t: TFunction;
		/** Where the form posts back to, carrying the interaction id (and `ui_locales`, when present) in its query. */
		action: string;
		/** Where the passkey island's two JSON calls post to. */
		passkeyOptionsAction: string;
		passkeyVerifyAction: string;
		loginHint: string | null;
		forced: boolean;
		error: string | null;
	}
}

/**
 * Renders the sign-in form and the passkey button, inside a centered card.
 *
 * @param handle - Component handle exposing the screen's props.
 * @returns A render function producing the sign-in screen's markup.
 */
export function SignInPage(handle: Handle<SignInPage.Props>) {
	return () => {
		let { t, action, passkeyOptionsAction, passkeyVerifyAction, loginHint, forced, error } =
			handle.props;

		return (
			<Card mix={[is("100%"), maxIs("24rem")]}>
				<Card.Header>
					<Card.Title>{t("hostedSignIn.title")}</Card.Title>
					{forced && <Card.Description>{t("hostedSignIn.forcedNotice")}</Card.Description>}
				</Card.Header>

				<Card.Content mix={[vstack({ gap: 4 })]}>
					{error && (
						<Alert color="danger">
							<Alert.Content>{error}</Alert.Content>
						</Alert>
					)}

					<form method="post" action={action} mix={[vstack({ gap: 4 })]}>
						<TextField
							label={t("hostedSignIn.identifier.label")}
							name="identifier"
							type="text"
							required
							autoComplete="username"
							defaultValue={loginHint ?? undefined}
						/>

						<TextField
							label={t("hostedSignIn.password.label")}
							name="password"
							type="password"
							required
							autoComplete="current-password"
						/>

						<Checkbox name="remember" value="true" defaultChecked>
							{t("hostedSignIn.remember")}
						</Checkbox>

						<Button type="submit" color="brand" mix={[is("100%")]}>
							{t("hostedSignIn.submit")}
						</Button>
					</form>

					<div mix={[gap(3), vstack()]}>
						<Separator />
						<Text mix={[textAlign("center")]}>{t("hostedSignIn.orSeparator")}</Text>
					</div>

					<PasskeySignInButton
						optionsAction={passkeyOptionsAction}
						verifyAction={passkeyVerifyAction}
						label={t("hostedSignIn.passkey.trigger")}
						pendingLabel={t("hostedSignIn.passkey.pending")}
						errorMessage={t("hostedSignIn.errors.passkeyFailed")}
						unsupportedMessage={t("hostedSignIn.errors.passkeyUnsupported")}
					/>
				</Card.Content>

				<Card.Footer>
					<Text mix={[textAlign("center"), is("100%")]}>{t("hostedSignIn.footer")}</Text>
				</Card.Footer>
			</Card>
		);
	};
}
