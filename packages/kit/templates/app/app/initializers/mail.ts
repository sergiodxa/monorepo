/**
 * The email registry: every email `app/emails/index.ts` declares, mapped onto its template
 * through `lazy()`, so a send imports only the template it renders. It holds no transport, so
 * the Worker's mailers and the command line share it; `sdxc make email` adds the mapping.
 */

import { createMail } from "@sdxc/mail";

import { translate } from "~/app/initializers/i18n";

/** The registry the router, the job dispatcher and the command line hand their mailers. */
export const mail = createMail({ translator: translate });

declare module "@sdxc/mail" {
	/** Types the `t()` every template receives with the keys of the app's message bundles. */
	interface MailTypes {
		translate: ReturnType<typeof translate>["t"];
	}
}
