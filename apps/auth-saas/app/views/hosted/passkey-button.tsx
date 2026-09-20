/**
 * The one hydrated island a hosted screen needs: a passkey ceremony has no
 * markup-only form, so this button runs it in the browser and degrades to nothing
 * more than a plain button when the script never loads — the password form beside
 * it stays reachable either way. Copy is passed in as already-translated props,
 * the same way every `@sdxc/ui` example takes its strings, so the island carries
 * no i18n runtime of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { Passkey } from "@sdxc/passkey/client";
import { isFailure } from "@sdxc/result";
import { is } from "@sdxc/u/size";
import { Alert, Button } from "@sdxc/ui";
import * as s from "remix/data-schema";
import { clientEntry, on } from "remix/ui";

/** `beginPasskeyAuthentication`'s JSON answer: a ceremony id and the options to run it with. */
const OptionsResponseSchema = s.object({
	ceremonyId: s.string(),
	options: s.record(s.string(), s.any()),
});

/** The verify endpoint's JSON answer: where to go next, or why the ceremony was refused. */
const VerifyResponseSchema = s.union([
	s.object({ redirect: s.string() }),
	s.object({ error: s.string() }),
]);

/** Props must be a `type` (not `interface`) to satisfy `SerializableProps`. */
export type PasskeySignInButtonProps = {
	optionsAction: string;
	verifyAction: string;
	label: string;
	pendingLabel: string;
	errorMessage: string;
	unsupportedMessage: string;
};

/**
 * Runs a usernameless passkey authentication ceremony on click: fetches the
 * ceremony's options, runs it through the platform's credentials API, posts the
 * assertion back, and follows the redirect the verify endpoint answers with.
 */
export const PasskeySignInButton = clientEntry(
	"/app/views/hosted/passkey-button.tsx#PasskeySignInButton",
	function PasskeySignInButton(handle: Handle<PasskeySignInButtonProps>) {
		let pending = false;
		let error: string | null = null;

		return () => {
			let { optionsAction, verifyAction, label, pendingLabel, errorMessage, unsupportedMessage } =
				handle.props;

			return (
				<div mix={[is("100%")]}>
					{error && (
						<Alert color="danger">
							<Alert.Content>{error}</Alert.Content>
						</Alert>
					)}

					<Button
						type="button"
						color="neutral"
						isPending={pending}
						disabled={pending}
						mix={[
							is("100%"),
							on("click", async () => {
								if (!Passkey.isSupported()) {
									error = unsupportedMessage;
									void handle.update();
									return;
								}

								error = null;
								pending = true;
								void handle.update();

								let signal = handle.signal;

								try {
									let optionsResponse = await fetch(optionsAction, {
										method: "POST",
										credentials: "same-origin",
										headers: { accept: "application/json" },
										signal,
									});
									if (!optionsResponse.ok) throw new Error("options request failed");

									let { ceremonyId, options } = s.parse(
										OptionsResponseSchema,
										await optionsResponse.json(),
									);

									let ceremony = await Passkey.authenticate(
										options as unknown as PublicKeyCredentialRequestOptionsJSON,
										{ signal },
									);
									if (isFailure(ceremony)) {
										error = errorMessage;
										return;
									}

									let verifyResponse = await fetch(verifyAction, {
										method: "POST",
										credentials: "same-origin",
										headers: { "content-type": "application/json", accept: "application/json" },
										body: JSON.stringify({ ceremonyId, response: ceremony.data }),
										signal,
									});

									let verified = s.parse(VerifyResponseSchema, await verifyResponse.json());

									if ("redirect" in verified) {
										location.href = verified.redirect;
										return;
									}

									error = errorMessage;
								} catch {
									error = errorMessage;
								} finally {
									pending = false;
									void handle.update();
								}
							}),
						]}
					>
						{pending ? pendingLabel : label}
					</Button>
				</div>
			);
		};
	},
);

export default PasskeySignInButton;
