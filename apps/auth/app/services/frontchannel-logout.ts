import { and, eq, ne } from "drizzle-orm";

import { ISSUER } from "~/config";
import * as schema from "~/db/schema";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";

interface FrontchannelLogoutUrl {
	clientId: string;
	url: string;
}

/**
 * Get front-channel logout URLs for all RPs that have registered
 * a frontchannel_logout_uri for the given subject.
 *
 * Per OIDC Front-Channel Logout 1.0, these URLs should be loaded
 * in hidden iframes by the user's browser during logout.
 *
 * @see https://openid.net/specs/openid-connect-frontchannel-1_0.html
 */
export async function getFrontchannelLogoutUrls(
	subjectId: string,
	excludeClientId?: string,
): Promise<FrontchannelLogoutUrl[]> {
	// Find all clients with frontchannel logout URIs that have sessions for this subject
	let sessionsWithClients = await db()
		.select({
			sessionId: schema.sessions.id,
			clientId: schema.clients.id,
			frontchannelLogoutUri: schema.clients.frontchannelLogoutUri,
			frontchannelLogoutSessionRequired: schema.clients.frontchannelLogoutSessionRequired,
		})
		.from(schema.sessions)
		.innerJoin(schema.clients, eq(schema.sessions.clientId, schema.clients.id))
		.where(
			and(
				eq(schema.sessions.subjectId, subjectId),
				// Only select clients with frontchannel logout URIs
				ne(schema.clients.frontchannelLogoutUri, ""),
				// Exclude the client that initiated the logout if specified
				excludeClientId ? ne(schema.clients.id, excludeClientId) : undefined,
			),
		);

	// Filter to only clients with frontchannel logout URIs
	let clientsToNotify = sessionsWithClients.filter((s) => s.frontchannelLogoutUri);

	if (clientsToNotify.length === 0) {
		logger.info("frontchannel_logout_no_clients", { subjectId });
		return [];
	}

	// Build logout URLs with iss and optional sid parameters
	let urls: FrontchannelLogoutUrl[] = [];

	for (let client of clientsToNotify) {
		let logoutUrl = new URL(client.frontchannelLogoutUri!);

		// Always include iss parameter per spec
		logoutUrl.searchParams.set("iss", `https://${ISSUER}`);

		// Include sid (session ID) if required by the client
		if (client.frontchannelLogoutSessionRequired === "true") {
			logoutUrl.searchParams.set("sid", client.sessionId);
		}

		urls.push({
			clientId: client.clientId,
			url: logoutUrl.toString(),
		});

		logger.info("frontchannel_logout_url_generated", {
			subjectId,
			clientId: client.clientId,
		});
	}

	return urls;
}
