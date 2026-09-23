/**
 * The `/u/magic-link` and `/u/magic-link/complete` screens: a request form
 * asking for the address, a confirmation that renders identically whichever of
 * `beginMagicLinkSignIn`'s three outcomes actually happened (with its own
 * code-entry form, since the person may finish by typing the code rather than
 * following the link), the link-landing page whose hidden field carries the
 * token into its own `POST`, and the distinct outcomes a completion attempt can
 * still land on once the uniform first response is behind it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Handle } from "remix/ui";

import { vstack } from "@sdxc/u/layout";
import { is, maxIs } from "@sdxc/u/size";
import { Alert, Button, Card, Form, Link, Text, TextField } from "@sdxc/ui";

import { TurnstileWidget } from "./turnstile-widget";

export namespace MagicLinkPage {
	export type Props =
		| {
				t: Translate;
				state: "request";
				action: string;
				/** Whether this address has crossed half its shared credential budget, so the form should challenge it. */
				challenge: boolean;
				/** The platform's Turnstile site key, rendered only when `challenge` is set. */
				turnstileSiteKey: string;
				issues?: ReadonlyArray<Form.Issue>;
		  }
		| {
				t: Translate;
				state: "confirmation";
				codeAction: string;
				error?: string | null;
		  }
		| { t: Translate; state: "tokenLanding"; action: string; token: string }
		| { t: Translate; state: "invalid"; requestHref: string }
		| { t: Translate; state: "wrongBrowser"; requestHref: string }
		| { t: Translate; state: "dauCapReached" };
}

/**
 * Renders the magic-link screen for whichever of its states the request
 * resolved to.
 *
 * @param handle - Component handle exposing the screen's props.
 * @returns A render function producing the magic-link screen's markup.
 */
export function MagicLinkPage(handle: Handle<MagicLinkPage.Props>) {
	return () => {
		let props = handle.props;
		let { t } = props;

		if (props.state === "confirmation") {
			return (
				<Card mix={[is("100%"), maxIs("24rem")]}>
					<Card.Header>
						<Card.Title>{t("hostedMagicLink.confirmation.heading")}</Card.Title>
					</Card.Header>
					<Card.Content mix={[vstack({ gap: 4 })]}>
						<Text>{t("hostedMagicLink.confirmation.body")}</Text>

						{props.error && (
							<Alert color="danger">
								<Alert.Content>{props.error}</Alert.Content>
							</Alert>
						)}

						<form method="post" action={props.codeAction} mix={[vstack({ gap: 4 })]}>
							<TextField
								label={t("hostedMagicLink.confirmation.codeLabel")}
								name="code"
								type="text"
								required
								autoComplete="one-time-code"
							/>
							<Button type="submit" color="brand" mix={[is("100%")]}>
								{t("hostedMagicLink.confirmation.codeSubmit")}
							</Button>
						</form>
					</Card.Content>
				</Card>
			);
		}

		if (props.state === "tokenLanding") {
			return (
				<Card mix={[is("100%"), maxIs("24rem")]}>
					<Card.Header>
						<Card.Title>{t("hostedMagicLink.tokenLanding.heading")}</Card.Title>
					</Card.Header>
					<Card.Content mix={[vstack({ gap: 4 })]}>
						<Text>{t("hostedMagicLink.tokenLanding.body")}</Text>
						<form method="post" action={props.action} mix={[vstack({ gap: 4 })]}>
							<input type="hidden" name="token" value={props.token} />
							<Button type="submit" color="brand" mix={[is("100%")]}>
								{t("hostedMagicLink.tokenLanding.submit")}
							</Button>
						</form>
					</Card.Content>
				</Card>
			);
		}

		if (props.state === "invalid") {
			return (
				<Card mix={[is("100%"), maxIs("24rem")]}>
					<Card.Header>
						<Card.Title>{t("hostedMagicLink.invalid.heading")}</Card.Title>
					</Card.Header>
					<Card.Content>
						<Text>{t("hostedMagicLink.invalid.body")}</Text>
					</Card.Content>
					<Card.Footer>
						<Link href={props.requestHref}>{t("hostedMagicLink.invalid.requestNew")}</Link>
					</Card.Footer>
				</Card>
			);
		}

		if (props.state === "wrongBrowser") {
			return (
				<Card mix={[is("100%"), maxIs("24rem")]}>
					<Card.Header>
						<Card.Title>{t("hostedMagicLink.wrongBrowser.heading")}</Card.Title>
					</Card.Header>
					<Card.Content>
						<Text>{t("hostedMagicLink.wrongBrowser.body")}</Text>
					</Card.Content>
					<Card.Footer>
						<Link href={props.requestHref}>{t("hostedMagicLink.wrongBrowser.requestNew")}</Link>
					</Card.Footer>
				</Card>
			);
		}

		if (props.state === "dauCapReached") {
			return (
				<Card mix={[is("100%"), maxIs("24rem")]}>
					<Card.Header>
						<Card.Title>{t("hostedMagicLink.requestTitle")}</Card.Title>
					</Card.Header>
					<Card.Content>
						<Alert color="danger">
							<Alert.Content>{t("hostedMagicLink.errors.dauCapReached")}</Alert.Content>
						</Alert>
					</Card.Content>
				</Card>
			);
		}

		return (
			<Card mix={[is("100%"), maxIs("24rem")]}>
				<Card.Header>
					<Card.Title>{t("hostedMagicLink.requestTitle")}</Card.Title>
				</Card.Header>
				<Card.Content>
					<Form method="post" action={props.action} issues={props.issues}>
						<TextField
							label={t("hostedMagicLink.identifier.label")}
							name="email"
							type="email"
							required
							autoComplete="username"
						/>
						{props.challenge && <TurnstileWidget siteKey={props.turnstileSiteKey} />}
						<Button type="submit" color="brand" mix={[is("100%")]}>
							{t("hostedMagicLink.requestSubmit")}
						</Button>
					</Form>
				</Card.Content>
			</Card>
		);
	};
}
