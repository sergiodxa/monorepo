/**
 * The tenant invitation email, rendered through the app's email registry: the tenant in the
 * subject, the offered role in the body, and the accept link.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vite-plus/test";

import emails from "~/app/emails";
import { mail } from "~/app/initializers/mail";

describe("tenant invitation email", () => {
	test("names the tenant and the role, and carries the accept link", async () => {
		let url = "https://dashboard.auth.example.com/invitations/accept?token=t1";
		let rendered = unwrap(
			await mail.render(emails.tenants.invitation, {
				props: { tenantName: "Acme", role: "admin", url },
			}),
		);

		expect(rendered.subject).toBe("You've been invited to administer Acme");
		expect(rendered.text).toContain("You've been invited to administer Acme as admin.");
		expect(rendered.html).toContain(url);
	});

	test("refuses a role the dashboard does not offer", async () => {
		let rendered = await mail.render(emails.tenants.invitation, {
			props: { tenantName: "Acme", role: "root" as "admin", url: "https://example.com" },
		});

		expect(isFailure(rendered)).toBe(true);
	});
});
