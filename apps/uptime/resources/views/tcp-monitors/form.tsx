/**
 * Shared TCP monitor form fields, used by both the new-monitor and edit-monitor views.
 * A rejected submission comes back through the same fields with what was typed and a message
 * on each field that failed, so nothing the visitor entered is lost.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";
import type { getContext } from "remix/middleware/async-context";

import { FieldError, Switch, TextField } from "@sdxc/ui";

import type { SelectTcpMonitor } from "~/database/schema";

import { withPrefix } from "~/app/services/prefixed-translate";
import StepperField from "~/resources/components/stepper-field";

/** A field the form posts, named as the action reads it. */
export type TcpMonitorField = "name" | "host" | "port" | "interval_seconds" | "timeout_ms";

/** What a rejected submission carried, to render back into the form. */
export interface TcpMonitorSubmission {
	/** Every field as the visitor typed it. */
	values: Partial<Record<TcpMonitorField, string>> & { is_enabled?: boolean };
	/** The fields the action refused, each drawn with its message. */
	invalid: TcpMonitorField[];
}

export namespace TcpMonitorFormFields {
	export interface Props {
		/** Existing monitor values when editing; omitted when creating. */
		monitor?: SelectTcpMonitor;
		/** The rejected submission to show again, which wins over `monitor`. */
		submission?: TcpMonitorSubmission;
		/** The request's translator, used to read this page's `form.fields.*` copy. */
		intl: ReturnType<typeof getContext>["intl"];
		/** Which page is rendering these fields, selecting the `page.<page>.form.fields.*` keys to read. */
		page: "createTcpMonitor" | "editTcpMonitor";
	}
}

/** The issue copy each field shows when the action refuses it. */
const ISSUE_KEYS: Record<TcpMonitorField, string> = {
	name: "name",
	host: "host",
	port: "port",
	interval_seconds: "interval",
	timeout_ms: "timeout",
};

/**
 * The number a stepper starts on: the submitted text when it reads as a number, else the
 * fallback, since a stepper needs a number to step from even after a nonsense submission.
 */
function stepperValue(submitted: string | undefined, fallback: number): number {
	if (submitted === undefined || submitted.trim() === "") return fallback;
	let parsed = Number(submitted);
	return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Renders the host/port/interval/timeout fields (plus an enabled toggle when editing),
 * pre-filled from a rejected `submission` first and the saved `monitor` second.
 */
export default function TcpMonitorFormFields(handle: Handle<TcpMonitorFormFields.Props>) {
	return () => {
		let { monitor, submission, intl, page } = handle.props;
		let t = withPrefix(intl.t, `page.${page}.form.fields`);
		let values = submission?.values ?? {};

		/** The message for `field` when the action refused it. */
		let issue = (field: TcpMonitorField) =>
			submission?.invalid.includes(field)
				? intl.t(`page.tcpMonitors.form.issues.${ISSUE_KEYS[field]}`)
				: undefined;

		return (
			<>
				<TextField
					type="text"
					name="name"
					required
					defaultValue={values.name ?? monitor?.name}
					label={t("name.label")}
					placeholder={t("name.placeholder")}
					description={t("name.description")}
					errorMessage={issue("name")}
				/>

				<TextField
					type="text"
					name="host"
					required
					defaultValue={values.host ?? monitor?.host}
					label={t("host.label")}
					placeholder={t("host.placeholder")}
					description={t("host.description")}
					errorMessage={issue("host")}
				/>

				<div>
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
						defaultValue={stepperValue(values.port, monitor?.port ?? 80)}
					/>
					{issue("port") && <FieldError>{issue("port")}</FieldError>}
				</div>

				<div>
					<StepperField
						id="tcp-monitor-interval-seconds"
						name="interval_seconds"
						label={t("interval.label")}
						description={t("interval.description")}
						decrementLabel={t("interval.decrement")}
						incrementLabel={t("interval.increment")}
						min={60}
						max={86_400}
						defaultValue={stepperValue(values.interval_seconds, monitor?.interval_seconds ?? 300)}
					/>
					{issue("interval_seconds") && <FieldError>{issue("interval_seconds")}</FieldError>}
				</div>

				<div>
					<StepperField
						id="tcp-monitor-timeout-ms"
						name="timeout_ms"
						label={t("timeout.label")}
						description={t("timeout.description")}
						decrementLabel={t("timeout.decrement")}
						incrementLabel={t("timeout.increment")}
						min={100}
						max={60_000}
						defaultValue={stepperValue(values.timeout_ms, monitor?.timeout_ms ?? 5000)}
					/>
					{issue("timeout_ms") && <FieldError>{issue("timeout_ms")}</FieldError>}
				</div>

				{monitor && (
					<Switch
						name="is_enabled"
						value="true"
						defaultChecked={values.is_enabled ?? monitor.is_enabled}
					>
						{t("isEnabled.label")}
					</Switch>
				)}
			</>
		);
	};
}
