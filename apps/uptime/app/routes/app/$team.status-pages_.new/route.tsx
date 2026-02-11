import {
	Button,
	Checkbox,
	Description,
	FieldError,
	Input,
	Label,
	Switch,
	TextArea,
	TextField,
} from "@pkg/ui";
import { useTranslation } from "react-i18next";
import { href, useFetcher } from "react-router";
import { useSpinDelay } from "spin-delay";

import { AppHeader } from "~/components/app-header";
import { useTeam } from "~/hooks/use-team";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";
import { team } from "~/middleware/team";

import type { Route } from "./+types/route";

export async function loader() {
	logger().info("statusPageNew.loader.start", {
		route: "status-pages.new",
		teamId: team().id,
	});

	let [monitors, cronJobs] = await Promise.all([
		db().query.monitors.findMany({
			columns: { id: true, name: true },
			where(fields, operators) {
				return operators.eq(fields.teamId, team().id);
			},
			orderBy(fields, operators) {
				return operators.asc(fields.name);
			},
		}),
		db().query.cronJobMonitors.findMany({
			columns: { id: true, name: true },
			where(fields, operators) {
				return operators.eq(fields.teamId, team().id);
			},
			orderBy(fields, operators) {
				return operators.asc(fields.name);
			},
		}),
	]);

	logger().info("statusPageNew.loader.complete", {
		route: "status-pages.new",
		teamId: team().id,
		monitorsCount: monitors.length,
		cronJobsCount: cronJobs.length,
	});

	return { monitors, cronJobs };
}

export default function Component({ loaderData, params }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "page.createStatusPage" });
	let { t: tSidebar } = useTranslation("translation", {
		keyPrefix: "app.layout.sidebar.navigation.items",
	});

	return (
		<>
			<AppHeader
				heading={t("header.title")}
				breadcrumbs={[
					{ label: tSidebar("statusPages"), href: href("/app/:team/status-pages", params) },
					{ label: t("header.title") },
				]}
			/>

			<div className="flex flex-col gap-6 p-5 md:gap-12 md:p-12">
				<CreateStatusPageForm monitors={loaderData.monitors} cronJobs={loaderData.cronJobs} />
			</div>
		</>
	);
}

function CreateStatusPageForm(props: {
	monitors: Array<{ id: string; name: string }>;
	cronJobs: Array<{ id: string; name: string }>;
}) {
	let { t } = useTranslation("translation", {
		keyPrefix: "page.statusPages.form",
	});
	let team = useTeam();

	let fetcher = useFetcher();
	let isPending = useSpinDelay(fetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	return (
		<fetcher.Form
			method="POST"
			action={href("/actions/:team/create-status-page", { team: team.slug })}
			className="mx-auto flex w-full max-w-prose flex-col gap-6"
		>
			<TextField type="text" name="name" isRequired>
				<Label>{t("fields.name.label")}</Label>
				<Input placeholder={t("fields.name.placeholder")} />
				<Description>{t("fields.name.description")}</Description>
				<FieldError />
			</TextField>

			<TextField type="text" name="slug" isRequired>
				<Label>{t("fields.slug.label")}</Label>
				<Input placeholder={t("fields.slug.placeholder")} />
				<Description>{t("fields.slug.description")}</Description>
				<FieldError />
			</TextField>

			<TextField type="text" name="title" isRequired>
				<Label>{t("fields.title.label")}</Label>
				<Input placeholder={t("fields.title.placeholder")} />
				<Description>{t("fields.title.description")}</Description>
				<FieldError />
			</TextField>

			<TextField type="text" name="description">
				<Label>{t("fields.description.label")}</Label>
				<TextArea placeholder={t("fields.description.placeholder")} />
				<Description>{t("fields.description.description")}</Description>
				<FieldError />
			</TextField>

			<TextField type="url" name="logoUrl">
				<Label>{t("fields.logoUrl.label")}</Label>
				<Input placeholder={t("fields.logoUrl.placeholder")} />
				<Description>{t("fields.logoUrl.description")}</Description>
				<FieldError />
			</TextField>

			<div className="flex flex-col gap-4">
				<div className="flex flex-col gap-1">
					<Switch name="isPublic" defaultSelected>
						<span className="font-medium">{t("fields.isPublic.label")}</span>
					</Switch>
					<Description className="text-sm text-neutral-500 dark:text-neutral-400">
						{t("fields.isPublic.description")}
					</Description>
				</div>

				<div className="flex flex-col gap-1">
					<Switch name="showOverallStatus" defaultSelected>
						<span className="font-medium">{t("fields.showOverallStatus.label")}</span>
					</Switch>
					<Description className="text-sm text-neutral-500 dark:text-neutral-400">
						{t("fields.showOverallStatus.description")}
					</Description>
				</div>
			</div>

			{props.monitors.length > 0 && (
				<fieldset className="flex flex-col gap-3">
					<legend className="mb-2 font-medium">{t("fields.monitors.label")}</legend>
					<Description className="mb-2 text-sm text-neutral-500 dark:text-neutral-400">
						{t("fields.monitors.description")}
					</Description>
					{props.monitors.map((monitor) => (
						<Checkbox key={monitor.id} name="monitorIds" value={monitor.id}>
							{monitor.name}
						</Checkbox>
					))}
				</fieldset>
			)}

			{props.cronJobs.length > 0 && (
				<fieldset className="flex flex-col gap-3">
					<legend className="mb-2 font-medium">{t("fields.cronJobs.label")}</legend>
					<Description className="mb-2 text-sm text-neutral-500 dark:text-neutral-400">
						{t("fields.cronJobs.description")}
					</Description>
					{props.cronJobs.map((cronJob) => (
						<Checkbox key={cronJob.id} name="cronJobIds" value={cronJob.id}>
							{cronJob.name}
						</Checkbox>
					))}
				</fieldset>
			)}

			<Button type="submit" className="self-end" isPending={isPending}>
				{t("cta")}
			</Button>
		</fetcher.Form>
	);
}
