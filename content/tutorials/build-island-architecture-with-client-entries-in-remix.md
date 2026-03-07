---
title: How to Build Island Architecture with Client Entries in Remix
excerpt: Create interactive component islands that hydrate independently for better performance.
tech: remix@3.0.0
---

Island architecture splits your UI into isolated interactive components surrounded by static server-rendered HTML. Instead of hydrating the entire page, only the components that need interactivity load their JavaScript. This reduces bundle sizes, speeds up Time to Interactive, and keeps most of your page as pure HTML.

Consider an authentication page for a SaaS application. The layout, branding, and form labels are static. Only the WebAuthn authentication component needs JavaScript to interact with the browser's credential API. Making that one component an island means users download and execute JavaScript only for what they need, while the surrounding page remains as plain HTML with zero client-side overhead.

## Create a Client Entry Component

The `clientEntry` function takes two arguments: a path to the compiled JavaScript file and the component function itself. The path tells Remix where to find the client bundle for this component.

```tsx {% path="src/client/counter.tsx" %}
import type { Handle } from "remix/component";

import { clientEntry } from "remix/component";

export let Counter = clientEntry(
	"/assets/counter.js#Counter",
	function Counter(handle: Handle, setup: unknown) {
		let count = 0;

		return () => (
			<div>
				<p>Count: {count}</p>
				<button
					type="button"
					on={{
						click: () => {
							count++;
							handle.update();
						},
					}}
				>
					Increment
				</button>
			</div>
		);
	},
);
```

The component function receives a `Handle` object and an optional `setup` value. The handle provides methods to control the component lifecycle, most importantly `update()` which triggers a re-render. The setup value lets you pass initial data from the server.

Notice the `on` prop for event handlers instead of the usual `onClick`. This is Remix's component syntax for attaching client-side event listeners that only work after hydration.

## Pass Server Data to the Client

The `setup` prop allows you to pass data from the server to the client component. This is useful when the component needs information that was computed server-side, like API tokens, configuration, or initial state.

```tsx {% path="src/client/webauthn-auth.tsx" %}
import type { Handle } from "remix/component";

import { clientEntry } from "remix/component";

interface WebAuthnAuthSetup {
	challengeId: string;
	options: PublicKeyCredentialRequestOptionsJSON;
	verifyUrl: string;
}

export let WebAuthnAuth = clientEntry(
	"/assets/webauthn-auth.js#WebAuthnAuth",
	function WebAuthnAuth(handle: Handle, setup: unknown) {
		let { challengeId, options, verifyUrl } = setup as WebAuthnAuthSetup;
		let status: "idle" | "authenticating" | "error" | "success" = "idle";
		let errorMessage: string | null = null;

		async function authenticate() {
			status = "authenticating";
			errorMessage = null;
			handle.update();

			try {
				let credential = await navigator.credentials.get({
					publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(options),
				});

				if (!credential) {
					throw new Error("Authentication was cancelled");
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
					throw new Error(errData.error ?? "Authentication failed");
				}

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

		handle.queueTask(() => {
			authenticate();
		});

		return (props: { email: string }) => (
			<div>
				<p>
					Signing in as <strong>{props.email}</strong>
				</p>

				{status === "idle" && <p>Preparing authentication...</p>}
				{status === "authenticating" && <p>Use your passkey to continue</p>}
				{status === "error" && (
					<div>
						<p>{errorMessage}</p>
						<button type="button" on={{ click: () => authenticate() }}>
							Try Again
						</button>
					</div>
				)}
				{status === "success" && <p>Success! Redirecting...</p>}
			</div>
		);
	},
);
```

The `handle.queueTask()` method schedules work to run after the component mounts on the client. This is similar to `useEffect` in traditional React, letting you start async operations once the component is interactive.

## Render Islands in Server Pages

Import your client entry component and use it like any other React component. Pass the `setup` prop with server-computed data and regular props for the component's render function.

```tsx {% path="src/controllers/login.tsx" %}
import { ok } from "@pkg/http/response/html";
import { renderToString } from "remix/component/server";

import { WebAuthnAuth } from "~/client/webauthn-auth";
import { Layout } from "~/components/layout";

export async function loader(request: Request, env: Cloudflare.Env) {
	let challenge = await createWebAuthnChallenge(env);

	let html = renderToString(
		<Layout>
			<div>
				<h1>Sign in to your account</h1>

				<WebAuthnAuth
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
					<p>JavaScript is required for passkey authentication.</p>
				</noscript>
			</div>
		</Layout>,
	);

	return ok(html);
}
```

The `<noscript>` fallback is important for accessibility. When JavaScript is disabled or fails to load, users see a clear message instead of a broken interface. For critical flows, you might provide an alternative HTML-only fallback.

## Manage Component State with Plain Variables

Client entry components use plain variables for state instead of hooks. The closure captures these variables, and calling `handle.update()` re-renders the component with the current values.

