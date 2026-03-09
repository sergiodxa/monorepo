---
title: How to Build Island Architecture with Client Entries in Remix
excerpt: Build a login page where only the passkey prompt hydrates on the client.
tech: remix@3.0.0
---

Island architecture works well when most of a page is static HTML and only one part needs browser APIs. A login page is a good fit because the layout, copy, and form chrome can stay on the server while the passkey prompt hydrates on demand.

In this tutorial, you will build that flow with Remix client entries. The result is a server rendered login page with one interactive island that starts WebAuthn after hydration.

## Create the Passkey Island

```tsx {% path="app/client/passkey-sign-in.tsx" %}
import type { Handle } from "remix/component";

import { clientEntry } from "remix/component";

interface PasskeySignInSetup {
	challengeId: string;
	options: PublicKeyCredentialRequestOptionsJSON;
	verifyUrl: string;
}

interface PasskeySignInProps {
	email: string;
}

export let PasskeySignIn = clientEntry(
	"/assets/passkey-sign-in.js#PasskeySignIn",
	function PasskeySignIn(handle: Handle, setup: unknown) {
		let { challengeId, options, verifyUrl } = setup as PasskeySignInSetup;
		let status: "idle" | "authenticating" | "error" | "success" = "idle";
		let errorMessage: string | null = null;

		async function authenticate() {
			status = "authenticating";
			errorMessage = null;
			handle.update();

			let credential = await navigator.credentials.get({
				publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(options),
			});

			if (!credential) {
				status = "error";
				errorMessage = "Authentication was canceled";
				handle.update();
				return;
			}

			let response = await fetch(verifyUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					challengeId,
					response: (credential as PublicKeyCredential).toJSON(),
				}),
			});

			if (!response.ok) {
				let data = (await response.json()) as { error?: string };
				status = "error";
				errorMessage = data.error ?? "Authentication failed";
				handle.update();
				return;
			}

			let data = (await response.json()) as { redirect?: string };
			status = "success";
			handle.update();

			if (data.redirect) {
				window.location.href = data.redirect;
			}
		}

		handle.queueTask(() => {
			authenticate();
		});

		return function PasskeySignIn(props: PasskeySignInProps) {
			return (
				<div>
					<p>
						Signing in as <strong>{props.email}</strong>
					</p>

					{status === "idle" && <p>Preparing passkey prompt...</p>}
					{status === "authenticating" && <p>Use your passkey to continue.</p>}
					{status === "error" && (
						<div>
							<p>{errorMessage}</p>
							<button type="button" on={{ click: () => authenticate() }}>
								Try Again
							</button>
						</div>
					)}
					{status === "success" && <p>Success. Redirecting...</p>}
				</div>
			);
		};
	},
);
```

This file is the island. `clientEntry` registers a separately built client bundle, and `handle.update()` re-renders when local variables change.

## Render the Island From the Login Page

```tsx {% path="app/routes/login.tsx" %}
import { ok } from "@pkg/http/response/html";
import { renderToString } from "remix/component/server";

import { PasskeySignIn } from "~/client/passkey-sign-in";
import { Layout } from "~/components/layout";

export async function loader(request: Request, env: Cloudflare.Env) {
	let challenge = await createWebAuthnChallenge(env);

	let html = renderToString(
		<Layout>
			<div>
				<h1>Sign In to Your Account</h1>
				<p>Use the passkey saved for {challenge.email}.</p>

				<PasskeySignIn
					email={challenge.email}
					setup={{
						challengeId: challenge.id,
						options: {
							challenge: challenge.challenge,
							rpId: challenge.rpId,
							allowCredentials: challenge.credentials,
							timeout: 60000,
							userVerification: "preferred",
						},
						verifyUrl: "/api/webauthn/verify",
					}}
				/>

				<noscript>
					<p>JavaScript is required for passkey sign in.</p>
				</noscript>
			</div>
		</Layout>,
	);

	return ok(html);
}
```

