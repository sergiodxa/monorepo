/**
 * The DNS monitor's name/domain/interval/enabled fields, reading copy from
 * `page.<page>.form.fields.*`. A monitor covers a whole domain, so there is no record type or
 * expected value here — those are derived from the zone at review time. A rejected submission
 * comes back through the same fields with what was typed and a message on each field to fix.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";
import type { getContext } from "remix/middleware/async-context";

import { Select, Switch, TextField } from "@sdxc/ui";

import type { SelectDnsMonitor } from "~/database/schema";

import { withPrefix } from "~/app/services/prefixed-translate";
import Field from "~/resources/components/field";

/**
 * How often every tracked name is resolved, in seconds, paired with each option's locale key.
 * Floors at 900 seconds: other monitor types go as low as 300, but a full-zone sweep already
 * pushes detection latency against the records' own TTLs, making 900 seconds the useful floor.
 */
const INTERVAL_OPTIONS = [
	{ value: 900, key: "15m" },
	{ value: 1800, key: "30m" },
	{ value: 3600, key: "1h" },
	{ value: 21_600, key: "6h" },
	{ value: 43_200, key: "12h" },
	{ value: 86_400, key: "24h" },
] as const;

/** A field a DNS monitor form posts, named as the action reads it. */
export type DnsMonitorField =
	| "name"
	| "domain"
	| "interval_seconds"
	| "zone_file"
	| "registration_warning_days";

/** What a rejected submission carried, to render back into the form. */
export interface DnsMonitorSubmission {
	/** Every field as the visitor typed it. */
	values: Partial<Record<DnsMonitorField, string>> & { is_enabled?: boolean };
	/** The translated message for each field the action refused. */
	issues: Partial<Record<DnsMonitorField, string>>;
}

export namespace DnsMonitorFormFields {
	export interface Props {
		/** Existing monitor values when editing; omitted when creating. */
		monitor?: SelectDnsMonitor;
		/** The rejected submission to show again, which wins over `monitor`. */
		submission?: DnsMonitorSubmission;
		/** The request's translator, used to read this page's `form.fields.*` copy. */
		intl: ReturnType<typeof getContext>["intl"];
		/** Which page is rendering these fields, selecting the `page.<page>.form.fields.*` keys to read. */
		page: "createDnsMonitor" | "editDnsMonitor";
	}
}

/**
 * Renders the name/domain/interval/enabled fields, pre-filled from a rejected `submission`
 * first and the saved `monitor` second. Defaults the interval to daily, since DNS changes are
 * human-paced, and selects the option explicitly, since `<select>` ignores `defaultValue`.
 */
export default function DnsMonitorFormFields(handle: Handle<DnsMonitorFormFields.Props>) {
	return () => {
		let { monitor, submission, intl, page } = handle.props;
		let t = withPrefix(intl.t, `page.${page}.form.fields`);
		let values = submission?.values ?? {};
		let issues = submission?.issues ?? {};

		let intervalSeconds = Number(values.interval_seconds ?? monitor?.interval_seconds ?? 86_400);

		return (
			<>
				<TextField
					label={t("name.label")}
					description={t("name.description")}
					name="name"
					required
					defaultValue={values.name ?? monitor?.name}
					placeholder={t("name.placeholder")}
					errorMessage={issues.name}
				/>

				<TextField
					label={t("domain.label")}
					description={t("domain.description")}
					name="domain"
					required
					defaultValue={values.domain ?? monitor?.domain}
					placeholder={t("domain.placeholder")}
					errorMessage={issues.domain}
				/>

				<Field
					label={t("interval.label")}
					description={t("interval.description")}
					error={issues.interval_seconds}
				>
					<Select name="interval_seconds">
						{INTERVAL_OPTIONS.map((option) => (
							<Select.Option
								key={option.value}
								value={option.value}
								selected={option.value === intervalSeconds}
							>
								{t(`interval.options.${option.key}`)}
							</Select.Option>
						))}
					</Select>
				</Field>

				<Switch
					name="is_enabled"
					value="true"
					defaultChecked={values.is_enabled ?? monitor?.is_enabled ?? true}
				>
					{t("isEnabled.label")}
				</Switch>
			</>
		);
	};
}
