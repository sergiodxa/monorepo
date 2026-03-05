import { html as htmlResponse } from "@pkg/http/response";
import { html } from "remix/html-template";

import Tenant from "~/app/models/tenant";
import routes from "~/app/routes";
import action from "~/lib/action";

export default action<"GET", "/dashboard">(async ({ db, platformSession, logger }) => {
	let log = logger.loader("/dashboard");

	let tenants = await Tenant.listAccessibleBySubject(
		db,
		platformSession.subjectId,
		platformSession.email,
	);

	log.info("Dashboard loaded", {
		subjectId: platformSession.subjectId,
		tenantCount: tenants.length,
	});

	// If no tenants, redirect to create first tenant
	if (tenants.length === 0) {
		return new Response(null, {
			status: 302,
			headers: { Location: routes.dashboard.tenants.new.href() },
		});
	}

	let tenantsHtml = tenants.map(
		(t) => html`
			<li class="border rounded-lg p-4 hover:bg-gray-50">
				<a href="${routes.dashboard.tenants.show.href({ id: t.id })}" class="block">
					<h3 class="font-semibold text-lg">${t.name}</h3>
					<p class="text-gray-500 text-sm">${t.slug}</p>
					<span class="inline-block mt-2 px-2 py-1 text-xs rounded ${t.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}">
						${t.status}
					</span>
				</a>
			</li>
		`,
	);

	return htmlResponse(
		String(html`
		<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Dashboard - Auth SaaS</title>
			<script src="https://cdn.tailwindcss.com"></script>
		</head>
		<body class="bg-gray-50 min-h-screen">
			<nav class="bg-white shadow-sm border-b">
				<div class="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
					<h1 class="text-xl font-bold">Auth SaaS</h1>
					<a href="${routes.onboarding.index.href()}" class="text-gray-600 hover:text-gray-900">Sign out</a>
				</div>
			</nav>

			<main class="max-w-6xl mx-auto px-4 py-8">
				<div class="flex justify-between items-center mb-6">
					<h2 class="text-2xl font-bold">Your Tenants</h2>
					<a href="${routes.dashboard.tenants.new.href()}" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
						New Tenant
					</a>
				</div>

				<ul class="space-y-4">
					${tenantsHtml}
				</ul>
			</main>
		</body>
		</html>
	`),
	);
});
