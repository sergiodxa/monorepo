/**
 * The `/u/verify` screen: the landing page a verification link lands on, and
 * the "check your email" state signup lands on with its resend control.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@sdxc/i18n";
import type { Handle } from "remix/ui";

import { vstack } from "@sdxc/u/layout";
import { is, maxIs } from "@sdxc/u/size";
import { Alert, Button, Card, Text } from "@sdxc/ui";

export namespace VerifyPage {
	export type Props =
		| {
				t: TFunction;
				state: "pending";
				/** Where the resend control posts back to, carrying the subject id in its query. */
				resendAction: string;
				resent: boolean;
		  }
		| { t: TFunction; state: "verified" }
		| { t: TFunction; state: "invalid" };
}

/**
 * Renders the verify screen for whichever of its three states the request
 * resolved to.
 *
 * @param handle - Component handle exposing the screen's props.
 * @returns A render function producing the verify screen's markup.
 */
export function VerifyPage(handle: Handle<VerifyPage.Props>) {
	return () => {
		let props = handle.props;
		let { t } = props;

		if (props.state === "verified") {
			return (
				<Card mix={[is("100%"), maxIs("24rem")]}>
					<Card.Header>
						<Card.Title>{t("hostedVerify.verified.heading")}</Card.Title>
					</Card.Header>
					<Card.Content>
						<Text>{t("hostedVerify.verified.body")}</Text>
					</Card.Content>
				</Card>
			);
		}

		if (props.state === "invalid") {
			return (
				<Card mix={[is("100%"), maxIs("24rem")]}>
					<Card.Header>
						<Card.Title>{t("hostedVerify.invalid.heading")}</Card.Title>
					</Card.Header>
					<Card.Content>
						<Text>{t("hostedVerify.invalid.body")}</Text>
					</Card.Content>
				</Card>
			);
		}

		return (
			<Card mix={[is("100%"), maxIs("24rem")]}>
				<Card.Header>
					<Card.Title>{t("hostedVerify.pending.heading")}</Card.Title>
				</Card.Header>
				<Card.Content mix={[vstack({ gap: 3 })]}>
					<Text>{t("hostedVerify.pending.body")}</Text>

					{props.resent && (
						<Alert color="success">
							<Alert.Content>{t("hostedVerify.pending.resent")}</Alert.Content>
						</Alert>
					)}

					<form method="post" action={props.resendAction}>
						<Button type="submit" color="neutral" mix={[is("100%")]}>
							{t("hostedVerify.pending.resend")}
						</Button>
					</form>
				</Card.Content>
			</Card>
		);
	};
}
