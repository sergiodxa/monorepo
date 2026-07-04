import type { JSONValue } from "@pkg/types";

import { isSuccess } from "@pkg/result";
import { validate } from "@pkg/validate";
import { env } from "cloudflare:workers";

import { reportMAU } from "./app/jobs/report-mau";
import { router } from "./app/router";
import { HostMetadataSchema } from "./lib/host-metadata";
import { checkRateLimit } from "./lib/rate-limit";
import Tenant from "./tenant";

export { Tenant };

export default {
	async fetch(request) {
		// Clone the request before trying static assets, since body can only be read once
		let assetRequest = new Request(request.url, {
			method: request.method,
			headers: request.headers,
		});

		let response = await env.ASSETS.fetch(assetRequest);
		if (response.ok) return response;

		let url = new URL(request.url);

		// Dashboard and onboarding routes go to the platform router
		if (
			url.pathname === "/" ||
			url.pathname.startsWith("/dashboard") ||
			url.pathname.startsWith("/onboarding")
		) {
			return await router.fetch(request);
		}

		// Apply rate limiting to auth endpoints before routing to tenant DO
		let rateLimitResponse = await checkRateLimit(request, {
			authLimiter: env.AUTH_RATE_LIMITER,
			strictLimiter: env.STRICT_RATE_LIMITER,
			managementLimiter: env.MANAGEMENT_RATE_LIMITER,
		});
		if (rateLimitResponse) return rateLimitResponse;

		let hostMetadata = request.cf?.hostMetadata;
		if (import.meta.env.DEV) hostMetadata = { tenant_id: "platform", region: "wnam" };
		if (!hostMetadata) return await router.fetch(request);

		let result = await validate(hostMetadata as JSONValue, HostMetadataSchema);

		if (isSuccess(result)) {
			if (result.data.tenant_id === "platform") {
				let platform = env.TENANT.getByName("platform");
				return await platform.fetch(request);
			}

			let tenant = env.TENANT.getByName(result.data.tenant_id, {
				locationHint: result.data.region,
			});
			return await tenant.fetch(request);
		}

		return await router.fetch(request);
	},

	async scheduled(controller) {
		// Daily MAU reporting job (runs at 1:00 AM UTC)
		if (controller.cron === "0 1 * * *") {
			await reportMAU(controller);
		}
	},
} satisfies ExportedHandler<Cloudflare.Env>;
