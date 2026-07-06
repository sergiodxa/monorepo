/**
 * Route module for the status pages list. Its loader lists the team's status pages with
 * their linked-monitor counts and visibility, and the component renders them in a table
 * with links to the public page, plus per-row view, edit, and confirm-delete actions,
 * falling back to an empty state prompting creation when the team has none.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { cn } from "@pkg/cn";
import { Button, confirm, Empty, LinkButton, Menu, Popover, Table } from "@pkg/ui";
import {
	EllipsisVerticalIcon,
	ExternalLinkIcon,
	FileTextIcon,
	LoaderIcon,
	PencilIcon,
	PlusIcon,
	TrashIcon,
} from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { href, Link, useFetcher } from "react-router";
import { useSpinDelay } from "spin-delay";

import { AppHeader } from "~/components/app-header";
import { useTeam } from "~/hooks/use-team";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";
import { measure } from "~/middleware/server-timing";
import { team } from "~/middleware/team";

import type { Route } from "./+types/route";

export async function loader() {
	logger().info("statusPages.loader.start", {
		route: "status-pages",
		teamId: team().id,
	});

	let statusPages = await measure("findStatusPages", () => {
		return db().query.statusPages.findMany({
			where(fields, operators) {
				return operators.eq(fields.teamId, team().id);
			},
			with: {
				monitors: true,
			},
			orderBy(fields, operators) {
				return operators.desc(fields.createdAt);
			},
		});
	});

	logger().info("statusPages.loader.complete", {
		route: "status-pages",
		teamId: team().id,
		statusPageCount: statusPages.length,
	});

	return {
		statusPages: statusPages.map((sp) => ({
			id: sp.id,
			name: sp.name,
			slug: sp.slug,
			title: sp.title,
			isPublic: sp.isPublic,
			monitorsCount: sp.monitors.length,
		})),
	};
}

export default function Component({ loaderData, params }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "page.statusPages" });
	let { t: tSidebar } = useTranslation("translation", {
		keyPrefix: "app.layout.sidebar.navigation.items",
	});
	let id = useId();

	let columns = [
		{
			id: "name" as const,
			name: t("table.columns.name"),
			align: "left" as const,
		},
		{
			id: "slug" as const,
			name: t("table.columns.slug"),
			align: "left" as const,
		},
		{
			id: "monitors" as const,
			name: t("table.columns.monitors"),
			align: "center" as const,
		},
		{
			id: "visibility" as const,
			name: t("table.columns.visibility"),
			align: "center" as const,
		},
		{
			id: "actions" as const,
			name: t("table.columns.actions"),
			align: "center" as const,
		},
	];

	return (
		<>
			<AppHeader
				heading={t("header.title")}
				breadcrumbs={[
					{ label: tSidebar("dashboard"), href: href("/app/:team/dashboard", params) },
					{ label: t("header.title") },
				]}
			>
				<LinkButton
					color="neutral"
					href={href("/app/:team/status-pages/new", params)}
					className="shrink-0 px-2"
				>
					<PlusIcon className="size-5" aria-hidden />
					<span className="max-sm:sr-only">{t("header.action.create")}</span>
				</LinkButton>
			</AppHeader>

			<div className="flex flex-col gap-6 p-5 md:gap-12 md:p-12">
				{loaderData.statusPages.length === 0 ? (
					<Empty className="mx-auto max-w-md py-16">
						<Empty.Icon>
							<FileTextIcon className="size-12" />
						</Empty.Icon>
						<Empty.Title>{t("empty.title")}</Empty.Title>
						<Empty.Description>{t("empty.description")}</Empty.Description>
						<Empty.Action>
							<LinkButton href={href("/app/:team/status-pages/new", params)}>
								<PlusIcon className="size-5" aria-hidden />
								{t("empty.cta")}
							</LinkButton>
						</Empty.Action>
					</Empty>
				) : (
					<div className="flex flex-col gap-4">
						<h2 id={`${id}-status-pages-table`}>{t("table.label")}</h2>

						<Table aria-labelledby={`${id}-status-pages-table`}>
							<Table.Header columns={columns}>
								{(column: (typeof columns)[number]) => (
									<Table.Column align={column.align} isRowHeader={column.id === "name"}>
										<span
											className={cn({
												"sr-only": column.id === "actions",
											})}
										>
											{column.name}
										</span>
									</Table.Column>
								)}
							</Table.Header>

							<Table.Body items={loaderData.statusPages}>
								{(statusPage: (typeof loaderData.statusPages)[number]) => (
									<StatusPageTableRow statusPage={statusPage} />
								)}
							</Table.Body>
						</Table>
					</div>
				)}
			</div>
		</>
	);
}

function StatusPageTableRow(props: {
	statusPage: Route.ComponentProps["loaderData"]["statusPages"][number];
}) {
	let { t } = useTranslation("translation", {
		keyPrefix: "page.statusPages.table",
	});

	let team = useTeam();

	let deleteFetcher = useFetcher();
	let isDeleting = useSpinDelay(deleteFetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	return (
		<Table.Row>
			<Table.Cell>
				<Link
					to={href("/app/:team/status-pages/:statusPageId/edit", {
						team: team.slug,
						statusPageId: props.statusPage.id,
					})}
					className="font-semibold hover:underline"
				>
					{props.statusPage.name}
				</Link>
				<p className="text-sm text-neutral-500 dark:text-neutral-400">{props.statusPage.title}</p>
			</Table.Cell>
			<Table.Cell className="max-w-48">
				<Link
					to={href("/status/:slug", { slug: props.statusPage.slug })}
					target="_blank"
					rel="noopener noreferrer"
					className="flex items-center gap-1 text-sm text-neutral-600 hover:text-neutral-900 hover:underline dark:text-neutral-400 dark:hover:text-neutral-100"
				>
					<span className="truncate">/{props.statusPage.slug}</span>
					<ExternalLinkIcon className="size-3 shrink-0" />
				</Link>
			</Table.Cell>
			<Table.Cell className="w-28 text-center">{props.statusPage.monitorsCount}</Table.Cell>
			<Table.Cell className="w-28 text-center">
				<span
					className={cn(
						"rounded-full px-2 py-0.5 text-xs font-medium",
						props.statusPage.isPublic
							? "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200"
							: "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200",
					)}
				>
					{props.statusPage.isPublic ? t("visibility.public") : t("visibility.private")}
				</span>
			</Table.Cell>
			<Table.Cell className="w-17 text-center">
				<Menu.Trigger>
					<Button type="button" color="neutral" className="p-2">
						<EllipsisVerticalIcon className="size-5" />
						<span className="sr-only">{t("actions.menu")}</span>
					</Button>

					<Popover placement="left top">
						<Menu>
							<Menu.Item
								href={href("/status/:slug", { slug: props.statusPage.slug })}
								target="_blank"
							>
								<ExternalLinkIcon className="size-5" />
								<span>{t("actions.view")}</span>
							</Menu.Item>

							<Menu.Item
								href={href("/app/:team/status-pages/:statusPageId/edit", {
									team: team.slug,
									statusPageId: props.statusPage.id,
								})}
							>
								<PencilIcon className="size-5" />
								<span>{t("actions.edit")}</span>
							</Menu.Item>

							<Menu.Separator />

							<Menu.Item
								danger
								isDisabled={isDeleting}
								onAction={async () => {
									let confirmed = await confirm(
										t("confirmation.delete", { name: props.statusPage.name }),
										{
											confirmLabel: t("actions.delete"),
											color: "danger",
										},
									);
									if (confirmed) {
										deleteFetcher.submit(
											{ statusPageId: props.statusPage.id },
											{
												method: "POST",
												action: href("/actions/:team/delete-status-page", {
													team: team.slug,
												}),
											},
										);
									}
								}}
							>
								<TrashIcon className="size-5" />
								<span>{t("actions.delete")}</span>
								{isDeleting && <LoaderIcon aria-hidden className="ml-auto size-5 animate-spin" />}
							</Menu.Item>
						</Menu>
					</Popover>
				</Menu.Trigger>
			</Table.Cell>
		</Table.Row>
	);
}