The page stays server rendered. Only `PasskeySignIn` hydrates, and the `setup` prop passes the server generated challenge into the client entry.

## Post the Verification Result

```tsx {% path="app/routes/api.webauthn.verify.tsx" %}
import { json } from "@pkg/http/response/json";

export async function action(request: Request, env: Cloudflare.Env) {
	let body = (await request.json()) as {
		challengeId: string;
		response: ReturnType<PublicKeyCredential["toJSON"]>;
	};

	let result = await verifyWebAuthnResponse(env, body);

	if (!result.ok) {
		return json({ error: "We could not verify that passkey." }, { status: 401 });
	}

	return json({ redirect: "/dashboard" });
}
```

The island only needs a URL that accepts the credential response. Returning JSON keeps the client entry small because it only handles success, retry, and redirect.

## Build the Client Entry Bundle

```ts {% path="vite.config.ts" %}
import remix from "@remix-run/dev";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [remix()],
	build: {
		rollupOptions: {
			input: {
				main: "app/entry.client.tsx",
				"passkey-sign-in": "app/client/passkey-sign-in.tsx",
			},
			output: {
				entryFileNames: "assets/[name].js",
			},
		},
	},
});
```

The generated file name must match the path passed to `clientEntry`. That is what lets Remix load only the island bundle instead of hydrating the whole page.

## Refine the Island Without Adding Hooks

```tsx {% path="app/client/passkey-sign-in.tsx" %}
import type { Handle } from "remix/component";

import { clientEntry } from "remix/component";

interface PasskeySignInSetup {
	challengeId: string;
	options: PublicKeyCredentialRequestOptionsJSON;
	verifyUrl: string;
}

interface PasskeySignInProps {
	email: string;
}

export let PasskeySignIn = clientEntry(
	"/assets/passkey-sign-in.js#PasskeySignIn",
	function PasskeySignIn(handle: Handle, setup: unknown) {
		let { challengeId, options, verifyUrl } = setup as PasskeySignInSetup;
		let status: "idle" | "authenticating" | "error" | "success" = "idle";
		let errorMessage: string | null = null;
		let canRetry = false;

		async function authenticate() {
			status = "authenticating";
			errorMessage = null;
			canRetry = false;
			handle.update();

			let credential = await navigator.credentials.get({
				publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(options),
			});

			if (!credential) {
				status = "error";
				errorMessage = "Authentication was canceled";
				canRetry = true;
				handle.update();
				return;
			}

			let response = await fetch(verifyUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					challengeId,
					response: (credential as PublicKeyCredential).toJSON(),
				}),
			});

			if (!response.ok) {
				let data = (await response.json()) as { error?: string };
				status = "error";
				errorMessage = data.error ?? "Authentication failed";
				canRetry = true;
				handle.update();
				return;
			}

			let data = (await response.json()) as { redirect?: string };
			status = "success";
			handle.update();

			if (data.redirect) {
				window.location.href = data.redirect;
			}
		}

		handle.queueTask(() => {
			authenticate();
		});

		return function PasskeySignIn(props: PasskeySignInProps) {
			return (
				<div>
					<p>
						Signing in as <strong>{props.email}</strong>
					</p>

					{status === "idle" && <p>Preparing passkey prompt...</p>}
					{status === "authenticating" && <p>Use your passkey to continue.</p>}
					{status === "error" && (
						<div>
							<p>{errorMessage}</p>
							{canRetry && (
								<button type="button" on={{ click: () => authenticate() }}>
									Try Again
								</button>
							)}
						</div>
					)}
					{status === "success" && <p>Success. Redirecting...</p>}
				</div>
			);
		};
	},
);
```

This keeps state in plain variables. Client entries do not need React hooks because the closure holds state and `handle.update()` controls re-renders.

## Final Thoughts

You now have a login page where the shell stays static and only the passkey prompt hydrates on the client. You can extend this pattern to search boxes, comment forms, or other isolated UI that needs browser APIs without paying for full page hydration.
