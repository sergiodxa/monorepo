/**
 * The `/u/second-factor` screen's code-entry state: a sign-in that demanded the
 * factor a subject already holds, asking for a current code or a recovery code
 * with a "remember this device" checkbox.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@sdxc/i18n";
import type { Handle } from "remix/ui";

import { vstack } from "@sdxc/u/layout";
import { is, maxIs } from "@sdxc/u/size";
import { Alert, Button, Card, Checkbox, TextField } from "@sdxc/ui";

export namespace SecondFactorPage {
	export interface Props {
		t: TFunction;
		/** Where the form posts back to, carrying the interaction id in its query. */
		action: string;
		error: string | null;
	}
}

/**
 * Renders the second-factor code-entry form.
 *
 * @param handle - Component handle exposing the screen's props.
 * @returns A render function producing the second-factor screen's markup.
 */
export function SecondFactorPage(handle: Handle<SecondFactorPage.Props>) {
	return () => {
		let { t, action, error } = handle.props;

		return (
			<Card mix={[is("100%"), maxIs("24rem")]}>
				<Card.Header>
					<Card.Title>{t("hostedSecondFactor.title")}</Card.Title>
				</Card.Header>

				<Card.Content mix={[vstack({ gap: 4 })]}>
					{error && (
						<Alert color="danger">
							<Alert.Content>{error}</Alert.Content>
						</Alert>
					)}

					<form method="post" action={action} mix={[vstack({ gap: 4 })]}>
						<TextField
							label={t("hostedSecondFactor.codeLabel")}
							name="submission"
							type="text"
							required
							autoComplete="one-time-code"
							autoFocus
						/>

						<Checkbox name="trustDevice" value="true">
							{t("hostedSecondFactor.remember")}
						</Checkbox>

						<Button type="submit" color="brand" mix={[is("100%")]}>
							{t("hostedSecondFactor.submit")}
						</Button>
					</form>
				</Card.Content>
			</Card>
		);
	};
}
