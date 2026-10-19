/**
 * Every email this server sends, declared with the schema of its props. Importing it costs
 * the schemas alone, so a service sends an email without loading the template that renders
 * it, and the registry can enumerate every message for a preview.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { email, emails } from "@sdxc/mail";
import * as s from "remix/data-schema";

export default emails({
	/** The notice a subject receives when a session is opened on their account. */
	newSignIn: email({
		props: s.object({
			browser: s.string(),
			os: s.string(),
			deviceType: s.enum_(["desktop", "mobile", "tablet", "unknown"]),
			/** Address the sign-in came from; `null` when the platform recorded none. */
			ip: s.nullable(s.string()),
		}),
	}),

	/** The notice a subject receives once a recovery link changed their password. */
	passwordChanged: email({ props: s.object({}) }),

	/** The password-recovery link, valid for `minutes`. */
	resetPassword: email({ props: s.object({ url: s.string(), minutes: s.number() }) }),

	/** The link confirming the address an account is registered under. */
	verifyEmail: email({ props: s.object({ url: s.string(), expiresInMinutes: s.number() }) }),
});
