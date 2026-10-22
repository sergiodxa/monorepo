/**
 * The credentials-export notice, rendered through the app's email registry: the tenant in the
 * subject and the export it warns about in the body.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vite-plus/test";

import emails from "~/app/emails";
import { mail } from "~/app/initializers/mail";

describe("credentials export started email", () => {
	test("names the tenant whose password hashes are being exported", async () => {
		let rendered = unwrap(
			await mail.render(emails.owners.credentialsExportStarted, {
				props: { tenantName: "Acme" },
			}),
		);

		expect(rendered.subject).toBe("A credentials export started for Acme");
		expect(rendered.text).toContain("An export of Acme's directory has started");
	});
});
