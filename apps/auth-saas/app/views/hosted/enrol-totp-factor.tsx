/**
 * The enrolment form both `/u/second-factor` (an administrator reset) and
 * `/u/step-up` (no factor at all) fall back to: the setup key and `otpauth://`
 * link an authenticator app takes, and the code it shows back once added. No QR
 * image is rendered — that needs an encoding library this pass does not pull in —
 * so the setup key and the link stand in for it, both already what
 * `beginTotpEnrolment` hands back to show once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@sdxc/i18n";
import type { Handle } from "remix/ui";

import { vstack } from "@sdxc/u/layout";
import { is, maxIs } from "@sdxc/u/size";
import { Alert, Button, Card, Text, TextField } from "@sdxc/ui";
import { css } from "remix/ui";

export namespace EnrolTotpFactorPage {
	export interface Props {
		t: TFunction;
		title: string;
		body: string;
		/** Where the form posts back to, carrying the interaction id in its query. */
		action: string;
		enrolmentId: string;
		uri: string;
		setupKey: string;
		codeLabel: string;
		submitLabel: string;
		error: string | null;
	}
}

/**
 * Renders the shared TOTP enrolment form.
 *
 * @param handle - Component handle exposing the screen's props.
 * @returns A render function producing the enrolment form's markup.
 */
export function EnrolTotpFactorPage(handle: Handle<EnrolTotpFactorPage.Props>) {
	return () => {
		let { t, title, body, action, enrolmentId, uri, setupKey, codeLabel, submitLabel, error } =
			handle.props;

		return (
			<Card mix={[is("100%"), maxIs("26rem")]}>
				<Card.Header>
					<Card.Title>{title}</Card.Title>
					<Card.Description>{body}</Card.Description>
				</Card.Header>

				<Card.Content mix={[vstack({ gap: 4 })]}>
					{error && (
						<Alert color="danger">
							<Alert.Content>{error}</Alert.Content>
						</Alert>
					)}

					<div mix={[vstack({ gap: 1 })]}>
						<Text mix={[css({ fontWeight: "600" })]}>
							{t("hostedSecondFactor.enrol.setupKeyLabel")}
						</Text>
						<code mix={[css({ fontFamily: "monospace", wordBreak: "break-all" })]}>{setupKey}</code>
					</div>

					<div mix={[vstack({ gap: 1 })]}>
						<a href={uri} mix={[css({ wordBreak: "break-all" })]}>
							{t("hostedSecondFactor.enrol.uriLabel")}
						</a>
					</div>

					<form method="post" action={action} mix={[vstack({ gap: 4 })]}>
						<input type="hidden" name="enrolmentId" value={enrolmentId} />

						<TextField
							label={codeLabel}
							name="code"
							type="text"
							required
							autoComplete="one-time-code"
							autoFocus
						/>

						<Button type="submit" color="brand" mix={[is("100%")]}>
							{submitLabel}
						</Button>
					</form>
				</Card.Content>
			</Card>
		);
	};
}
