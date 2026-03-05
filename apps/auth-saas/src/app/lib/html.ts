/**
 * HTML utilities for platform dashboard
 */

import { html, type SafeHtml } from "remix/html-template";

import routes from "~/app/routes";

interface LayoutOptions {
	title: string;
	tenant?: { id: string; name: string };
	backLink?: string;
	backText?: string;
	content: SafeHtml;
	/**
	 * Show a warning banner for subscription issues.
	 */
	subscriptionWarning?: {
		type: "past_due";
		billingUrl: string;
	};
}

export function layout(options: LayoutOptions): SafeHtml {
	let { title, tenant, backLink, backText, content, subscriptionWarning } = options;

	let breadcrumb: SafeHtml;
	if (backLink && backText) {
		breadcrumb = html`<a href="${backLink}" class="text-gray-600 hover:text-gray-900">&larr; ${backText}</a>`;
	} else if (tenant) {
		breadcrumb = html`<a href="${routes.dashboard.tenants.show.href({ id: tenant.id })}" class="text-gray-600 hover:text-gray-900">&larr; ${tenant.name}</a>`;
	} else {
		breadcrumb = html`
			<a href="${routes.dashboard.index.href()}" class="text-gray-600 hover:text-gray-900">&larr; Dashboard</a>
		`;
	}

	let warningBanner: SafeHtml | null = null;
	if (subscriptionWarning?.type === "past_due") {
		warningBanner = html`
			<div class="bg-yellow-50 border-b border-yellow-200">
				<div class="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
					<p class="text-yellow-800 text-sm">
						<strong>Payment past due:</strong> Your subscription payment has failed. Please update your payment method to avoid service interruption.
					</p>
					<a href="${subscriptionWarning.billingUrl}" class="text-yellow-800 hover:text-yellow-900 text-sm font-medium underline">
						Update Payment
					</a>
				</div>
			</div>
		`;
	}

	let tenantBreadcrumb: SafeHtml | null = null;
	if (tenant) {
		tenantBreadcrumb = html`<span class="text-gray-400">/</span><span class="font-semibold">${tenant.name}</span>`;
	}

	return html`
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>${title} - Auth SaaS</title>
			<script src="https://cdn.tailwindcss.com"></script>
		</head>
		<body class="bg-gray-50 min-h-screen">
			${warningBanner}
			<nav class="bg-white shadow-sm border-b">
				<div class="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
					<div class="flex items-center gap-4">
						${breadcrumb}
						${tenantBreadcrumb}
					</div>
					<a href="${routes.onboarding.index.href()}" class="text-gray-600 hover:text-gray-900">Sign out</a>
				</div>
			</nav>

			<main class="max-w-6xl mx-auto px-4 py-8">
				${content}
			</main>
		</body>
		</html>
	`;
}
