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
								// First try to register (new user)
								let response = await fetch('/onboarding/webauthn/register/options', {
									method: 'POST',
									headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
									body: new URLSearchParams({ email }),
								});

								if (response.ok) {
									const data = await response.json();
									console.log('Registration options:', data);
									const regResponse = await SimpleWebAuthnBrowser.startRegistration(data.options);

									const verifyResponse = await fetch('/onboarding/webauthn/register/verify', {
										method: 'POST',
										headers: { 'Content-Type': 'application/json' },
										body: JSON.stringify({ challengeId: data.challengeId, response: regResponse }),
									});

									if (verifyResponse.ok) {
										window.location.href = '/dashboard';
										return;
									} else {
										const errorData = await verifyResponse.json();
										throw new Error(errorData.error || 'Registration failed');
									}
								}

								// Registration failed (user exists with passkey), try to authenticate
								const regError = await response.json();
								if (regError.error && regError.error.includes('passkey')) {
									response = await fetch('/onboarding/webauthn/auth/options', {
										method: 'POST',
										headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
										body: new URLSearchParams({ email }),
									});

									if (response.ok) {
										const data = await response.json();
										console.log('Authentication options:', data);
										const authResponse = await SimpleWebAuthnBrowser.startAuthentication(data.options);

										const verifyResponse = await fetch('/onboarding/webauthn/auth/verify', {
											method: 'POST',
											headers: { 'Content-Type': 'application/json' },
											body: JSON.stringify({ challengeId: data.challengeId, response: authResponse }),
										});

										if (verifyResponse.ok) {
											window.location.href = '/dashboard';
											return;
										} else {
											const errorData = await verifyResponse.json();
											throw new Error(errorData.error || 'Authentication failed');
										}
									}
								}

								throw new Error(regError.error || 'Could not continue');
							} catch (err) {
								console.error('WebAuthn error:', err);
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
