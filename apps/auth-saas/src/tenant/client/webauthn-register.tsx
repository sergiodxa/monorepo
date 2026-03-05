import type { Handle } from "remix/component";

import { clientEntry } from "remix/component";

interface WebAuthnRegisterSetup {
	challengeId: string;
	options: PublicKeyCredentialCreationOptionsJSON;
	verifyUrl: string;
}

export let WebAuthnRegister = clientEntry(
	"/assets/tenant/webauthn-register.js#WebAuthnRegister",
	function WebAuthnRegister(handle: Handle, setup: unknown) {
		let { challengeId, options, verifyUrl } = setup as WebAuthnRegisterSetup;
		let status: "idle" | "registering" | "error" | "success" = "idle";
		let errorMessage: string | null = null;

		async function register() {
			status = "registering";
			errorMessage = null;
			handle.update();

			try {
				// Use the modern API that handles base64url encoding automatically
				let credential = await navigator.credentials.create({
					publicKey: PublicKeyCredential.parseCreationOptionsFromJSON(options),
				});

				if (!credential) {
					throw new Error("Registration was cancelled");
				}

				// Use toJSON() for automatic serialization
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

				// Success - follow the redirect from server
				let successData = (await res.json()) as { redirect?: string };

				status = "success";
				handle.update();

				if (successData.redirect) {
					window.location.href = successData.redirect;
				}
			} catch (error) {
				status = "error";
				errorMessage = error instanceof Error ? error.message : "Registration failed";
				handle.update();
			}
		}

		// Start registration immediately on mount
		handle.queueTask(() => {
			register();
		});

		return (props: { email: string }) => (
			<div
				css={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					gap: "1rem",
					padding: "2rem",
				}}
			>
				<p>
					Creating passkey for <strong>{props.email}</strong>
				</p>

				{status === "idle" && <p>Preparing registration...</p>}

				{status === "registering" && (
					<div css={{ textAlign: "center" }}>
						<p>Follow your device prompts to create a passkey</p>
						<div
							css={{
								marginTop: "1rem",
								width: "24px",
								height: "24px",
								border: "2px solid #3B82F6",
								borderTopColor: "transparent",
								borderRadius: "50%",
								animation: "spin 1s linear infinite",
								margin: "0 auto",
							}}
						/>
					</div>
				)}

				{status === "error" && (
					<div css={{ textAlign: "center" }}>
						<p css={{ color: "#EF4444" }}>{errorMessage}</p>
						<button
							type="button"
							on={{ click: () => register() }}
							css={{
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
							}}
						>
							Try Again
						</button>
					</div>
				)}

				{status === "success" && <p css={{ color: "#10B981" }}>Success! Redirecting...</p>}
			</div>
		);
	},
);
