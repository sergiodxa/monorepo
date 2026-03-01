/**
 * HTML utilities for platform dashboard
 */

export function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

interface LayoutOptions {
	title: string;
	tenant?: { id: string; name: string };
	backLink?: string;
	backText?: string;
	content: string;
}

export function layout(options: LayoutOptions): string {
	let { title, tenant, backLink, backText, content } = options;

	let breadcrumb = "";
	if (backLink && backText) {
		breadcrumb = `<a href="${backLink}" class="text-gray-600 hover:text-gray-900">&larr; ${escapeHtml(backText)}</a>`;
	} else if (tenant) {
		breadcrumb = `<a href="/dashboard/tenants/${tenant.id}" class="text-gray-600 hover:text-gray-900">&larr; ${escapeHtml(tenant.name)}</a>`;
	} else {
		breadcrumb =
			'<a href="/dashboard" class="text-gray-600 hover:text-gray-900">&larr; Dashboard</a>';
	}

	return `
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>${escapeHtml(title)} - Auth SaaS</title>
			<script src="https://cdn.tailwindcss.com"></script>
		</head>
		<body class="bg-gray-50 min-h-screen">
			<nav class="bg-white shadow-sm border-b">
				<div class="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
					<div class="flex items-center gap-4">
						${breadcrumb}
						${tenant ? `<span class="text-gray-400">/</span><span class="font-semibold">${escapeHtml(tenant.name)}</span>` : ""}
					</div>
					<a href="/onboarding" class="text-gray-600 hover:text-gray-900">Sign out</a>
				</div>
			</nav>

			<main class="max-w-6xl mx-auto px-4 py-8">
				${content}
			</main>
		</body>
		</html>
	`;
}
