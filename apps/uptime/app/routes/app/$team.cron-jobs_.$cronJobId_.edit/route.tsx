/**
 * Route module for editing an existing cron job monitor. Its loader loads the cron job scoped
 * to the current team, and the page renders a form to update its name, description, schedule
 * (via cron presets or a custom expression with a live human-readable description), grace
 * period, timezone, late-alert toggle, and enabled state. It exists so teams can reconfigure
 * scheduled-job monitoring after creation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	Alert,
	Button,
	Checkbox,
	ComboBox,
	Description,
	FieldError,
	Input,
	Label,
	LinkButton,
	ListBox,
	NumberField,
	Popover,
	Select,
	TextArea,
	TextField,
} from "@pkg/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { href, Link, redirect, useFetcher } from "react-router";
import { useSpinDelay } from "spin-delay";

import { AppHeader } from "~/components/app-header";
import { useTeam } from "~/hooks/use-team";
import { hasActiveSubscription } from "~/middleware/customer-subscription";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";
import { team } from "~/middleware/team";
import CronJobMonitor from "~/models/cron-job-monitor";

import type { Route } from "./+types/route";

const CRON_PRESETS = [
	{ id: "custom", expression: "" },
	{ id: "everyMinute", expression: "* * * * *" },
	{ id: "every5Minutes", expression: "*/5 * * * *" },
	{ id: "every15Minutes", expression: "*/15 * * * *" },
	{ id: "everyHour", expression: "0 * * * *" },
	{ id: "everyDay", expression: "0 0 * * *" },
	{ id: "everyWeek", expression: "0 0 * * 0" },
] as const;

const COMMON_TIMEZONES = [
	"UTC",
	"America/New_York",
	"America/Chicago",
	"America/Denver",
	"America/Los_Angeles",
	"America/Toronto",
	"America/Vancouver",
	"America/Sao_Paulo",
	"America/Mexico_City",
	"Europe/London",
	"Europe/Paris",
	"Europe/Berlin",
	"Europe/Madrid",
	"Europe/Rome",
	"Europe/Amsterdam",
	"Europe/Stockholm",
	"Europe/Warsaw",
	"Europe/Moscow",
	"Asia/Dubai",
	"Asia/Kolkata",
	"Asia/Singapore",
	"Asia/Hong_Kong",
	"Asia/Tokyo",
	"Asia/Seoul",
	"Asia/Shanghai",
	"Australia/Sydney",
	"Australia/Melbourne",
	"Pacific/Auckland",
];

export async function loader({ params }: Route.LoaderArgs) {
	logger().info("cronJobEdit.loader.start", {
		route: "cron-jobs.$cronJobId.edit",
		cronJobId: params.cronJobId,
		teamId: team().id,
	});

	let cronJob = await CronJobMonitor.findByIdAndTeam(db(), params.cronJobId, team().id);

	if (!cronJob) {
		logger().info("cronJobEdit.loader.not-found", {
			route: "cron-jobs.$cronJobId.edit",
			cronJobId: params.cronJobId,
			teamId: team().id,
		});
		return redirect(href("/app/:team/cron-jobs", params));
	}

	logger().info("cronJobEdit.loader.complete", {
		route: "cron-jobs.$cronJobId.edit",
		cronJobId: cronJob.id,
		teamId: team().id,
	});

	return {
		hasActiveSubscription: await hasActiveSubscription(),
		cronJob: {
			id: cronJob.id,
			name: cronJob.name,
			description: cronJob.description,
			cronExpression: cronJob.cronExpression,
			gracePeriodSeconds: cronJob.gracePeriodSeconds,
			timezone: cronJob.timezone,
			alertOnLate: cronJob.alertOnLate,
			enabledAt: cronJob.enabledAt,
		},
	};
}

export default function EditCronJobPage({ loaderData, params }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "page.editCronJob" });
	let { t: tSidebar } = useTranslation("translation", {
		keyPrefix: "app.layout.sidebar.navigation.items",
	});

	return (
		<>
			<AppHeader
				heading={t("header.title")}
				breadcrumbs={[
					{ label: tSidebar("dashboard"), href: href("/app/:team/dashboard", params) },
					{
						label: t("header.breadcrumb.cronJobs"),
						href: href("/app/:team/cron-jobs", params),
					},
					{
						label: loaderData.cronJob.name,
						href: href("/app/:team/cron-jobs/:cronJobId", {
							team: params.team,
							cronJobId: loaderData.cronJob.id,
						}),
					},
					{ label: t("header.title") },
				]}
			/>

			{loaderData.hasActiveSubscription ? null : (
				<div className="p-4">
					<Alert color="warning">
						<Alert.Content>
							<Alert.Title>{t("alert.subscription.title")}</Alert.Title>
							<Alert.Description>{t("alert.subscription.description")}</Alert.Description>
						</Alert.Content>
						<Alert.Action>
							<Link to={href("/app/:team/checkout", params)}>{t("alert.subscription.cta")}</Link>
						</Alert.Action>
					</Alert>
				</div>
			)}

			<div className="flex flex-col gap-6 p-5 md:gap-12 md:p-12">
				<EditCronJobForm cronJob={loaderData.cronJob} />
			</div>
		</>
	);
}

