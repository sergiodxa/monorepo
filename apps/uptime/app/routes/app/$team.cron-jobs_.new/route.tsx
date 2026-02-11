import {
	Alert,
	Button,
	Checkbox,
	ComboBox,
	Description,
	FieldError,
	Input,
	Label,
	ListBox,
	NumberField,
	Popover,
	Select,
	TextArea,
	TextField,
} from "@pkg/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { href, Link, useFetcher } from "react-router";
import { useSpinDelay } from "spin-delay";

import { AppHeader } from "~/components/app-header";
import { useTeam } from "~/hooks/use-team";
import { hasActiveSubscription } from "~/middleware/customer-subscription";
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

export async function loader() {
	logger().info("cronJobNew.loader.start", {
		route: "cron-jobs.new",
		teamId: team().id,
	});

	let activeSubscription = await hasActiveSubscription();

	logger().info("cronJobNew.loader.complete", {
		route: "cron-jobs.new",
		teamId: team().id,
		hasActiveSubscription: activeSubscription,
	});

	return { hasActiveSubscription: activeSubscription };
}

export default function CreateCronJobPage({ loaderData, params }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "page.createCronJob" });
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
				<CreateCronJobForm />
			</div>
		</>
	);
}

function CreateCronJobForm() {
	let { t } = useTranslation("translation", { keyPrefix: "page.createCronJob.form" });
	let [selectedPreset, setSelectedPreset] = useState<string>("custom");
	let [cronExpression, setCronExpression] = useState("");
	let [cronDescription, setCronDescription] = useState("");

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
			action={href("/actions/:team/create-cron-job", { team: team.slug })}
		>
			<TextField type="text" name="name" isRequired>
				<Label>{t("fields.name.label")}</Label>
				<Input placeholder={t("fields.name.placeholder")} />
				<FieldError />
				<Description>{t("fields.name.description")}</Description>
			</TextField>

			<TextField type="text" name="description">
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

			<NumberField name="gracePeriodMinutes" isRequired minValue={1} maxValue={60} defaultValue={5}>
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

			<ComboBox name="timezone" defaultInputValue="UTC" allowsCustomValue>
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

			<Checkbox name="alertOnLate" defaultSelected={false}>
				<div className="flex flex-col">
					<span>{t("fields.alertOnLate.label")}</span>
					<span className="text-sm text-neutral-500 dark:text-neutral-400">
						{t("fields.alertOnLate.description")}
					</span>
				</div>
			</Checkbox>

			<Checkbox name="enabled" defaultSelected>
				<div className="flex flex-col">
					<span>{t("fields.enabled.label")}</span>
					<span className="text-sm text-neutral-500 dark:text-neutral-400">
						{t("fields.enabled.description")}
					</span>
				</div>
			</Checkbox>

			<Button type="submit" className="self-end" isPending={isPending}>
				{t("cta")}
			</Button>
		</fetcher.Form>
	);
}
