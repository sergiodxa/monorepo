import type { JSONValue } from "@pkg/types";

import { isSuccess } from "@pkg/result";
import { validate } from "@pkg/validate";
import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";

import { reportMAU } from "./app/jobs/report-mau";
import { router } from "./app/router";
import { checkRateLimit } from "./lib/rate-limit";
import Tenant from "./tenant";

export { Tenant };

const HostMetadataSchema = s.object({
	tenantId: s.union([s.literal("platform"), s.string()]),
	region: s.defaulted(
		s.enum_(["wnam", "enam", "sam", "weur", "eeur", "apac", "oc", "afr", "me"]),
		"wnam",
	),
});

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
		let rateLimitResponse = await checkRateLimit(
			request,
			env.AUTH_RATE_LIMITER,
			env.STRICT_RATE_LIMITER,
		);
		if (rateLimitResponse) return rateLimitResponse;

		let hostMetadata = request.cf?.hostMetadata;
		if (import.meta.env.DEV) hostMetadata = { tenantId: "platform", region: "wnam" };
		if (!hostMetadata) return await router.fetch(request);

		let result = await validate(hostMetadata as JSONValue, HostMetadataSchema);

		if (isSuccess(result)) {
			if (result.data.tenantId === "platform") {
				let platform = env.TENANT.getByName("platform");
				return await platform.fetch(request);
			}

			let tenant = env.TENANT.getByName(result.data.tenantId, { locationHint: result.data.region });
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
