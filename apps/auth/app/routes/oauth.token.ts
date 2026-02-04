import { base64url } from "jose";
import { z } from "zod/v4";

import { OAuth2Error } from "~/modules/oauth2";
import oidc from "~/services/oidc";

import type { Route } from "./+types/oauth.token";

const AuthorizationCodeSchema = z.object({
	grant_type: z.literal("authorization_code"),
	code: z.string(),
	code_verifier: z.string().optional(),
	redirect_uri: z.url(),
});

const ClientCredentialsSchema = z.object({
	grant_type: z.literal("client_credentials"),
	resource: z
		.string()
		.or(z.string().array())
		.optional()
		.transform((v) => {
			if (Array.isArray(v)) return v;
			return v ? [v] : [];
		}),
});

const RefreshTokenSchema = z.object({
	grant_type: z.literal("refresh_token"),
	refresh_token: z.string(),
});

const Schema = z.discriminatedUnion("grant_type", [
	AuthorizationCodeSchema,
	ClientCredentialsSchema,
	RefreshTokenSchema,
]);

export async function action({ request }: Route.ActionArgs) {
	let formData = await request.formData();
	let bodyResult = Schema.safeParse(Object.fromEntries(formData));

	if (!bodyResult.success) {
		return Response.json(
			{ error: "invalid_request", error_description: "Invalid request body" },
			{ status: 400 },
		);
	}

	try {
		if (bodyResult.data.grant_type === "authorization_code") {
			let result = await oidc.token({
				type: "authorization_code",
				code: bodyResult.data.code,
				codeVerifier: bodyResult.data.code_verifier,
				redirectUri: bodyResult.data.redirect_uri,
			});
			return Response.json(result, { status: 200 });
		}

		if (bodyResult.data.grant_type === "refresh_token") {
			let result = await oidc.token({
				type: "refresh_token",
				refreshToken: bodyResult.data.refresh_token,
			});

			return Response.json(result, { status: 200 });
		}

		if (bodyResult.data.grant_type === "client_credentials") {
			let clientCredentials = getClientCredentialsFromHeader(request.headers);

			if (!clientCredentials) {
				return Response.json(
					{
						error: "invalid_request",
						description: "Missing or invalid client credentials",
					},
					{ status: 400 },
				);
			}

			let result = await oidc.token({
				type: "client_credentials",
				resource: bodyResult.data.resource ?? [],
				...clientCredentials,
			});

			return Response.json(result, { status: 200 });
		}
	} catch (error) {
		if (error instanceof OAuth2Error) {
			return Response.json(
				{ error: error.code, error_description: error.message },
				{ status: 400 },
			);
		}

		if (error instanceof Error) {
			return Response.json(
				{
					error: "server_error",
					error_description: error.message,
				},
				{ status: 500 },
			);
		}

		return Response.json(
			{
				error: "server_error",
				error_description: "An unexpected error occurred.",
			},
			{ status: 500 },
		);
	}

	return Response.json(
		{
			error: "unsupported_grant_type",
			error_description: "The grant type is not supported.",
		},
		{ status: 400 },
	);
}

function getClientCredentialsFromHeader(headers: Headers) {
	let authorization = headers.get("Authorization");
	if (!authorization) return null;

	let [type, token] = authorization.split(" ");
	if (type !== "Basic") return null;

	if (!token) return null;

	let [clientId, clientSecret] = new TextDecoder().decode(base64url.decode(token)).split(":");

	if (!clientId || !clientSecret) return null;

	return { clientId, clientSecret };
}
