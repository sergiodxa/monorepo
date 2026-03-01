import type { JSONValue } from "@pkg/types";

import { isSuccess } from "@pkg/result";
import { validate } from "@pkg/validate";
import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";

import { router } from "./app/router";
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
		let response = await env.ASSETS.fetch(request);
		if (response.ok) return response;

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
} satisfies ExportedHandler<Cloudflare.Env>;
