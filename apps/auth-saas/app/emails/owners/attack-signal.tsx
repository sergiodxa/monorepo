/**
 * Tells a tenant owner that failed sign-ins are running well above the tenant's own trailing
 * rate: what the platform saw, in plain terms, and nothing else. A daily check sends it, so
 * it carries no link back into a flow the recipient never started.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEmail, Email } from "@sdxc/mail";

import emails from "~/app/emails";
import { AuthMailLayout } from "~/app/emails/layout";

export default createEmail(emails.owners.attackSignal, {
	subject: ({ tenantName, t }) => t("mail.attackSignalAlert.subject", { tenantName }),
	body: (handle) => () => {
		let { t, tenantName, recentFailures, baselineHourlyAverage } = handle.props;

		/** Rounded to one decimal: precise enough to read as real, plain enough to read at a glance. */
		let baselineDisplay = Math.round(baselineHourlyAverage * 10) / 10;

		return (
			<AuthMailLayout
				title={t("mail.attackSignalAlert.subject", { tenantName })}
				preview={t("mail.attackSignalAlert.preview", { tenantName })}
				tenantName={tenantName}
				t={t}
			>
				<Email.Heading>{t("mail.attackSignalAlert.heading")}</Email.Heading>
				<Email.Text>
					{t("mail.attackSignalAlert.body", {
						tenantName,
						recentFailures,
						baselineHourlyAverage: baselineDisplay,
					})}
				</Email.Text>
				<Email.Text muted>{t("mail.attackSignalAlert.notice")}</Email.Text>
			</AuthMailLayout>
		);
	},
	preview: () => ({ tenantName: "Acme", recentFailures: 240, baselineHourlyAverage: 12.34 }),
});
