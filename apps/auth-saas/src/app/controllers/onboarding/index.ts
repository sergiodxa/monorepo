import { html } from "@pkg/http/response";

import form from "~/lib/form";

/**
 * Onboarding landing page - users can sign up or log in here.
 * This uses the platform tenant for authentication.
 */
export default form<"/onboarding">({
	middleware: [],

	actions: {
		index({ logger }) {
			let log = logger.loader("/onboarding");
			log.info("Onboarding page loaded");

			return html(`
				<!DOCTYPE html>
				<html lang="en">
				<head>
					<meta charset="UTF-8">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
					<title>Auth SaaS - Get Started</title>
					<script src="https://cdn.tailwindcss.com"></script>
					<script src="https://unpkg.com/@simplewebauthn/browser/dist/bundle/index.umd.min.js"></script>
				</head>
				<body class="bg-gray-50 min-h-screen flex items-center justify-center">
					<div class="max-w-md w-full px-4">
						<div class="text-center mb-8">
							<h1 class="text-3xl font-bold">Auth SaaS</h1>
							<p class="text-gray-600 mt-2">Authentication as a service for your applications</p>
						</div>

						<div class="bg-white rounded-lg border shadow-sm p-6">
							<div id="auth-form">
								<div class="mb-4">
									<label class="block text-sm font-medium text-gray-700 mb-1" for="email">Email</label>
									<input type="email" id="email" name="email" required
										class="w-full border rounded-lg px-3 py-2"
										placeholder="you@example.com">
								</div>

								<button type="button" id="continue-btn"
									class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 mb-3">
									Continue with Passkey
								</button>

								<p class="text-center text-gray-500 text-sm">
									We use passkeys for passwordless authentication
								</p>
							</div>

							<div id="loading" class="hidden text-center py-4">
								<p class="text-gray-600">Authenticating...</p>
							</div>

							<div id="error" class="hidden text-center py-4">
								<p class="text-red-600" id="error-message"></p>
								<button type="button" id="retry-btn" class="mt-2 text-blue-600 hover:underline">
									Try again
								</button>
							</div>
						</div>
					</div>

					<script>
						const PLATFORM_TENANT_URL = '';

						document.getElementById('continue-btn').addEventListener('click', async () => {
							const email = document.getElementById('email').value;
							if (!email) {
								alert('Please enter your email');
								return;
							}

							const authForm = document.getElementById('auth-form');
							const loading = document.getElementById('loading');
							const error = document.getElementById('error');

							authForm.classList.add('hidden');
							loading.classList.remove('hidden');

							try {
								// First try to authenticate (existing user)
								let response = await fetch(PLATFORM_TENANT_URL + '/webauthn/auth/options', {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({ email }),
								});

								if (response.ok) {
									const options = await response.json();
									const authResponse = await SimpleWebAuthnBrowser.startAuthentication(options);

									const verifyResponse = await fetch(PLATFORM_TENANT_URL + '/webauthn/auth/verify', {
										method: 'POST',
										headers: { 'Content-Type': 'application/json' },
										body: JSON.stringify({ email, response: authResponse }),
									});

									if (verifyResponse.ok) {
										const result = await verifyResponse.json();
										// Set session cookie and redirect
										document.cookie = '__auth_session=' + result.sessionId + '; Path=/; SameSite=Lax';
										window.location.href = '/dashboard';
										return;
									}
								}

								// User doesn't exist, try to register
								response = await fetch(PLATFORM_TENANT_URL + '/webauthn/register/options', {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({ email }),
								});

								if (response.ok) {
									const options = await response.json();
									const regResponse = await SimpleWebAuthnBrowser.startRegistration(options);

									const verifyResponse = await fetch(PLATFORM_TENANT_URL + '/webauthn/register/verify', {
										method: 'POST',
										headers: { 'Content-Type': 'application/json' },
										body: JSON.stringify({ email, response: regResponse }),
									});

									if (verifyResponse.ok) {
										const result = await verifyResponse.json();
										document.cookie = '__auth_session=' + result.sessionId + '; Path=/; SameSite=Lax';
										window.location.href = '/dashboard';
										return;
									}
								}

								throw new Error('Authentication failed');
							} catch (err) {
								loading.classList.add('hidden');
								error.classList.remove('hidden');
								document.getElementById('error-message').textContent = err.message || 'Authentication failed';
							}
						});

						document.getElementById('retry-btn').addEventListener('click', () => {
							document.getElementById('error').classList.add('hidden');
							document.getElementById('auth-form').classList.remove('hidden');
						});
					</script>
				</body>
				</html>
			`);
		},

		action() {
			// Form submissions are handled client-side via WebAuthn
			return new Response(null, {
				status: 302,
				headers: { Location: "/onboarding" },
			});
		},
	},
});
