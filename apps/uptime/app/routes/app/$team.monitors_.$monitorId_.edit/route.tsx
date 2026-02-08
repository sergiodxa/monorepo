import {
	Alert,
	Button,
	Card,
	Checkbox,
	ComboBox,
	Description,
	FieldError,
	Input,
	Label,
	LinkButton,
	ListBox,
	Popover,
	Select,
	Slider,
	TextField,
} from "@pkg/ui";
import { format } from "date-fns";
import { FileSearchIcon, LockIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { href, Link, redirect, useFetcher } from "react-router";
import { useSpinDelay } from "spin-delay";

import type { SelectMonitorContentCheck } from "~/db/schema";

import { AppHeader } from "~/components/app-header";
import { useTeam } from "~/hooks/use-team";
import { hasActiveSubscription } from "~/middleware/customer-subscription";
import { db } from "~/middleware/drizzle";
import { team } from "~/middleware/team";
import regionToEmoji from "~/utils/region-to-emoji";

import type { Route } from "./+types/route";

const REGIONS = ["afr", "apac", "eeur", "enam", "me", "oc", "sam", "weur", "wnam"] as const;

export async function loader({ params }: Route.LoaderArgs) {
	let monitor = await db().query.monitors.findFirst({
		where(fields, operators) {
			return operators.and(
				operators.eq(fields.id, params.monitorId),
				operators.eq(fields.teamId, team().id),
			);
		},
		with: {
			contentChecks: {
				orderBy(fields, operators) {
					return operators.asc(fields.createdAt);
				},
			},
		},
	});

	if (!monitor) {
		return redirect(href("/app/:team/dashboard", params));
	}

	return {
		hasActiveSubscription: await hasActiveSubscription(),
		monitor: {
			id: monitor.id,
			name: monitor.name,
			url: monitor.url,
			expectedStatus: monitor.expectedStatus,
			intervalSeconds: monitor.intervalSeconds,
			locationHint: monitor.locationHint,
			// SSL settings
			sslMonitoringEnabled: monitor.sslMonitoringEnabled,
			sslExpiryWarningDays: monitor.sslExpiryWarningDays,
			sslExpiresAt: monitor.sslExpiresAt,
			sslIssuer: monitor.sslIssuer,
			// Content checks
			contentChecks: monitor.contentChecks,
		},
	};
}

export default function MonitorsEdit({ loaderData, params }: Route.ComponentProps) {
	let { t } = useTranslation("translation", {
		keyPrefix: "page.editMonitor",
	});
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
						label: loaderData.monitor.name,
						href: href("/app/:team/monitors/:monitorId", {
							team: params.team,
							monitorId: loaderData.monitor.id,
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

			<div className="flex flex-col gap-12 p-12">
				<EditMonitorForm monitor={loaderData.monitor} />
				<ContentChecksSection
					monitorId={loaderData.monitor.id}
					contentChecks={loaderData.monitor.contentChecks}
				/>
				<SslSettingsForm monitor={loaderData.monitor} />
			</div>
		</>
	);
}

interface MonitorData {
	id: string;
	name: string;
	url: string;
	expectedStatus: number;
	intervalSeconds: number;
	locationHint: (typeof REGIONS)[number];
	sslMonitoringEnabled: boolean;
	sslExpiryWarningDays: number;
	sslExpiresAt: Date | null;
	sslIssuer: string | null;
	contentChecks: SelectMonitorContentCheck[];
}

function EditMonitorForm({ monitor }: { monitor: MonitorData }) {
	let { t } = useTranslation("translation", {
		keyPrefix: "page.editMonitor.form",
	});

	let fetcher = useFetcher();
	let isPending = useSpinDelay(fetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	let team = useTeam();

	// Convert interval from seconds to minutes for the slider
	let intervalMinutes = monitor.intervalSeconds / 60;

	return (
		<fetcher.Form
			method="POST"
			className="mx-auto flex w-full max-w-prose flex-col gap-6"
			action={href("/actions/:team/update-monitor", { team: team.slug })}
		>
			<input type="hidden" name="monitorId" value={monitor.id} />

			<TextField type="text" name="name" isRequired defaultValue={monitor.name}>
				<Label>{t("fields.name.label")}</Label>
				<Input placeholder={t("fields.name.placeholder")} />
				<FieldError />
				<Description>{t("fields.name.description")}</Description>
			</TextField>

			<TextField type="url" name="url" isRequired defaultValue={monitor.url}>
				<Label>{t("fields.url.label")}</Label>
				<Input type="url" placeholder={t("fields.url.placeholder")} />
				<FieldError />
				<Description>{t("fields.url.description")}</Description>
			</TextField>

			<Slider
				minValue={1}
				maxValue={60}
				step={1}
				defaultValue={intervalMinutes}
				formatOptions={{
					style: "unit",
					unit: "minute",
					unitDisplay: "narrow",
					minimumFractionDigits: 0,
					maximumFractionDigits: 0,
				}}
			>
				<div className="flex justify-between">
					<Label>{t("fields.interval.label")}</Label>
					<Slider.Output />
				</div>
				<Slider.Track>
					<Slider.Thumb name="intervalSeconds" />
				</Slider.Track>
				<div className="flex justify-between text-sm text-neutral-500 dark:text-neutral-400">
					<span>1m</span>
					<span>60m</span>
				</div>
			</Slider>

			<ComboBox
				name="expectedStatus"
				defaultSelectedKey={String(monitor.expectedStatus)}
				isRequired
			>
				<Label>{t("fields.status.label")}</Label>
				<ComboBox.Group>
					<ComboBox.Input inputMode="numeric" />
					<ComboBox.Button />
				</ComboBox.Group>
				<FieldError />
				<Description>{t("fields.status.description")}</Description>
				<Popover>
					<ListBox>
						<ListBox.Item id="200">200 OK</ListBox.Item>
						<ListBox.Item id="201">201 Created</ListBox.Item>
						<ListBox.Item id="202">202 Accepted</ListBox.Item>
						<ListBox.Item id="204">204 No Content</ListBox.Item>
						<ListBox.Item id="301">301 Moved Permanently</ListBox.Item>
						<ListBox.Item id="302">302 Found</ListBox.Item>
						<ListBox.Item id="303">303 See Other</ListBox.Item>
						<ListBox.Item id="304">304 Not Modified</ListBox.Item>
						<ListBox.Item id="307">307 Temporary Redirect</ListBox.Item>
						<ListBox.Item id="308">308 Permanent Redirect</ListBox.Item>
						<ListBox.Item id="400">400 Bad Request</ListBox.Item>
						<ListBox.Item id="401">401 Unauthorized</ListBox.Item>
						<ListBox.Item id="403">403 Forbidden</ListBox.Item>
						<ListBox.Item id="404">404 Not Found</ListBox.Item>
						<ListBox.Item id="405">405 Method Not Allowed</ListBox.Item>
						<ListBox.Item id="500">500 Internal Server Error</ListBox.Item>
					</ListBox>
				</Popover>
			</ComboBox>

			<Select name="region" isRequired defaultSelectedKey={monitor.locationHint}>
				<Label>{t("fields.region.label")}</Label>
				<Select.Trigger />
				<FieldError />
				<Description>{t("fields.region.description")}</Description>
				<Popover>
					<ListBox>
						{REGIONS.map((region) => (
							<ListBox.Item key={region} id={region}>
								{t(`fields.region.options.${region}`, {
									emoji: regionToEmoji(region),
								})}
							</ListBox.Item>
						))}
					</ListBox>
				</Popover>
			</Select>

			<div className="flex justify-end gap-2">
				<LinkButton
					color="neutral"
					href={href("/app/:team/monitors/:monitorId", { team: team.slug, monitorId: monitor.id })}
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

function ContentChecksSection({
	monitorId,
	contentChecks,
}: {
	monitorId: string;
	contentChecks: SelectMonitorContentCheck[];
}) {
	let teamData = useTeam();
	let [showAddForm, setShowAddForm] = useState(false);

	let addFetcher = useFetcher();
	let isAddPending = useSpinDelay(addFetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	// Close form after successful submission
	if (addFetcher.state === "idle" && addFetcher.data?.ok && showAddForm) {
		setShowAddForm(false);
	}

	return (
		<Card>
			<Card.Header>
				<div className="flex items-center gap-2">
					<FileSearchIcon className="size-5" />
					<Card.Title>Content Monitoring</Card.Title>
				</div>
				<Card.Description>
					Check response content for specific keywords or patterns. The monitor will fail if any
					check does not pass.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<div className="flex flex-col gap-6">
					{/* Existing content checks */}
					{contentChecks.length > 0 && (
						<div className="flex flex-col gap-3">
							{contentChecks.map((check) => (
								<ContentCheckItem key={check.id} check={check} monitorId={monitorId} />
							))}
						</div>
					)}

					{/* Add new content check form */}
					{showAddForm ? (
						<addFetcher.Form
							method="POST"
							action={href("/actions/:team/create-content-check", { team: teamData.slug })}
							className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
						>
							<input type="hidden" name="monitorId" value={monitorId} />

							<Select name="type" isRequired defaultSelectedKey="contains">
								<Label>Check Type</Label>
								<Select.Trigger />
								<FieldError />
								<Description>Choose how to match the response content</Description>
								<Popover>
									<ListBox>
										<ListBox.Item id="contains">Contains</ListBox.Item>
										<ListBox.Item id="not_contains">Does Not Contain</ListBox.Item>
										<ListBox.Item id="regex">Regex Pattern</ListBox.Item>
									</ListBox>
								</Popover>
							</Select>

							<TextField name="value" isRequired>
								<Label>Value</Label>
								<Input placeholder="Enter keyword or pattern" />
								<FieldError />
								<Description>The text or regex pattern to check for</Description>
							</TextField>

							<Checkbox name="caseSensitive">Case sensitive matching</Checkbox>

							<div className="flex justify-end gap-2">
								<Button color="neutral" onPress={() => setShowAddForm(false)}>
									Cancel
								</Button>
								<Button type="submit" isPending={isAddPending}>
									Add Check
								</Button>
							</div>
						</addFetcher.Form>
					) : (
						<Button color="neutral" onPress={() => setShowAddForm(true)}>
							<PlusIcon className="size-4" />
							Add Content Check
						</Button>
					)}

					{contentChecks.length === 0 && !showAddForm && (
						<p className="text-sm text-neutral-500 dark:text-neutral-400">
							No content checks configured. Add a check to monitor for specific keywords or patterns
							in the response.
						</p>
					)}
				</div>
			</Card.Content>
		</Card>
	);
}

function ContentCheckItem({
	check,
	monitorId,
}: {
	check: SelectMonitorContentCheck;
	monitorId: string;
}) {
	let teamData = useTeam();
	let deleteFetcher = useFetcher();
	let isDeletePending = useSpinDelay(deleteFetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	let typeLabels: Record<string, string> = {
		contains: "Contains",
		not_contains: "Does Not Contain",
		regex: "Regex",
	};

	return (
		<div className="flex items-center justify-between rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
			<div className="flex flex-col gap-1">
				<div className="flex items-center gap-2">
					<span className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium dark:bg-neutral-800">
						{typeLabels[check.type] ?? check.type}
					</span>
					{check.caseSensitive && (
						<span className="text-xs text-neutral-500 dark:text-neutral-400">Case sensitive</span>
					)}
					{!check.isEnabled && (
						<span className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded px-2 py-0.5 text-xs">
							Disabled
						</span>
					)}
				</div>
				<code className="max-w-md truncate text-sm text-neutral-700 dark:text-neutral-300">
					{check.value}
				</code>
			</div>
			<deleteFetcher.Form
				method="POST"
				action={`${href("/actions/:team/delete-content-check", { team: teamData.slug })}?monitorId=${monitorId}`}
			>
				<input type="hidden" name="contentCheckId" value={check.id} />
				<Button
					type="submit"
					color="danger"
					size="sm"
					variant="ghost"
					isPending={isDeletePending}
					aria-label="Delete content check"
				>
					<TrashIcon className="size-4" />
				</Button>
			</deleteFetcher.Form>
		</div>
	);
}

function SslSettingsForm({ monitor }: { monitor: MonitorData }) {
	let { t } = useTranslation("translation", {
		keyPrefix: "page.editMonitor.form",
	});

	let fetcher = useFetcher();
	let isPending = useSpinDelay(fetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	let team = useTeam();

	let [sslEnabled, setSslEnabled] = useState(monitor.sslMonitoringEnabled);

	// Format the expiry date for the input
	let sslExpiresAtValue = monitor.sslExpiresAt ? format(monitor.sslExpiresAt, "yyyy-MM-dd") : "";

	return (
		<Card>
			<Card.Header>
				<div className="flex items-center gap-2">
					<LockIcon className="size-5" />
					<Card.Title>SSL Certificate Monitoring</Card.Title>
				</div>
				<Card.Description>
					Monitor your SSL certificate expiry and receive alerts before it expires.
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<fetcher.Form
					method="POST"
					className="flex flex-col gap-6"
					action={href("/actions/:team/update-ssl", { team: team.slug })}
				>
					<input type="hidden" name="monitorId" value={monitor.id} />

					<Checkbox name="sslMonitoringEnabled" isSelected={sslEnabled} onChange={setSslEnabled}>
						{t("fields.ssl.enabled.label")}
					</Checkbox>

					{sslEnabled && (
						<>
							<TextField name="sslExpiresAt" defaultValue={sslExpiresAtValue}>
								<Label>{t("fields.ssl.expiresAt.label")}</Label>
								<Input type="date" />
								<FieldError />
								<Description>{t("fields.ssl.expiresAt.description")}</Description>
							</TextField>

							<TextField name="sslIssuer" defaultValue={monitor.sslIssuer ?? ""}>
								<Label>{t("fields.ssl.issuer.label")}</Label>
								<Input placeholder={t("fields.ssl.issuer.placeholder")} />
								<FieldError />
								<Description>{t("fields.ssl.issuer.description")}</Description>
							</TextField>

							<Slider
								minValue={1}
								maxValue={90}
								step={1}
								defaultValue={monitor.sslExpiryWarningDays}
								formatOptions={{
									style: "unit",
									unit: "day",
									unitDisplay: "long",
								}}
							>
								<div className="flex justify-between">
									<Label>{t("fields.ssl.warningDays.label")}</Label>
									<Slider.Output />
								</div>
								<Slider.Track>
									<Slider.Thumb name="sslExpiryWarningDays" />
								</Slider.Track>
								<div className="flex justify-between text-sm text-neutral-500 dark:text-neutral-400">
									<span>1 day</span>
									<span>90 days</span>
								</div>
								<Description>{t("fields.ssl.warningDays.description")}</Description>
							</Slider>
						</>
					)}

					<div className="flex justify-end">
						<Button type="submit" isPending={isPending}>
							Save SSL Settings
						</Button>
					</div>
				</fetcher.Form>
			</Card.Content>
		</Card>
	);
}
