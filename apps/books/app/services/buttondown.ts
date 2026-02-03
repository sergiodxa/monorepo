import { APIClient } from "@edgefirst-dev/api-client";
import { env } from "cloudflare:workers";
import { z } from "zod";

class Buttondown extends APIClient {
	constructor(protected override readonly options: { apiKey: string; fetch: typeof fetch }) {
		super(new URL("https://api.buttondown.com"), options);
	}

	protected override before(request: Request): Promise<Request> {
		request.headers.set("Authorization", `Token ${this.options.apiKey}`);
		request.headers.set("Content-Type", "application/json");
		return Promise.resolve(request);
	}

	protected override async after(_: Request, response: Response): Promise<Response> {
		if (response.status === 403) {
			throw new Error("Forbidden");
		}
		return response;
	}

	async isSubscribed(email: string) {
		const response = await this.get(`/v1/subscribers/${email}`);
		if (response.ok) return true;
		return false;
	}

	async subscribe(
		email: string,
		utm: { source?: string; campaign?: string; medium?: string },
		ipAddress: string | null,
	) {
		const response = await this.post("/v1/subscribers", {
			body: JSON.stringify({
				email,
				utm_source: utm.source,
				utm_campaign: utm.campaign,
				utm_medium: utm.medium,
				ip_address: ipAddress ?? undefined,
			}),
		});

		if (response.ok) return await response.json();

		let error = await z
			.object({ code: z.string(), detail: z.string() })
			.parseAsync(await response.json());

		throw new ButtondownError(error.detail, error.code);
	}

	async addMetadata(email: string, metadata: Record<string, string>) {
		const response = await this.patch(`/v1/subscribers/${email}`, {
			body: JSON.stringify({ metadata }),
		});

		if (response.ok) return await response.json();
		throw new Error("Failed to add metadata");
	}
}

if (!env.BUTTONDOWN_API_KEY) {
	throw new Error("BUTTONDOWN_API_KEY is required");
}

export default new Buttondown({
	apiKey: env.BUTTONDOWN_API_KEY,
	fetch: globalThis.fetch.bind(globalThis),
});
export type { Buttondown };

export class ButtondownError extends Error {
	override name = "ButtondownError";

	constructor(
		message: string,
		public readonly code: string,
	) {
		super(message);
	}
}
