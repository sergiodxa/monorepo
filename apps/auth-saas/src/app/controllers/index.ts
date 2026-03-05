import { html } from "@pkg/http/response";

import routes from "~/app/routes";
import action from "~/lib/action";

/**
 * Landing page - marketing page for Auth SaaS
 */
export default action<"GET", "/">(({ logger }) => {
	logger.loader("/").info("Landing page loaded");

	return html(`
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Auth SaaS - Authentication as a Service</title>
			<script src="https://cdn.tailwindcss.com"></script>
		</head>
		<body class="bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
			<nav class="py-6">
				<div class="max-w-6xl mx-auto px-4 flex justify-between items-center">
					<h1 class="text-2xl font-bold text-gray-900">Auth SaaS</h1>
					<a href="${routes.onboarding.index.href()}" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
						Get Started
					</a>
				</div>
			</nav>

			<main class="max-w-6xl mx-auto px-4 py-16">
				<div class="text-center mb-16">
					<h2 class="text-5xl font-bold text-gray-900 mb-6">
						Authentication Made Simple
					</h2>
					<p class="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
						A fully-featured OIDC provider for your applications. 
						Passkey-first authentication, custom domains, and instant deployment.
					</p>
					<div class="flex gap-4 justify-center">
						<a href="${routes.onboarding.index.href()}" class="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-blue-700 transition-colors">
							Start Free
						</a>
						<a href="#features" class="bg-white text-gray-700 px-8 py-3 rounded-lg text-lg font-medium hover:bg-gray-50 border transition-colors">
							Learn More
						</a>
					</div>
				</div>

				<div id="features" class="grid md:grid-cols-3 gap-8 mb-16">
					<div class="bg-white rounded-xl p-6 shadow-sm">
						<div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
							<svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
							</svg>
						</div>
						<h3 class="text-lg font-semibold mb-2">Passkey Authentication</h3>
						<p class="text-gray-600">
							Passwordless, phishing-resistant authentication using WebAuthn. 
							No more password resets or credential stuffing attacks.
						</p>
					</div>

					<div class="bg-white rounded-xl p-6 shadow-sm">
						<div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
							<svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path>
							</svg>
						</div>
						<h3 class="text-lg font-semibold mb-2">Custom Domains</h3>
						<p class="text-gray-600">
							Use your own domain for authentication. Your users see your brand, 
							not ours. Full SSL included.
						</p>
					</div>

					<div class="bg-white rounded-xl p-6 shadow-sm">
						<div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
							<svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
							</svg>
						</div>
						<h3 class="text-lg font-semibold mb-2">Edge Deployment</h3>
						<p class="text-gray-600">
							Deployed globally on Cloudflare's edge network. 
							Low latency authentication from anywhere in the world.
						</p>
					</div>
				</div>

				<div class="bg-white rounded-xl p-8 shadow-sm">
					<h3 class="text-2xl font-bold text-center mb-8">Complete OIDC Features</h3>
					<div class="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
						<div class="flex items-center gap-2">
							<svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
							</svg>
							<span>Authorization Code + PKCE</span>
						</div>
						<div class="flex items-center gap-2">
							<svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
							</svg>
							<span>Client Credentials</span>
						</div>
						<div class="flex items-center gap-2">
							<svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
							</svg>
							<span>Refresh Tokens</span>
						</div>
						<div class="flex items-center gap-2">
							<svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
							</svg>
							<span>Token Introspection</span>
						</div>
						<div class="flex items-center gap-2">
							<svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
							</svg>
							<span>RP-Initiated Logout</span>
						</div>
						<div class="flex items-center gap-2">
							<svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
							</svg>
							<span>Back-Channel Logout</span>
						</div>
						<div class="flex items-center gap-2">
							<svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
							</svg>
							<span>JWKS Endpoint</span>
						</div>
						<div class="flex items-center gap-2">
							<svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
								<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
							</svg>
							<span>Discovery Endpoints</span>
						</div>
					</div>
				</div>
			</main>

			<footer class="py-8 text-center text-gray-500">
				<p>&copy; 2026 Auth SaaS. Built with Cloudflare Workers.</p>
			</footer>
		</body>
		</html>
	`);
});
