/**
 * Shared DNS monitor form fields, used by both the new-monitor and edit-monitor views.
 * Reads its copy from `page.<page>.form.fields.*` through `i18next.getFixedT`, the same
 * convention `resources/views/monitors/form.tsx` establishes, so the two pages don't
 * duplicate the field markup or hardcode English strings. Fields are composed from
 * `@pkg/r3-ui`'s `TextField`/`Select` directly, wrapping `Select` in this app's own
 * `Field` for its label/description since `Select`, unlike `TextField`, doesn't bundle
 * one; "Enabled" goes through `@pkg/r3-ui`'s `Switch` directly, with an explicit
 * `value="true"` since a native checkbox otherwise submits `"on"`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { getContext } from "remix/async-context-middleware";
import type { Handle } from "remix/ui";

import { Select, Switch, TextField } from "@pkg/r3-ui";
import { mbe } from "@pkg/u/size";

import type { SelectDnsMonitor } from "~/database/schema";

import Field from "~/resources/components/field";

const RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS"] as const;

const INTERVAL_OPTIONS = [
	{ value: 300, key: "5m" },
	{ value: 900, key: "15m" },
	{ value: 1800, key: "30m" },
	{ value: 3600, key: "1h" },
	{ value: 21_600, key: "6h" },
	{ value: 43_200, key: "12h" },
	{ value: 86_400, key: "24h" },
] as const;

namespace DnsMonitorFormFields {
	export interface Props {
		/** Existing monitor values when editing; omitted when creating. */
		monitor?: SelectDnsMonitor;
		/** The request's i18next instance, used to read this page's `form.fields.*` copy. */
		i18next: ReturnType<typeof getContext>["i18next"];
		/** Which page is rendering these fields, selecting the `page.<page>.form.fields.*` keys to read. */
		page: "createDnsMonitor" | "editDnsMonitor";
	}
}

/** Renders the name/domain/record-type/expected-value/interval/enabled fields, pre-filled from `monitor` when editing. Leaving "expected value" blank alerts on any change instead of a mismatch. */
export default function DnsMonitorFormFields(handle: Handle<DnsMonitorFormFields.Props>) {
	return () => {
		let { monitor, i18next, page } = handle.props;
		let t = i18next.getFixedT(null, "translation", `page.${page}.form.fields`);

		return (
			<>
				<TextField
					label={t("name.label")}
					description={t("name.description")}
					name="name"
					required
					defaultValue={monitor?.name}
					placeholder={t("name.placeholder")}
					mix={[mbe("28px")]}
				/>

				<TextField
					label={t("domain.label")}
					description={t("domain.description")}
					name="domain"
					required
					defaultValue={monitor?.domain}
					placeholder={t("domain.placeholder")}
					mix={[mbe("28px")]}
				/>

				<Field label={t("recordType.label")} description={t("recordType.description")}>
					<Select name="record_type" defaultValue={monitor?.record_type ?? "A"}>
						{RECORD_TYPES.map((type) => (
							<Select.Option key={type} value={type}>
								{type}
							</Select.Option>
						))}
					</Select>
				</Field>

				<TextField
					label={t("expectedValue.label")}
					description={t("expectedValue.description")}
					name="expected_value"
					defaultValue={monitor?.expected_value ?? ""}
					placeholder={t("expectedValue.placeholder")}
					mix={[mbe("28px")]}
				/>

				<Field label={t("interval.label")} description={t("interval.description")}>
					<Select name="interval_seconds" defaultValue={monitor?.interval_seconds ?? 3600}>
						{INTERVAL_OPTIONS.map((option) => (
							<Select.Option key={option.value} value={option.value}>
								{t(`interval.options.${option.key}`)}
							</Select.Option>
						))}
					</Select>
				</Field>

				<Switch name="is_enabled" value="true" defaultChecked={monitor?.is_enabled ?? true}>
					{t("isEnabled.label")}
				</Switch>
			</>
		);
	};
}
