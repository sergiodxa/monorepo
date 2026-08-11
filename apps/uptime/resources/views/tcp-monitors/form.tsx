/**
 * Shared TCP monitor form fields, used by both the new-monitor and edit-monitor views.
 * The enabled toggle only renders when editing an existing monitor — a new monitor has
 * no toggle and is always created enabled (see `CreateTcpMonitorSchema`'s `is_enabled`
 * default in `app/http/validators/tcp-monitor.ts`). It exists so the two pages don't
 * duplicate the field markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { getContext } from "remix/async-context-middleware";
import type { Handle } from "remix/ui";

import { mbe } from "@pkg/u/size";
import { Switch, TextField } from "@pkg/ui";

import type { SelectTcpMonitor } from "~/database/schema";

import StepperField from "~/resources/components/stepper-field";

namespace TcpMonitorFormFields {
	export interface Props {
		/** Existing monitor values when editing; omitted when creating. */
		monitor?: SelectTcpMonitor;
		/** The request's i18next instance, used to read this page's `form.fields.*` copy. */
		i18next: ReturnType<typeof getContext>["i18next"];
		/** Which page is rendering these fields, selecting the `page.<page>.form.fields.*` keys to read. */
		page: "createTcpMonitor" | "editTcpMonitor";
	}
}

/** Renders the host/port/interval/timeout fields (plus an enabled toggle when editing), pre-filled from `monitor` when editing. */
export default function TcpMonitorFormFields(handle: Handle<TcpMonitorFormFields.Props>) {
	return () => {
		let { monitor, i18next, page } = handle.props;
		let t = i18next.getFixedT(null, "translation", `page.${page}.form.fields`);

		return (
			<>
				<TextField
					type="text"
					name="name"
					required
					defaultValue={monitor?.name}
					label={t("name.label")}
					placeholder={t("name.placeholder")}
					description={t("name.description")}
					mix={[mbe("28px")]}
				/>

				<TextField
					type="text"
					name="host"
					required
					defaultValue={monitor?.host}
					label={t("host.label")}
					placeholder={t("host.placeholder")}
					description={t("host.description")}
					mix={[mbe("28px")]}
				/>

				<StepperField
					id="tcp-monitor-port"
					name="port"
					required
					label={t("port.label")}
					description={t("port.description")}
					decrementLabel={t("port.decrement")}
					incrementLabel={t("port.increment")}
					min={1}
					max={65_535}
					defaultValue={monitor?.port ?? 80}
				/>

				<StepperField
					id="tcp-monitor-interval-seconds"
					name="interval_seconds"
					label={t("interval.label")}
					description={t("interval.description")}
					decrementLabel={t("interval.decrement")}
					incrementLabel={t("interval.increment")}
					min={60}
					max={86_400}
					defaultValue={monitor?.interval_seconds ?? 300}
				/>

				<StepperField
					id="tcp-monitor-timeout-ms"
					name="timeout_ms"
					label={t("timeout.label")}
					description={t("timeout.description")}
					decrementLabel={t("timeout.decrement")}
					incrementLabel={t("timeout.increment")}
					min={100}
					max={60_000}
					defaultValue={monitor?.timeout_ms ?? 5000}
				/>

				{monitor && (
					<Switch name="is_enabled" value="true" defaultChecked={monitor.is_enabled}>
						{t("isEnabled.label")}
					</Switch>
				)}
			</>
		);
	};
}
