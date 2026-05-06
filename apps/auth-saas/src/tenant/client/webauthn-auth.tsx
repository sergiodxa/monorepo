import type { Handle } from "remix/ui";

import { clientEntry, css } from "remix/ui";

interface WebAuthnAuthSetup {
	challengeId: string;
	options: PublicKeyCredentialRequestOptionsJSON;
	verifyUrl: string;
}

interface WebAuthnAuthProps extends WebAuthnAuthSetup {
	email: string;
}

export let WebAuthnAuth = clientEntry(
	"/assets/tenant/webauthn-auth.js#WebAuthnAuth",
	function WebAuthnAuth(handle: Handle<WebAuthnAuthProps>) {
		let { challengeId, options, verifyUrl } = handle.props;
		let status: "idle" | "authenticating" | "error" | "success" = "idle";
		let errorMessage: string | null = null;

		async function authenticate() {
			status = "authenticating";
			errorMessage = null;
			handle.update();

			try {
				// Use the modern API that handles base64url encoding automatically
				let credential = await navigator.credentials.get({
					publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(options),
				});

				if (!credential) {
					throw new Error("Authentication was cancelled");
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
					throw new Error(errData.error ?? "Authentication failed");
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
				errorMessage = error instanceof Error ? error.message : "Authentication failed";
				handle.update();
			}
		}

		// Start authentication immediately on mount
		handle.queueTask(() => {
			authenticate();
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
					Signing in as <strong>{handle.props.email}</strong>
				</p>

				{status === "idle" && <p>Preparing authentication...</p>}

				{status === "authenticating" && (
					<div mix={[css({ textAlign: "center" })]}>
						<p>Use your passkey to continue</p>
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
							on={{ click: () => authenticate() }}
							mix={[
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
