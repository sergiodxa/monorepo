import { clientEntry, type Handle } from "remix/component";

interface RegistrationOptions {
	challenge: string;
	rp: {
		id: string;
		name: string;
	};
	user: {
		id: string;
		name: string;
		displayName: string;
	};
	pubKeyCredParams: Array<{
		alg: number;
		type: "public-key";
	}>;
	timeout?: number;
	attestation?: AttestationConveyancePreference;
	authenticatorSelection?: AuthenticatorSelectionCriteria;
}

interface WebAuthnRegisterSetup {
	challengeId: string;
	options: RegistrationOptions;
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
				// Convert base64url values to ArrayBuffer
				let challenge = base64urlToBuffer(options.challenge);
				let userId = base64urlToBuffer(options.user.id);

				let credential = (await navigator.credentials.create({
					publicKey: {
						challenge,
						rp: options.rp,
						user: {
							id: userId,
							name: options.user.name,
							displayName: options.user.displayName,
						},
						pubKeyCredParams: options.pubKeyCredParams,
						timeout: options.timeout ?? 60000,
						attestation: options.attestation ?? "none",
						authenticatorSelection: options.authenticatorSelection ?? {
							authenticatorAttachment: "platform",
							residentKey: "preferred",
							userVerification: "preferred",
						},
					},
				})) as PublicKeyCredential | null;

				if (!credential) {
					throw new Error("Registration was cancelled");
				}

				let response = credential.response as AuthenticatorAttestationResponse;

				// Submit credential to server
				let formData = new FormData();
				formData.append("challengeId", challengeId);
				formData.append(
					"credential",
					JSON.stringify({
						id: credential.id,
						rawId: bufferToBase64url(credential.rawId),
						response: {
							clientDataJSON: bufferToBase64url(response.clientDataJSON),
							attestationObject: bufferToBase64url(response.attestationObject),
							transports: response.getTransports?.() ?? [],
						},
						type: credential.type,
						authenticatorAttachment: credential.authenticatorAttachment,
					}),
				);

				let res = await fetch(verifyUrl, {
					method: "POST",
					body: formData,
				});

				if (!res.ok) {
					let errData = (await res.json()) as { error?: string };
					throw new Error(errData.error ?? "Registration failed");
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
