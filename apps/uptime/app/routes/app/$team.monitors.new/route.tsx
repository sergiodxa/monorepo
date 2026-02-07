import {
	Alert,
	Button,
	ComboBox,
	Description,
	FieldError,
	Input,
	Label,
	ListBox,
	Popover,
	Select,
	Slider,
	TextField,
} from "@pkg/ui";
import { useTranslation } from "react-i18next";
import { href, Link, useFetcher } from "react-router";
import { useSpinDelay } from "spin-delay";

import { AppHeader } from "~/components/app-header";
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
	let { t: tSidebar } = useTranslation("translation", {
		keyPrefix: "app.layout.sidebar.navigation.items",
	});

	return (
		<>
			<AppHeader
				heading={t("header.title")}
				breadcrumbs={[
					{ label: tSidebar("dashboard"), href: href("/app/:team/dashboard", params) },
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
			className="mx-auto flex w-full max-w-prose flex-col gap-6"
			action={href("/actions/:team/create-monitor", { team: team.slug })}
		>
			<TextField type="text" name="name" isRequired>
				<Label>{t("fields.name.label")}</Label>
				<Input placeholder={t("fields.name.placeholder")} />
				<FieldError />
				<Description>{t("fields.name.description")}</Description>
			</TextField>

			<TextField type="url" name="url" isRequired>
				<Label>{t("fields.url.label")}</Label>
				<Input type="url" placeholder={t("fields.url.placeholder")} />
				<FieldError />
				<Description>{t("fields.url.description")}</Description>
			</TextField>

			<Slider
				minValue={1}
				maxValue={60}
				step={1}
				defaultValue={10}
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

			<ComboBox name="expectedStatus" defaultSelectedKey="200" isRequired>
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

			<Select name="region" isRequired>
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

			<Button type="submit" className="self-end" isPending={isPending} name="intent" value={INTENT}>
				{t("cta")}
			</Button>
		</fetcher.Form>
	);
}
