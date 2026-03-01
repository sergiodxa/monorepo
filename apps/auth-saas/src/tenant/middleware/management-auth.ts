import { unauthorized } from "@pkg/http/response/json";

import middleware from "~/lib/middleware";
import Client from "~/tenant/models/client";
import SigningKey from "~/tenant/models/signing-key";
import TenantMeta from "~/tenant/models/tenant-meta";
import AccessToken from "~/tenant/values/access-token";

/**
 * Middleware that verifies the request has a valid access token
 * issued to a client with management API access.
 */
export default () => {
	return middleware(async (context, next) => {
		let log = context.logger.middleware("management-auth");

		// Extract Bearer token from Authorization header
		let authHeader = context.request.headers.get("authorization");
		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			log.info("Missing or invalid Authorization header");
			return unauthorized({
				error: "invalid_token",
				error_description: "Missing or invalid access token",
			});
		}

		let token = authHeader.slice(7);

		// Get issuer and signing keys
		let issuer = await TenantMeta.getIssuer(context.db);
		if (!issuer) {
			log.error("Issuer not configured");
			return unauthorized({
				error: "server_error",
				error_description: "Server configuration error",
			});
		}

		let signingKeys = await SigningKey.getAll(context.db);
		if (signingKeys.length === 0) {
			log.error("No signing keys available");
			return unauthorized({
				error: "server_error",
				error_description: "Server configuration error",
			});
		}

		// Verify access token
		let accessToken;
		try {
			accessToken = await AccessToken.verify(token, signingKeys, {
				issuer: `https://${issuer}`,
			});
		} catch (error) {
			log.info("Invalid access token", {
				error: error instanceof Error ? error.message : "Unknown",
			});
			return unauthorized({
				error: "invalid_token",
				error_description: "Access token is invalid or expired",
			});
		}

		// Get the client ID from the token
		// For client_credentials grant, the subject IS the client ID
		// For authorization_code grant, we need to check the audience
		let clientId = accessToken.subject;

		// If the subject looks like a user ID (UUID), the audience is the client
		// For M2M tokens, subject === client_id
		let audience = accessToken.audience;
		if (Array.isArray(audience)) {
			// Find the client ID in the audience (not the issuer URL)
			let foundClientId = audience.find((aud) => !aud.startsWith("https://"));
			if (foundClientId) clientId = foundClientId;
		} else if (typeof audience === "string" && !audience.startsWith("https://")) {
			clientId = audience;
		}

		// Verify the client has management API access
		let client = await Client.show(context.db, clientId);
		if (!client) {
			log.info("Client not found", { clientId });
			return unauthorized({
				error: "invalid_token",
				error_description: "Client not found",
			});
		}

		if (!client.is_management_client) {
			log.info("Client does not have management API access", { clientId });
			return unauthorized({
				error: "insufficient_scope",
				error_description: "Client does not have management API access",
			});
		}

		// Store client info in context for use by handlers
		context.managementClient = client;

		log.info("Management API access granted", { clientId: client.id, clientName: client.name });

		return next();
	});
};

declare module "remix/fetch-router" {
	export interface RequestContext {
		managementClient: Awaited<ReturnType<typeof Client.show>>;
	}
}
