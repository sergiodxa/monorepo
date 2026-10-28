/**
 * Security headers for JSON and MCP responses from this Worker.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SecurityHeaders } from "@sdxc/security-headers";

/** The policy for every apis response. */
export const SECURITY_POLICY: SecurityHeaders.Policy = {
	contentSecurityPolicy: {
		defaultSrc: ["none"],
		frameAncestors: ["none"],
		objectSrc: ["none"],
		baseUri: ["none"],
	},
};
