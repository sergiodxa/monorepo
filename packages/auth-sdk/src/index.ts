import { APIClient } from "@edgefirst-dev/api-client";
import { failure, success, type Result } from "@pkg/result";
import { base64url } from "jose";
import { z } from "zod";

export class AuthenticationError extends Error {
	override name = "AuthenticationError";
	constructor(
		message: string,
		public code: string,
	) {
		super(message);
	}
}

export class SubjectNotFoundError extends Error {
	override name = "SubjectNotFoundError";
	constructor(public subjectId: string) {
		super(`Subject not found: ${subjectId}`);
	}
}

export interface Subject {
	id: string;
	createdAt: Date;
	updatedAt: Date;
	displayName: string;
	avatar: string;
	role: "user" | "admin";
	username: string;
	emailAddress: string;
}

export interface AuthSDKOptions {
	client: {
		id: string;
		secret: string;
	};
}

export class AuthSDK extends APIClient {
	client: AuthSDKOptions["client"];

	constructor(options: AuthSDKOptions) {
		super(new URL("https://auth.sergiodxa.com"), {
			fetch: globalThis.fetch.bind(globalThis),
		});
		this.client = options.client;
	}

	async authenticate(...resources: string[]): Promise<Result<string, AuthenticationError>> {
		let body = new FormData();
		body.append("grant_type", "client_credentials");
		for (let resource of resources) body.append("resource", resource);

		let headers = new Headers();
		headers.set(
			"Authorization",
			`Basic ${base64url.encode(`${this.client.id}:${this.client.secret}`)}`,
		);

		let response = await this.post("/oauth/token", { headers, body });

		if (response.ok) {
			let data = z.object({ access_token: z.jwt() }).parse(await response.json());
			return success(data.access_token);
		}

		let result = z
			.object({ error: z.string(), error_description: z.string() })
			.parse(await response.json());

		return failure(new AuthenticationError(result.error_description, result.error));
	}

	async fetchSubjectById(
		subjectId: string,
		token: string,
	): Promise<Result<Subject, SubjectNotFoundError>> {
		let response = await this.get(`/api/subjects/${subjectId}`, {
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
		});

		if (response.ok) {
			let data = z
				.object({
					subject: z.object({
						id: z.uuid(),
						createdAt: z.string().transform((val) => new Date(val)),
						updatedAt: z.string().transform((val) => new Date(val)),
						displayName: z.string(),
						avatar: z.url(),
						role: z.enum(["user", "admin"]),
						username: z.string(),
						emailAddress: z.string(),
					}),
				})
				.parse(await response.json());
			return success(data.subject);
		}

		return failure(new SubjectNotFoundError(subjectId));
	}
}
