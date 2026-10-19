/**
 * Every email the app sends, declared in one map with the schema of its props. Importing it
 * costs the schemas alone, so a controller or a job sends an email without loading the
 * template that renders it; every prop is plain JSON, so any of them can be queued.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { email, emails } from "@sdxc/mail";
import * as s from "remix/data-schema";

export default emails({
	/** Confirms the address a hosted sign-up or an address change claims. */
	verifyAddress: email({
		props: s.object({ url: s.string(), tenantName: s.string() }),
	}),
	/** Carries a hosted password-reset link to the address the identifier resolved to. */
	resetPassword: email({
		props: s.object({ url: s.string(), tenantName: s.string() }),
	}),
	magicLink: {
		/** Carries a magic-link sign-in's link and the code beside it. */
		signIn: email({
			props: s.object({ url: s.string(), code: s.string(), tenantName: s.string() }),
		}),
		/** Tells an address with no account that a magic-link sign-in was attempted against it. */
		noAccount: email({ props: s.object({ tenantName: s.string() }) }),
	},
	signup: {
		/** Confirms the address a platform signup claims, on the way to provisioning its tenant. */
		verify: email({ props: s.object({ url: s.string() }) }),
	},
	tenants: {
		/** Invites an address to administer a tenant's dashboard at a given role. */
		invitation: email({
			props: s.object({
				tenantName: s.string(),
				role: s.enum_(["owner", "admin", "member"]),
				url: s.string(),
			}),
		}),
	},
	owners: {
		/** Reports a tenant's failed sign-ins running well above its own trailing rate. */
		attackSignal: email({
			props: s.object({
				tenantName: s.string(),
				recentFailures: s.number(),
				baselineHourlyAverage: s.number(),
			}),
		}),
		/** Tells an owner that an export carrying every stored password hash has started. */
		credentialsExportStarted: email({ props: s.object({ tenantName: s.string() }) }),
	},
});
