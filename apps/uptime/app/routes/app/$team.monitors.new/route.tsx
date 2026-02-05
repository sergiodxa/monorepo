import { cn } from "@pkg/cn";
import { ChevronDownIcon, LoaderIcon } from "lucide-react";
import {
	Button as AriaButton,
	ListBox,
	ListBoxItem,
	Popover,
	Select,
	SelectValue,
	TextField,
} from "react-aria-components";
import { useTranslation } from "react-i18next";
import { href, Link, useFetcher } from "react-router";
import { useSpinDelay } from "spin-delay";

import { AppHeader } from "~/components/app-header";
import { Alert } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import * as Field from "~/components/ui/field";
import { useTeam } from "~/hooks/use-team";
import { hasActiveSubscription } from "~/middleware/customer-subscription";
import regionToEmoji from "~/utils/region-to-emoji";

import type { Route } from "./+types/route";

const INTENT = "create";

const REGIONS = ["afr", "apac", "eeur", "enam", "me", "oc", "sam", "weur", "wnam"] as const;

export async function loader() {
	return { hasActiveSubscription: await hasActiveSubscription() };
}

export default function MonitorsNew({ loaderData, params }: Route.ComponentProps) {
	let { t } = useTranslation("translation", {
		keyPrefix: "page.createMonitor",
	});

	return (
		<>
			<AppHeader heading={t("header.title")} />

			{loaderData.hasActiveSubscription ? null : (
				<div className="p-4">
					<Alert
						intent="warning"
						title={t("alert.subscription.title")}
						description={t("alert.subscription.description")}
						cta={
							<Link to={href("/app/:team/checkout", params)}>{t("alert.subscription.cta")}</Link>
						}
					/>
				</div>
			)}

			<div className="p-12 flex flex-col gap-12">
				<CreateMonitorForm />
			</div>
		</>
	);
}

function CreateMonitorForm() {
	let { t } = useTranslation("translation", {
		keyPrefix: "page.createMonitor.form",
	});

	let fetcher = useFetcher();
	let isPending = useSpinDelay(fetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	let team = useTeam();

	return (
		<fetcher.Form
			method="POST"
			className="max-w-prose w-full mx-auto flex flex-col gap-6"
			action={href("/actions/:team/create-monitor", { team: team.slug })}
		>
			<TextField type="text" name="name" className="flex flex-col gap-1" isRequired>
				<Field.Label>{t("fields.name.label")}</Field.Label>
				<Field.Input placeholder={t("fields.name.placeholder")} />
				<Field.FieldError />
				<Field.Description>{t("fields.name.description")}</Field.Description>
			</TextField>

			<Field.Group>
				<TextField type="url" name="url" className="flex flex-col gap-1" isRequired>
					<Field.Label>{t("fields.url.label")}</Field.Label>
					<Field.Input type="url" placeholder={t("fields.url.placeholder")} />
					<Field.FieldError />
					<Field.Description>{t("fields.url.description")}</Field.Description>
				</TextField>

				<Field.Slider
					name="intervalSeconds"
					minValue={1}
					minValueLabel="1m"
					maxValueLabel="60m"
					defaultValue={10}
					maxValue={60} // 24 hours
					step={1}
					label={t("fields.interval.label")}
					formatOptions={{
						style: "unit",
						unit: "minute",
						unitDisplay: "narrow",
						minimumFractionDigits: 0,
						maximumFractionDigits: 0,
					}}
				/>
			</Field.Group>

			<Field.Group>
				<TextField
					type="text"
					name="expectedStatus"
					className="flex flex-col gap-1"
					isRequired
					defaultValue="200"
				>
					<Field.Label>{t("fields.status.label")}</Field.Label>

					<Field.Input
						inputMode="numeric"
						placeholder={t("fields.status.placeholder")}
						datalist={[
							{ value: "200", label: "Ok" },
							{ value: "201", label: "Created" },
							{ value: "202", label: "Accepted" },
							{ value: "204", label: "No Content" },
							{ value: "301", label: "Moved Permanently" },
							{ value: "302", label: "Found" },
							{ value: "303", label: "See Other" },
							{ value: "304", label: "Not Modified" },
							{ value: "307", label: "Temporary Redirect" },
							{ value: "308", label: "Permanent Redirect" },
							{ value: "400", label: "Bad Request" },
							{ value: "401", label: "Unauthorized" },
							{ value: "403", label: "Forbidden" },
							{ value: "404", label: "Not Found" },
							{ value: "405", label: "Method Not Allowed" },
							{ value: "500", label: "Internal Server Error" },
						]}
					/>
					<Field.FieldError />

					<Field.Description>{t("fields.status.description")}</Field.Description>
				</TextField>

				<Select name="region" className="flex flex-col gap-1" isRequired>
					<Field.Label>{t("fields.region.label")}</Field.Label>

					<AriaButton
						className={
							"border border-solid border-neutral-400 rounded focus:outline-2 focus:outline-primary-500 py-2 px-4 ring-0 user-invalid:outline-red-500 user-invalid:outline-2 flex items-center justify-between gap-2"
						}
					>
						<SelectValue />
						<ChevronDownIcon className="size-4" aria-hidden />
					</AriaButton>

					<Field.FieldError />

					<Field.Description>{t("fields.region.description")}</Field.Description>

					<Popover
						className="bg-white shadow dark:bg-neutral-800 rounded-lg"
						style={{ minWidth: "var(--trigger-width)" }}
					>
						<ListBox className="flex flex-col gap-0.5 p-1">
							{REGIONS.map((region) => (
								<ListBoxItem
									key={region}
									className={cn(
										// Default
										"flex items-center justify-between",
										"cursor-default py-1 px-2 rounded",
										// Selected
										"data-[selected]:after:content-['✓']",
										// Hovered
										"data-[hovered]:bg-primary-50 data-[hovered]:text-primary-900",
										"dark:data-[hovered]:bg-primary-800 dark:data-[hovered]:text-primary-200",
										// Focused
										"data-[focused]:bg-primary-50 data-[focused]:text-primary-900",
										"dark:data-[focused]:bg-primary-800 dark:data-[focused]:text-primary-200",
										// Disabled
										"data-[disabled]:text-neutral-400 data-[disabled]:cursor-not-allowed",
									)}
								>
									{t(`fields.region.options.${region}`, {
										emoji: regionToEmoji(region),
									})}
								</ListBoxItem>
							))}
						</ListBox>
					</Popover>
				</Select>
			</Field.Group>

			<Button
				type="submit"
				className="flex items-center justify-between self-end"
				isPending={isPending}
				name="intent"
				value={INTENT}
			>
				<span>{t("cta")}</span>
				{isPending && <LoaderIcon className="size-5 animate-spin" />}
			</Button>
		</fetcher.Form>
	);
}