```tsx {% path="src/client/form-validator.tsx" %}
import type { Handle } from "remix/component";

import { clientEntry } from "remix/component";

interface ValidationSetup {
	rules: Record<string, (value: string) => string | null>;
}

export let FormValidator = clientEntry(
	"/assets/form-validator.js#FormValidator",
	function FormValidator(handle: Handle, setup: unknown) {
		let { rules } = setup as ValidationSetup;
		let errors: Record<string, string | null> = {};
		let touched: Record<string, boolean> = {};

		function validate(field: string, value: string) {
			let rule = rules[field];
			if (rule) {
				errors[field] = rule(value);
				handle.update();
			}
		}

		function markTouched(field: string) {
			touched[field] = true;
			handle.update();
		}

		return (props: { children: (api: FormApi) => JSX.Element }) => {
			let api: FormApi = {
				errors,
				touched,
				validate,
				markTouched,
				hasErrors: Object.values(errors).some((e) => e !== null),
			};

			return props.children(api);
		};
	},
);

interface FormApi {
	errors: Record<string, string | null>;
	touched: Record<string, boolean>;
	validate: (field: string, value: string) => void;
	markTouched: (field: string) => void;
	hasErrors: boolean;
}
```

This pattern gives you fine-grained control over re-renders. The component only updates when you explicitly call `handle.update()`, avoiding the overhead of React's reconciliation for state changes that do not affect the UI.

## Configure the Build for Client Entries

Your bundler needs to compile the client entry components as separate chunks. The path in `clientEntry()` must point to the actual compiled JavaScript file that will be served to browsers.

```ts {% path="vite.config.ts" %}
import { defineConfig } from "vite";
import remix from "@remix-run/dev";

export default defineConfig({
	plugins: [remix()],
	build: {
		rollupOptions: {
			input: {
				main: "src/entry.client.tsx",
				counter: "src/client/counter.tsx",
				"webauthn-auth": "src/client/webauthn-auth.tsx",
				"form-validator": "src/client/form-validator.tsx",
			},
			output: {
				entryFileNames: "assets/[name].js",
			},
		},
	},
});
```

Each client entry needs its own entry point in the build configuration. The output filenames must match the paths you specified in the `clientEntry()` calls.

## Handle Loading States Before Hydration

Islands hydrate asynchronously after the initial HTML loads. During this gap, the component is visible but not interactive. You can handle this with CSS that changes after hydration.

```tsx {% path="src/client/async-button.tsx" %}
import type { Handle } from "remix/component";

import { clientEntry } from "remix/component";

export let AsyncButton = clientEntry(
	"/assets/async-button.js#AsyncButton",
	function AsyncButton(handle: Handle) {
		let loading = false;

		return (props: { action: () => Promise<void>; children: string }) => (
			<button
				type="button"
				disabled={loading}
				data-hydrated="true"
				on={{
					click: async () => {
						loading = true;
						handle.update();
						await props.action();
						loading = false;
						handle.update();
					},
				}}
			>
				{loading ? "Loading..." : props.children}
			</button>
		);
	},
);
```

```css {% path="src/styles/button.css" %}
button:not([data-hydrated]) {
	cursor: wait;
	opacity: 0.7;
}

button[data-hydrated] {
	cursor: pointer;
	opacity: 1;
}
```

The server renders the button without the `data-hydrated` attribute since event handlers do not run during SSR. After hydration, the client component adds the attribute, and the CSS updates accordingly.

## Combine Multiple Islands on One Page

A page can have multiple independent islands. Each loads and hydrates separately, so a slow component does not block others.

```tsx {% path="src/controllers/dashboard.tsx" %}
import { ok } from "@pkg/http/response/html";
import { renderToString } from "remix/component/server";

import { LiveChart } from "~/client/live-chart";
import { NotificationBell } from "~/client/notification-bell";
import { SearchBar } from "~/client/search-bar";
import { Layout } from "~/components/layout";

export async function loader(request: Request, env: Cloudflare.Env) {
	let data = await loadDashboardData(env);

	let html = renderToString(
		<Layout>
			<header>
				<h1>Dashboard</h1>
				<SearchBar setup={{ endpoint: "/api/search" }} />
				<NotificationBell setup={{ userId: data.userId }} />
			</header>

			<main>
				<section>
					<h2>Analytics</h2>
					<LiveChart
						setup={{
							dataUrl: "/api/analytics",
							refreshInterval: 30000,
						}}
					/>
				</section>

				<section>
					<h2>Recent Activity</h2>
					{/* Static server-rendered list */}
					<ul>
						{data.activities.map((activity) => (
							<li key={activity.id}>{activity.description}</li>
						))}
					</ul>
				</section>
			</main>
		</Layout>,
	);

	return ok(html);
}
```

The search bar, notification bell, and live chart each hydrate independently. The recent activity list stays as static HTML with no JavaScript cost. Users can interact with whichever island loads first while others are still hydrating.

## Final Thoughts

Island architecture works best when most of your page is static content with isolated pockets of interactivity. Authentication flows, comment sections, search autocomplete, interactive charts, or media players are perfect candidates. The surrounding page layout, navigation, and content remain as plain HTML.

Full hydration still makes sense when your entire page is interactive: dashboards with live data, collaborative editing tools, or complex forms with dependent fields. In those cases, you need React running everywhere, and the overhead of hydrating the whole page is justified.

The performance gains from islands compound on slower devices and connections. A page with 50KB of JavaScript for a single island is faster than a page with 200KB for full hydration, even if the HTML is identical.
