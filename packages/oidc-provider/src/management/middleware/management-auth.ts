/**
 * Authentication middleware guarding every Management API route.
 *
 * Accepts either the control plane's HMAC-signed internal token or a Bearer access
 * token belonging to a client flagged as a management client, and exposes the
 * resolved client on `context.managementClient`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unauthorized } from "@sdxc/http/response/json";
import { JWK } from "@sdxc/jwt";
import { getServiceContainer } from "@sdxc/service-container";
import { Database } from "remix/data-table";

import Client from "../../clients/models/client.js";
import AccessToken from "../../oauth/values/access-token.js";
import { verifyInternalToken } from "../../shared/lib/internal-auth.js";
import middleware from "../../shared/lib/middleware.js";
import SigningKey from "../../signing-keys/models/signing-key.js";
import TenantMeta from "../models/tenant-meta.js";

/**
 * Middleware that verifies the request carries either a signed internal token
 * from the control plane, or a Bearer access token whose subject or audience
 * identifies a client with management API access.
 * @param internalSecret - HMAC secret shared with the control plane for internal tokens.
 * @returns A router middleware that authenticates management requests or returns `401`.
 */
export default (internalSecret: string) => {
	return middleware(async (context, next) => {
		let log = context.logger.middleware("management-auth");
		let db = getServiceContainer().get(Database);

		let internalToken = context.request.headers.get("x-internal-token");
		if (internalToken) {
			let isValid = await verifyInternalToken(internalToken, internalSecret);
			if (isValid) {
				log.info("Internal request authenticated via signed token");
				context.managementClient = null;
				return next();
			}
			log.info("Invalid internal token provided");
		}

		let authHeader = context.request.headers.get("authorization");
		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			log.info("Missing or invalid Authorization header");
			return unauthorized({
				error: "invalid_token",
				error_description: "Missing or invalid access token",
			});
		}

		let token = authHeader.slice(7);

		let issuer = await TenantMeta.getIssuer(db);
		if (!issuer) {
			log.error("Issuer not configured");
			return unauthorized({
				error: "server_error",
				error_description: "Server configuration error",
			});
		}

		let signingKeys = await SigningKey.getAll(db);
		if (signingKeys.length === 0) {
			log.error("No signing keys available");
			return unauthorized({
				error: "server_error",
				error_description: "Server configuration error",
			});
		}

		let accessToken;
		try {
			accessToken = await AccessToken.verify(token, signingKeys, {
				issuer: `https://${issuer}`,
				algorithms: [JWK.Algorithm.ES256],
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

		let clientId = accessToken.subject;

		let audience = accessToken.audience;
		if (Array.isArray(audience)) {
			let foundClientId = audience.find((aud) => !aud.startsWith("https://"));
			if (foundClientId) clientId = foundClientId;
		} else if (typeof audience === "string" && !audience.startsWith("https://")) {
			clientId = audience;
		}

		let client = await Client.show(db, clientId);
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

		context.managementClient = client;

		log.info("Management API access granted", { clientId: client.id, clientName: client.name });

		return next();
	});
};

declare module "remix/router" {
	export interface RequestContext {
		managementClient: Awaited<ReturnType<typeof Client.show>>;
	}
}
