/**
 * The attack-signal alert, rendered through the app's email registry: the tenant in the
 * subject and the counts in the body, with the baseline rounded to one decimal.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import emails from "~/app/emails";
import { mail } from "~/app/initializers/mail";

describe("attack signal email", () => {
	test("reports the recent failures against the rounded baseline", async () => {
		let rendered = unwrap(
			await mail.render(emails.owners.attackSignal, {
				props: { tenantName: "Acme", recentFailures: 240, baselineHourlyAverage: 12.34 },
			}),
		);

		expect(rendered.subject).toBe("Unusual sign-in activity on Acme");
		expect(rendered.text).toContain("Acme saw 240 failed sign-ins in the last hour");
		expect(rendered.text).toContain("about 12.3 per hour");
	});
});
