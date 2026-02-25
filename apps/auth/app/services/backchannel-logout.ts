import { JWK } from "@edgefirst-dev/jwt";
import { and, eq, ne } from "drizzle-orm";

import * as schema from "~/db/schema";
import LogoutToken from "~/entities/logout-token";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";
import { getSigningKey } from "~/modules/jwks";

/**
 * Send back-channel logout tokens to all RPs that have registered
 * a backchannel_logout_uri for the given subject.
 *
 * Per OIDC Back-Channel Logout 1.0, this sends signed Logout Tokens
 * to each RP's back-channel logout endpoint.
 *
 * @see https://openid.net/specs/openid-connect-backchannel-1_0.html
 */
export async function sendBackchannelLogoutTokens(
	subjectId: string,
	excludeClientId?: string,
): Promise<void> {
	// Find all clients with backchannel logout URIs that have sessions for this subject
	let sessionsWithClients = await db()
		.select({
			sessionId: schema.sessions.id,
			clientId: schema.clients.id,
			backchannelLogoutUri: schema.clients.backchannelLogoutUri,
			backchannelLogoutSessionRequired: schema.clients.backchannelLogoutSessionRequired,
		})
		.from(schema.sessions)
		.innerJoin(schema.clients, eq(schema.sessions.clientId, schema.clients.id))
		.where(
			and(
				eq(schema.sessions.subjectId, subjectId),
				// Only select clients with backchannel logout URIs
				// SQLite doesn't have IS NOT NULL, use ne with empty string
				ne(schema.clients.backchannelLogoutUri, ""),
				// Exclude the client that initiated the logout if specified
				excludeClientId ? ne(schema.clients.id, excludeClientId) : undefined,
			),
		);

	// Filter to only clients with backchannel logout URIs
	let clientsToNotify = sessionsWithClients.filter((s) => s.backchannelLogoutUri);

	if (clientsToNotify.length === 0) {
		logger.info("backchannel_logout_no_clients", { subjectId });
		return;
	}

	let signingKeys = await getSigningKey();

	// Send logout tokens to all RPs in parallel
	let results = await Promise.allSettled(
		clientsToNotify.map(async (client) => {
			// Generate the logout token
			let sessionId =
				client.backchannelLogoutSessionRequired === "true" ? client.sessionId : undefined;

			let logoutToken = LogoutToken.generate(subjectId, client.clientId, sessionId);
			let signedToken = await logoutToken.sign(JWK.Algoritm.ES256, signingKeys);

			// Send the logout token to the RP
			// Per spec, content type is application/x-www-form-urlencoded
			let response = await fetch(client.backchannelLogoutUri!, {
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: new URLSearchParams({ logout_token: signedToken }),
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			return { clientId: client.clientId, status: "success" };
		}),
	);

	// Log results
	for (let [i, result] of results.entries()) {
		let client = clientsToNotify[i]!;

		if (result.status === "fulfilled") {
			logger.info("backchannel_logout_sent", {
				subjectId,
				clientId: client.clientId,
			});
		} else {
			logger.error("backchannel_logout_failed", {
				subjectId,
				clientId: client.clientId,
				error: result.reason instanceof Error ? result.reason.message : "Unknown error",
			});
		}
	}
}
