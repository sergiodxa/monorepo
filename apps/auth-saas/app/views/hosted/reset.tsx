/**
 * The `/u/reset` screen: a request form asking for the identifier, and — once
 * a `ticket` names a pending reset — the new-password form it authorizes.
 * `requested` renders identically whether or not the identifier resolved,
 * since `beginPasswordReset` itself never says which happened.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@sdxc/i18n";
import type { Handle } from "remix/ui";

import { is, maxIs } from "@sdxc/u/size";
import { Button, Card, Form, Link, Text, TextField } from "@sdxc/ui";

import type { PasswordPolicy } from "~/database/passwords";

export namespace ResetPage {
	export type Props =
		| {
				t: TFunction;
				state: "request";
				action: string;
				issues?: ReadonlyArray<Form.Issue>;
		  }
		| { t: TFunction; state: "requested" }
		| {
				t: TFunction;
				state: "complete";
				action: string;
				policy: PasswordPolicy;
				issues?: ReadonlyArray<Form.Issue>;
		  }
		| { t: TFunction; state: "completed"; signInHref: string }
		| { t: TFunction; state: "invalidTicket"; requestHref: string };
}

/**
 * Renders the reset screen for whichever of its four states the request
 * resolved to.
 *
 * @param handle - Component handle exposing the screen's props.
 * @returns A render function producing the reset screen's markup.
 */
export function ResetPage(handle: Handle<ResetPage.Props>) {
	return () => {
		let props = handle.props;
		let { t } = props;

		if (props.state === "requested") {
			return (
				<Card mix={[is("100%"), maxIs("24rem")]}>
					<Card.Header>
						<Card.Title>{t("hostedReset.requested.heading")}</Card.Title>
					</Card.Header>
					<Card.Content>
						<Text>{t("hostedReset.requested.body")}</Text>
					</Card.Content>
				</Card>
			);
		}

		if (props.state === "completed") {
			return (
				<Card mix={[is("100%"), maxIs("24rem")]}>
					<Card.Header>
						<Card.Title>{t("hostedReset.completeSuccess.heading")}</Card.Title>
					</Card.Header>
					<Card.Content>
						<Text>{t("hostedReset.completeSuccess.body")}</Text>
					</Card.Content>
					<Card.Footer>
						<Link href={props.signInHref}>{t("hostedReset.completeSuccess.signIn")}</Link>
					</Card.Footer>
				</Card>
			);
		}

		if (props.state === "invalidTicket") {
			return (
				<Card mix={[is("100%"), maxIs("24rem")]}>
					<Card.Header>
						<Card.Title>{t("hostedReset.invalidTicket.heading")}</Card.Title>
					</Card.Header>
					<Card.Content>
						<Text>{t("hostedReset.invalidTicket.body")}</Text>
					</Card.Content>
					<Card.Footer>
						<Link href={props.requestHref}>{t("hostedReset.invalidTicket.requestNew")}</Link>
					</Card.Footer>
				</Card>
			);
		}

		if (props.state === "complete") {
			return (
				<Card mix={[is("100%"), maxIs("24rem")]}>
					<Card.Header>
						<Card.Title>{t("hostedReset.completeTitle")}</Card.Title>
						<Card.Description>
							{t("hostedSignUp.passwordHint", { minLength: props.policy.minLength })}
						</Card.Description>
					</Card.Header>
					<Card.Content>
						<Form method="post" action={props.action} issues={props.issues}>
							<TextField
								label={t("hostedReset.newPassword.label")}
								name="newPassword"
								type="password"
								required
								autoComplete="new-password"
							/>
							<Button type="submit" color="brand" mix={[is("100%")]}>
								{t("hostedReset.completeSubmit")}
							</Button>
						</Form>
					</Card.Content>
				</Card>
			);
		}

		return (
			<Card mix={[is("100%"), maxIs("24rem")]}>
				<Card.Header>
					<Card.Title>{t("hostedReset.requestTitle")}</Card.Title>
				</Card.Header>
				<Card.Content>
					<Form method="post" action={props.action} issues={props.issues}>
						<TextField
							label={t("hostedReset.identifier.label")}
							name="identifier"
							type="text"
							required
							autoComplete="username"
						/>
						<Button type="submit" color="brand" mix={[is("100%")]}>
							{t("hostedReset.requestSubmit")}
						</Button>
					</Form>
				</Card.Content>
			</Card>
		);
	};
}
