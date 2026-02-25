import { env } from "cloudflare:workers";
import { z } from "zod";

import { AUTHZ_CODE_TTL } from "~/config";

const Schema = z.object({
	clientId: z.string(),
	subjectId: z.string(),
	sessionId: z.string(),
	pkce: z.object({ challenge: z.string(), method: z.enum(["S256", "plain"]) }).nullable(),
});

export default class AuthzCode {
	static async find(code: string) {
		let result = await env.KV.get(`authz-code:${code}`);
		if (!result) return null;
		return Schema.parse(JSON.parse(result));
	}

	static async generate(
		clientId: string,
		subjectId: string,
		sessionId: string,
		pkce: { challenge: string; method: "S256" | "plain" } | null,
	) {
		let code = AuthzCode.generateCode();

		await env.KV.put(
			`authz-code:${code}`,
			JSON.stringify({ clientId, subjectId, sessionId, pkce }),
			{ expirationTtl: AUTHZ_CODE_TTL / 1000 }, // KV expects seconds
		);

		return code;
	}

	private static generateCode() {
		return crypto.randomUUID();
	}
}
