import type { Handle } from "remix/component";

import { clientEntry } from "remix/component";

interface AuthOptions {
	challenge: string;
	rpId: string;
	allowCredentials: Array<{
		id: string;
		type: "public-key";
		transports?: AuthenticatorTransport[];
	}>;
	userVerification?: UserVerificationRequirement;
	timeout?: number;
}

interface WebAuthnAuthSetup {
	challengeId: string;
	options: AuthOptions;
	verifyUrl: string;
}

export let WebAuthnAuth = clientEntry(
	"/assets/tenant/webauthn-auth.js#WebAuthnAuth",
	function WebAuthnAuth(handle: Handle, setup: unknown) {
		let { challengeId, options, verifyUrl } = setup as WebAuthnAuthSetup;
		let status: "idle" | "authenticating" | "error" | "success" = "idle";
		let errorMessage: string | null = null;

		async function authenticate() {
			status = "authenticating";
			errorMessage = null;
			handle.update();

			try {
				// Convert base64url challenge to ArrayBuffer
				let challenge = base64urlToBuffer(options.challenge);

				// Convert credential IDs from base64url to ArrayBuffer
				let allowCreds = options.allowCredentials.map(
					(cred: { id: string; type: "public-key"; transports?: AuthenticatorTransport[] }) => ({
						id: base64urlToBuffer(cred.id),
						type: cred.type as PublicKeyCredentialType,
						transports: cred.transports,
					}),
				);

				let credential = (await navigator.credentials.get({
					publicKey: {
						challenge,
						rpId: options.rpId,
						allowCredentials: allowCreds,
						userVerification: options.userVerification ?? "preferred",
						timeout: options.timeout ?? 60000,
					},
				})) as PublicKeyCredential | null;

				if (!credential) {
					throw new Error("Authentication was cancelled");
				}

				let response = credential.response as AuthenticatorAssertionResponse;

				// Submit credential to server as JSON
				let res = await fetch(verifyUrl, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						challengeId,
						response: {
							id: credential.id,
							rawId: bufferToBase64url(credential.rawId),
							response: {
								clientDataJSON: bufferToBase64url(response.clientDataJSON),
								authenticatorData: bufferToBase64url(response.authenticatorData),
								signature: bufferToBase64url(response.signature),
								userHandle: response.userHandle ? bufferToBase64url(response.userHandle) : null,
							},
							type: credential.type,
							authenticatorAttachment: credential.authenticatorAttachment,
						},
					}),
				});

				if (!res.ok) {
					let errData = (await res.json()) as { error?: string };
					throw new Error(errData.error ?? "Authentication failed");
				}

				// Success - the server will redirect
				status = "success";
				handle.update();

				// Follow redirect
				let successData = (await res.json()) as { redirectUrl?: string };
				if (successData.redirectUrl) {
					window.location.href = successData.redirectUrl;
				}
			} catch (error) {
				status = "error";
				errorMessage = error instanceof Error ? error.message : "Authentication failed";
				handle.update();
			}
		}

		// Start authentication immediately on mount
		handle.queueTask(() => {
			authenticate();
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
					Signing in as <strong>{props.email}</strong>
				</p>

				{status === "idle" && <p>Preparing authentication...</p>}

				{status === "authenticating" && (
					<div css={{ textAlign: "center" }}>
						<p>Use your passkey to continue</p>
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
							on={{ click: () => authenticate() }}
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

// Helper functions for base64url encoding/decoding
function base64urlToBuffer(base64url: string): ArrayBuffer {
	let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
	let padding = "=".repeat((4 - (base64.length % 4)) % 4);
	let binary = atob(base64 + padding);
	let bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes.buffer;
}

function bufferToBase64url(buffer: ArrayBuffer): string {
	let bytes = new Uint8Array(buffer);
	let binary = String.fromCharCode(...bytes);
	let base64 = btoa(binary);
	return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
