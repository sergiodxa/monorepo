/**
 * The `/u/step-up` screen's code-entry state: a relying party's `acr_values=mfa`
 * demand, asking a session that already signed in for a fresh code or recovery
 * code before resuming.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@sdxc/i18n";
import type { Handle } from "remix/ui";

import { vstack } from "@sdxc/u/layout";
import { is, maxIs } from "@sdxc/u/size";
import { Alert, Button, Card, TextField } from "@sdxc/ui";

export namespace StepUpPage {
	export interface Props {
		t: TFunction;
		/** Where the form posts back to, carrying the interaction id in its query. */
		action: string;
		error: string | null;
	}
}

/**
 * Renders the step-up code-entry form.
 *
 * @param handle - Component handle exposing the screen's props.
 * @returns A render function producing the step-up screen's markup.
 */
export function StepUpPage(handle: Handle<StepUpPage.Props>) {
	return () => {
		let { t, action, error } = handle.props;

		return (
			<Card mix={[is("100%"), maxIs("24rem")]}>
				<Card.Header>
					<Card.Title>{t("hostedStepUp.title")}</Card.Title>
					<Card.Description>{t("hostedStepUp.body")}</Card.Description>
				</Card.Header>

				<Card.Content mix={[vstack({ gap: 4 })]}>
					{error && (
						<Alert color="danger">
							<Alert.Content>{error}</Alert.Content>
						</Alert>
					)}

					<form method="post" action={action} mix={[vstack({ gap: 4 })]}>
						<TextField
							label={t("hostedStepUp.codeLabel")}
							name="submission"
							type="text"
							required
							autoComplete="one-time-code"
							autoFocus
						/>

						<Button type="submit" color="brand" mix={[is("100%")]}>
							{t("hostedStepUp.submit")}
						</Button>
					</form>
				</Card.Content>
			</Card>
		);
	};
}
