/**
 * The enrolment form both `/u/second-factor` (an administrator reset) and
 * `/u/step-up` (no factor at all) fall back to: the `otpauth://` URI as a QR code,
 * the setup key and link that carry the same secret for anyone who cannot scan,
 * and the code the authenticator app shows back once added.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { QrSymbol } from "@sdxc/qr";
import type { Handle } from "remix/component";

import { QrCode } from "@sdxc/qr/component";
import { vstack } from "@sdxc/u/layout";
import { is, maxIs } from "@sdxc/u/size";
import { Alert, Button, Card, Text, TextField } from "@sdxc/ui";
import { css } from "remix/component";

export namespace EnrolTotpFactorPage {
	export interface Props {
		t: Translate;
		title: string;
		body: string;
		/** Where the form posts back to, carrying the interaction id in its query. */
		action: string;
		enrolmentId: string;
		uri: string;
		/** The encoded `uri`, or `null` when encoding failed and the key and link stand alone. */
		qr: QrSymbol | null;
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
		let { t, title, body, action, enrolmentId, uri, qr, setupKey, codeLabel, submitLabel, error } =
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

					{qr && (
						<QrCode
							symbol={qr}
							label={t("hostedSecondFactor.enrol.qrLabel")}
							mix={[css({ alignSelf: "center" })]}
						/>
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
							// oxlint-disable-next-line jsx-a11y/no-autofocus -- The page exists to collect this one code, so focus belongs in the field the moment it renders rather than a tab away.
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
