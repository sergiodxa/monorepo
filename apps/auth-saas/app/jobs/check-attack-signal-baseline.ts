/**
 * The daily attack-signal alert: for every provisioned tenant, reads the last hour
 * of failed sign-ins against the tenant's own trailing week, and mails every owner
 * once when that hour stands well above baseline. A tenant already alerted today is
 * skipped before either read runs, so a redelivered or overlapping run never sends
 * a second message for the same day.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createJobHandler } from "@sdxc/jobs";
import { isFailure } from "@sdxc/result";
import { env } from "cloudflare:workers";

import jobs from "~/app/jobs";
import { forEachProvisionedTenant } from "~/app/jobs/lib/for-each-tenant";
import {
	baselineHourlyAverage,
	BASELINE_WINDOW_HOURS,
	compareToBaseline,
	sumFailedSignIns,
} from "~/app/lib/attack-signal-baseline";
import { readFailedSignInsByHour } from "~/app/lib/attack-signals";
import { AttackSignalAlertEmail } from "~/app/mail/attack-signal-alert-email";
import { mailTranslator } from "~/app/mail/locale";
import { parseSenderAddress, tenantSenderAddress } from "~/app/mail/sender";
import AttackSignalAlert from "~/app/models/attack-signal-alert";
import Membership from "~/app/models/membership";
import TenantModel from "~/app/models/tenant";
import { dayOf } from "~/database/metering";

/** One hour, in milliseconds — the recent window's own span. */
const HOUR_MS = 60 * 60 * 1000;

/** How recent a window counts as "just now" for the comparison. */
export const RECENT_WINDOW_HOURS = 1;

export default createJobHandler(jobs.checkAttackSignalBaseline, async (ctx) => {
	let now = Date.now();
	let today = dayOf(now);

	let engine = { accountId: env.CF_ACCOUNT_ID, apiToken: env.CF_API_TOKEN };
	let platformFrom = parseSenderAddress(env.EMAIL_FROM);
	let platformTenant = ctx.tenant.getByName(env.PLATFORM_DOMAIN);

	let checked = 0;
	let alerted = 0;

	let { visited } = await forEachProvisionedTenant(
		ctx.database,
		ctx.tenant,
		async (_stub, tenantId) => {
			checked++;

			let alreadyAlerted = await AttackSignalAlert.findByTenantAndDay(
				ctx.database,
				tenantId,
				today,
			);
			if (alreadyAlerted) return;

			let recentRows = await readFailedSignInsByHour(engine, {
				tenantId,
				from: now - RECENT_WINDOW_HOURS * HOUR_MS,
				to: now,
			});
			let baselineRows = await readFailedSignInsByHour(engine, {
				tenantId,
				from: now - (BASELINE_WINDOW_HOURS + RECENT_WINDOW_HOURS) * HOUR_MS,
				to: now - RECENT_WINDOW_HOURS * HOUR_MS,
			});

			let comparison = compareToBaseline(
				sumFailedSignIns(recentRows),
				baselineHourlyAverage(baselineRows),
			);
			if (!comparison.elevated) return;

			let tenantRow = await TenantModel.findById(ctx.database, tenantId);
			if (!tenantRow) return;

			let owners = (await Membership.listByTenant(ctx.database, tenantId)).filter(
				(membership) => membership.role === "owner",
			);
			if (owners.length === 0) return;

			let { t } = mailTranslator();
			let sentToAny = false;

			for (let owner of owners) {
				let described = await platformTenant.describeSubject({
					subjectId: owner.subject_id,
					audience: { kind: "admin" },
				});
				if (!described.ok) continue;

				let email = described.identifiers.find((identifier) => identifier.kind === "email")?.value;
				if (!email) continue;

				let sent = await ctx.mail.send(
					new AttackSignalAlertEmail({
						email,
						tenantName: tenantRow.name,
						recentFailures: comparison.recentFailures,
						baselineHourlyAverage: comparison.baselineHourlyAverage,
						t,
					}),
					{ from: tenantSenderAddress(platformFrom, tenantRow.issuer) },
				);

				if (!isFailure(sent)) sentToAny = true;
			}

			if (sentToAny) {
				await AttackSignalAlert.create(ctx.database, tenantId, today);
				alerted++;
			}
		},
		{ signal: ctx.signal },
	);

	ctx.log.set({ tenants: { visited, checked }, alerts: { sent: alerted } });
});