function EditCronJobForm({
	cronJob,
}: {
	cronJob: {
		id: string;
		name: string;
		description: string | null;
		cronExpression: string;
		gracePeriodSeconds: number;
		timezone: string;
		alertOnLate: boolean;
		enabledAt: Date | null;
	};
}) {
	let { t } = useTranslation("translation", { keyPrefix: "page.editCronJob.form" });

	// Determine initial preset
	let initialPreset =
		CRON_PRESETS.find((p) => p.expression === cronJob.cronExpression)?.id ?? "custom";
	let [selectedPreset, setSelectedPreset] = useState<string>(initialPreset);
	let [cronExpression, setCronExpression] = useState(cronJob.cronExpression);
	let [cronDescription, setCronDescription] = useState(
		CronJobMonitor.describeCronExpression(cronJob.cronExpression),
	);

	let fetcher = useFetcher();
	let isPending = useSpinDelay(fetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	let team = useTeam();

	function handlePresetChange(preset: string) {
		setSelectedPreset(preset);
		let presetConfig = CRON_PRESETS.find((p) => p.id === preset);
		if (presetConfig && presetConfig.expression) {
			setCronExpression(presetConfig.expression);
			setCronDescription(CronJobMonitor.describeCronExpression(presetConfig.expression));
		}
	}

	function handleCronExpressionChange(value: string) {
		setCronExpression(value);
		setSelectedPreset("custom");
		try {
			setCronDescription(CronJobMonitor.describeCronExpression(value));
		} catch {
			setCronDescription("");
		}
	}

	return (
		<fetcher.Form
			method="POST"
			className="mx-auto flex w-full max-w-prose flex-col gap-6"
			action={href("/actions/:team/update-cron-job", { team: team.slug })}
		>
			<input type="hidden" name="cronJobId" value={cronJob.id} />

			<TextField type="text" name="name" isRequired defaultValue={cronJob.name}>
				<Label>{t("fields.name.label")}</Label>
				<Input placeholder={t("fields.name.placeholder")} />
				<FieldError />
				<Description>{t("fields.name.description")}</Description>
			</TextField>

			<TextField type="text" name="description" defaultValue={cronJob.description ?? ""}>
				<Label>{t("fields.description.label")}</Label>
				<TextArea placeholder={t("fields.description.placeholder")} rows={3} />
				<FieldError />
				<Description>{t("fields.description.description")}</Description>
			</TextField>

			<Select
				selectedKey={selectedPreset}
				onSelectionChange={(key) => handlePresetChange(key as string)}
			>
				<Label>{t("fields.preset.label")}</Label>
				<Select.Trigger />
				<Popover>
					<ListBox>
						{CRON_PRESETS.map((preset) => (
							<ListBox.Item key={preset.id} id={preset.id}>
								{t(`fields.preset.options.${preset.id}`)}
							</ListBox.Item>
						))}
					</ListBox>
				</Popover>
				<Description>{t("fields.preset.description")}</Description>
			</Select>

			<TextField
				type="text"
				name="cronExpression"
				isRequired
				value={cronExpression}
				onChange={handleCronExpressionChange}
			>
				<Label>{t("fields.cronExpression.label")}</Label>
				<Input placeholder={t("fields.cronExpression.placeholder")} />
				<FieldError />
				{cronDescription ? (
					<Description className="text-green-600 dark:text-green-400">
						{cronDescription}
					</Description>
				) : (
					<Description>{t("fields.cronExpression.description")}</Description>
				)}
			</TextField>

			<NumberField
				name="gracePeriodMinutes"
				isRequired
				minValue={1}
				maxValue={60}
				defaultValue={Math.round(cronJob.gracePeriodSeconds / 60)}
			>
				<Label>{t("fields.gracePeriod.label")}</Label>
				<div className="flex items-center gap-2">
					<NumberField.Group>
						<NumberField.DecrementButton />
						<NumberField.Input />
						<NumberField.IncrementButton />
					</NumberField.Group>
					<span className="text-sm text-neutral-500 dark:text-neutral-400">
						{t("fields.gracePeriod.unit.minutes")}
					</span>
				</div>
				<FieldError />
				<Description>{t("fields.gracePeriod.description")}</Description>
			</NumberField>

			<ComboBox name="timezone" defaultInputValue={cronJob.timezone} allowsCustomValue>
				<Label>{t("fields.timezone.label")}</Label>
				<ComboBox.Input placeholder={t("fields.timezone.placeholder")} />
				<Popover>
					<ListBox>
						{COMMON_TIMEZONES.map((tz) => (
							<ListBox.Item key={tz} id={tz}>
								{tz}
							</ListBox.Item>
						))}
					</ListBox>
				</Popover>
				<FieldError />
				<Description>{t("fields.timezone.description")}</Description>
			</ComboBox>

			<Checkbox name="alertOnLate" defaultSelected={cronJob.alertOnLate}>
				<div className="flex flex-col">
					<span>{t("fields.alertOnLate.label")}</span>
					<span className="text-sm text-neutral-500 dark:text-neutral-400">
						{t("fields.alertOnLate.description")}
					</span>
				</div>
			</Checkbox>

			<Checkbox name="enabled" defaultSelected={cronJob.enabledAt !== null}>
				<div className="flex flex-col">
					<span>{t("fields.enabled.label")}</span>
					<span className="text-sm text-neutral-500 dark:text-neutral-400">
						{t("fields.enabled.description")}
					</span>
				</div>
			</Checkbox>

			<div className="flex justify-end gap-2">
				<LinkButton
					color="neutral"
					href={href("/app/:team/cron-jobs/:cronJobId", {
						team: team.slug,
						cronJobId: cronJob.id,
					})}
				>
					{t("cancel")}
				</LinkButton>
				<Button type="submit" isPending={isPending}>
					{t("cta")}
				</Button>
			</div>
		</fetcher.Form>
	);
}
