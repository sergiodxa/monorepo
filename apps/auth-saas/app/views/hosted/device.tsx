/**
 * The `/device` screen's own two states around the consent screen it shares
 * with `/u/consent`: the plain code-entry form a person lands on with nothing
 * yet typed, and the confirmation a decision leaves them on once the code is
 * resolved either way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Handle } from "remix/component";

import { vstack } from "@sdxc/u/layout";
import { is, maxIs } from "@sdxc/u/size";
import { textAlign } from "@sdxc/u/typography";
import { Alert, Button, Card, Text, TextField } from "@sdxc/ui";

export namespace DeviceCodePage {
	export interface Props {
		t: Translate;
		/** Where the code submits to: a plain `GET`, so the browser carries it forward as `?user_code=`. */
		action: string;
		defaultUserCode: string | null;
		error: string | null;
	}
}

/**
 * Renders the plain form asking for the code a device is showing, prefilled
 * when one already arrived on the query string.
 *
 * @param handle - Component handle exposing the screen's props.
 * @returns A render function producing the code-entry screen's markup.
 */
export function DeviceCodePage(handle: Handle<DeviceCodePage.Props>) {
	return () => {
		let { t, action, defaultUserCode, error } = handle.props;

		return (
			<Card mix={[is("100%"), maxIs("24rem")]}>
				<Card.Header>
					<Card.Title>{t("hostedDevice.title")}</Card.Title>
					<Card.Description>{t("hostedDevice.body")}</Card.Description>
				</Card.Header>

				<Card.Content mix={[vstack({ gap: 4 })]}>
					{error && (
						<Alert color="danger">
							<Alert.Content>{error}</Alert.Content>
						</Alert>
					)}

					<form method="get" action={action} mix={[vstack({ gap: 4 })]}>
						<TextField
							label={t("hostedDevice.codeLabel")}
							name="user_code"
							type="text"
							required
							autoComplete="off"
							defaultValue={defaultUserCode ?? undefined}
						/>

						<Button type="submit" color="brand" mix={[is("100%")]}>
							{t("hostedDevice.submit")}
						</Button>
					</form>
				</Card.Content>
			</Card>
		);
	};
}

export namespace DeviceDonePage {
	export interface Props {
		t: Translate;
		approved: boolean;
	}
}

/**
 * Renders the confirmation a device's own approve/deny decision leaves a
 * person on, once it is recorded.
 *
 * @param handle - Component handle exposing the screen's props.
 * @returns A render function producing the confirmation screen's markup.
 */
export function DeviceDonePage(handle: Handle<DeviceDonePage.Props>) {
	return () => {
		let { t, approved } = handle.props;

		return (
			<Card mix={[is("100%"), maxIs("24rem")]}>
				<Card.Header>
					<Card.Title>
						{approved ? t("hostedDevice.done.approvedTitle") : t("hostedDevice.done.deniedTitle")}
					</Card.Title>
				</Card.Header>

				<Card.Content>
					<Text mix={[textAlign("center")]}>
						{approved ? t("hostedDevice.done.approvedBody") : t("hostedDevice.done.deniedBody")}
					</Text>
				</Card.Content>
			</Card>
		);
	};
}
