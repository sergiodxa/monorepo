/**
 * Client for the auth service's OAuth token and subject endpoints.
 *
 * Wraps the two calls a relying party makes — exchange client credentials for an access
 * token, then read a subject with it — so callers work with a `Subject` and a `Result`
 * rather than with response shapes and status codes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { APIClient } from "@pkg/api-client";
import { failure, success } from "@pkg/result";
import * as s from "remix/data-schema";
import { url } from "remix/data-schema/checks";

/** Origin the service is deployed at; the SDK reads no configuration. */
const BASE_URL = new URL("https://auth.sergiodxa.com");

/** Successful `client_credentials` grant. */
const TokenSchema = s.object({ access_token: s.string() });

/** Failed grant, in the shape RFC 6749 defines for token errors. */
const TokenErrorSchema = s.object({ error: s.string(), error_description: s.string() });

/** Subject lookup response, with timestamps widened from their transport strings. */
const SubjectSchema = s.object({
	subject: s.object({
		id: s.string(),
		createdAt: s.string().transform((value) => new Date(value)),
		updatedAt: s.string().transform((value) => new Date(value)),
		displayName: s.string(),
		avatar: s.string().pipe(url()),
		role: s.enum_(["user", "admin"]),
		username: s.string(),
		emailAddress: s.string(),
	}),
});

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
		super(BASE_URL);
		this.client = options.client;
	}

	/**
	 * Exchanges the configured client credentials for an access token.
	 *
	 * Encodes the credentials as standard base64 per RFC 7617's Basic scheme.
	 *
	 * @param resources Resource indicators to scope the token to.
	 * @returns The access token, or why the grant was refused.
	 */
	async authenticate(...resources: string[]): Promise<Result<string, AuthenticationError>> {
		let body = new FormData();
		body.append("grant_type", "client_credentials");
		for (let resource of resources) body.append("resource", resource);

		let headers = new Headers();
		headers.set("Authorization", `Basic ${btoa(`${this.client.id}:${this.client.secret}`)}`);

		let response = await this.post("/oauth/token", { headers, body });

		if (response.ok) {
			let data = s.parse(TokenSchema, await response.json());
			return success(data.access_token);
		}

		let result = s.parse(TokenErrorSchema, await response.json());

		return failure(new AuthenticationError(result.error_description, result.error));
	}

	/**
	 * Reads a subject by id.
	 *
	 * @param subjectId Subject to read.
	 * @param token Access token from {@link AuthSDK.authenticate}.
	 * @returns The subject, or a not-found failure.
	 */
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
			let data = s.parse(SubjectSchema, await response.json());
			return success(data.subject);
		}

		return failure(new SubjectNotFoundError(subjectId));
	}
}
