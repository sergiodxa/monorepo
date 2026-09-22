/**
 * Tells a tenant owner that failed sign-ins are running well above the tenant's own
 * trailing rate: what the platform saw, in plain terms, and nothing else — sent by
 * the daily baseline check rather than a request, so it carries no link back into a
 * flow the recipient never started.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@sdxc/i18n";
import type { Address, Email as EmailContract } from "@sdxc/mail";
import type { RemixElement } from "remix/ui";

import { Email } from "@sdxc/mail";

import { AuthMailLayout } from "~/app/mail/layout";

export namespace AttackSignalAlertEmail {
	/** Everything the message needs; nothing is loaded while it renders. */
	export interface Data {
		/** The owner's own address this alert goes to. */
		email: string;
		/** The tenant's own display name. */
		tenantName: string;
		/** Failed sign-ins counted in the hour that triggered this alert. */
		recentFailures: number;
		/** The tenant's own trailing hourly average, for comparison. */
		baselineHourlyAverage: number;
		/** Translator for the message's own locale. */
		t: TFunction;
	}
}

/**
 * Reports one tenant's elevated failed-sign-in rate to one of its owners.
 *
 * @example
 * await ctx.mail.send(
 * 	new AttackSignalAlertEmail({ email, tenantName, recentFailures, baselineHourlyAverage, t }),
 * );
 */
export class AttackSignalAlertEmail implements EmailContract {
	#data: AttackSignalAlertEmail.Data;

	constructor(data: AttackSignalAlertEmail.Data) {
		this.#data = data;
	}

	/** The owner's own address — the only recipient one alert has. */
	get to(): Address {
		return { email: this.#data.email };
	}

	get subject(): string {
		return this.#data.t("mail.attackSignalAlert.subject", { tenantName: this.#data.tenantName });
	}

	body(): RemixElement {
		let { t, tenantName, recentFailures, baselineHourlyAverage } = this.#data;

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
	}
}
