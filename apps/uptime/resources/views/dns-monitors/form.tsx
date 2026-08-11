/**
 * Shared DNS monitor form fields, used by both the new-monitor and edit-monitor views.
 * Reads its copy from `page.<page>.form.fields.*` through `i18next.getFixedT`, the same
 * convention `resources/views/monitors/form.tsx` establishes, so the two pages don't
 * duplicate the field markup or hardcode English strings. Fields are composed from
 * `@pkg/ui`'s `TextField`/`Select` directly, wrapping `Select` in this app's own
 * `Field` for its label/description since `Select`, unlike `TextField`, doesn't bundle
 * one; "Enabled" goes through `@pkg/ui`'s `Switch` directly, with an explicit
 * `value="true"` since a native checkbox otherwise submits `"on"`.
 *
 * A monitor covers a whole domain, so there is no record type to pick and no expected value
 * to transcribe: the expectation is imported from the zone and reviewed. The zone-file
 * textarea that replaces them lands with the create and review screens (ADR-026 phase 2.5).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { getContext } from "remix/async-context-middleware";
import type { Handle } from "remix/ui";

import { Select, Switch, TextField } from "@pkg/ui";

import type { SelectDnsMonitor } from "~/database/schema";

import Field from "~/resources/components/field";

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

/** Renders the name/domain/interval/enabled fields, pre-filled from `monitor` when editing. */
export default function DnsMonitorFormFields(handle: Handle<DnsMonitorFormFields.Props>) {
	return () => {
		let { monitor, i18next, page } = handle.props;
		let t = i18next.getFixedT(null, "translation", `page.${page}.form.fields`);

		let intervalSeconds = monitor?.interval_seconds ?? 3600;

		return (
			<>
				<TextField
					label={t("name.label")}
					description={t("name.description")}
					name="name"
					required
					defaultValue={monitor?.name}
					placeholder={t("name.placeholder")}
				/>

				<TextField
					label={t("domain.label")}
					description={t("domain.description")}
					name="domain"
					required
					defaultValue={monitor?.domain}
					placeholder={t("domain.placeholder")}
				/>

				<Field label={t("interval.label")} description={t("interval.description")}>
					{/*
					 * The saved interval is marked `selected` on its own `<option>`: `<select>` has
					 * no `defaultValue` attribute, so spelling it on the host renders as inert
					 * markup and leaves the first option showing, which on the edit page would
					 * silently rewrite a daily monitor into a 5-minute one on the next save. The
					 * comparison is deliberately between numbers
					 * — the saved column and the option value are both numeric, and only the
					 * rendered attribute is a string — so an interval is never matched by
					 * coercion.
					 */}
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

				<Switch name="is_enabled" value="true" defaultChecked={monitor?.is_enabled ?? true}>
					{t("isEnabled.label")}
				</Switch>
			</>
		);
	};
}
