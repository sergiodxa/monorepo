/**
 * Client-side WebAuthn registration component for the passkey enrollment flow.
 *
 * Hydrates in the browser, immediately invokes `navigator.credentials.create`
 * with the server-issued creation options, posts the new credential back for
 * verification, and follows the returned redirect on success.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, SerializableObject } from "remix/ui";

import { clientEntry, css, on } from "remix/ui";

/**
 * Props for the client entry. Declared as a `type` (not an interface) with only
 * serializable members so it satisfies the `SerializableProps` constraint that
 * `clientEntry` requires for hydration payloads.
 */
type WebAuthnRegisterProps = {
	challengeId: string;
	/** Serialized creation options forwarded to the browser WebAuthn API. */
	options: PublicKeyCredentialCreationOptionsJSON & SerializableObject;
	verifyUrl: string;
	email: string;
};

/**
 * Hydratable client entry that drives passkey registration in the browser.
 *
 * Renders enrollment progress/error UI and starts the WebAuthn `create` ceremony
 * on mount, redirecting to the server-provided URL once the credential verifies.
 */
export let WebAuthnRegister = clientEntry(
	"/assets/tenant/webauthn-register.js#WebAuthnRegister",
	function WebAuthnRegister(handle: Handle<WebAuthnRegisterProps>) {
		let { challengeId, options, verifyUrl } = handle.props;
		let status: "idle" | "registering" | "error" | "success" = "idle";
		let errorMessage: string | null = null;

		async function register() {
			status = "registering";
			errorMessage = null;
			await handle.update();

			try {
				let credential = await navigator.credentials.create({
					publicKey: PublicKeyCredential.parseCreationOptionsFromJSON(options),
				});

				if (!credential) {
					throw new Error("Registration was cancelled");
				}

				let res = await fetch(verifyUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						challengeId,
						response: (credential as PublicKeyCredential).toJSON(),
					}),
				});

				if (!res.ok) {
					let errData = (await res.json()) as { error?: string };
					throw new Error(errData.error ?? "Registration failed");
				}

				let successData = (await res.json()) as { redirect?: string };

				status = "success";
				await handle.update();

				if (successData.redirect) {
					window.location.href = successData.redirect;
				}
			} catch (error) {
				status = "error";
				errorMessage = error instanceof Error ? error.message : "Registration failed";
				await handle.update();
			}
		}

		handle.queueTask(() => {
			void register();
		});

		return () => (
			<div
				mix={[
					css({
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						gap: "1rem",
						padding: "2rem",
					}),
				]}
			>
				<p>
					Creating passkey for <strong>{handle.props.email}</strong>
				</p>

				{status === "idle" && <p>Preparing registration...</p>}

				{status === "registering" && (
					<div mix={[css({ textAlign: "center" })]}>
						<p>Follow your device prompts to create a passkey</p>
						<div
							mix={[
								css({
									marginTop: "1rem",
									width: "24px",
									height: "24px",
									border: "2px solid #3B82F6",
									borderTopColor: "transparent",
									borderRadius: "50%",
									animation: "spin 1s linear infinite",
									margin: "0 auto",
								}),
							]}
						/>
					</div>
				)}

				{status === "error" && (
					<div mix={[css({ textAlign: "center" })]}>
						<p mix={[css({ color: "#EF4444" })]}>{errorMessage}</p>
						<button
							type="button"
							mix={[
								on("click", () => register()),
								css({
									marginTop: "1rem",
									padding: "0.5rem 1rem",
									backgroundColor: "#3B82F6",
									color: "white",
									border: "none",
									borderRadius: "0.375rem",
									cursor: "pointer",
									"&:hover": {
										backgroundColor: "#2563EB",
									},
								}),
							]}
						>
							Try Again
						</button>
					</div>
				)}

				{status === "success" && <p mix={[css({ color: "#10B981" })]}>Success! Redirecting...</p>}
			</div>
		);
	},
);
