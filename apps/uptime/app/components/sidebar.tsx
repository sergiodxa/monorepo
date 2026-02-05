import type { LucideProps } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";
import {
	ActivityIcon,
	BadgeCheckIcon,
	BellIcon,
	CornerDownRightIcon,
	CreditCardIcon,
	LoaderIcon,
	MonitorCogIcon,
	UsersIcon,
} from "lucide-react";
import { Collection as AriaCollection } from "react-aria-components";
import { useTranslation } from "react-i18next";
import { href, NavLink } from "react-router";
import { useSpinDelay } from "spin-delay";

import { TeamPicker } from "~/components/team-picker";
import { UserMenu } from "~/components/user-menu";
import { useSidebarStatus } from "~/hooks/use-sidebar-status";
import { useTeam } from "~/hooks/use-team";

export function Sidebar(props: {
	team: { id: string; slug: string; name: string; logo: string | null };
	teams: Array<{
		id: string;
		slug: string;
		name: string;
		logo: string | null;
	}>;
	viewer: {
		id: string;
		avatar: string;
		name: string;
		email: string;
		isAdmin: boolean;
	};
	monitors: Array<{ id: string; name: string }>;
}) {
	let { t } = useTranslation("translation", {
		keyPrefix: "app.layout.sidebar",
	});

	let sidebarStatus = useSidebarStatus();

	let primaryNavItems: ComponentProps<typeof Navigation>["items"] = [
		{
			key: t("navigation.items.dashboard"),
			to: href("/app/:team/dashboard", { team: props.team.slug }),
			icon: ActivityIcon,
			items: null,
		},
		{
			key: t("navigation.items.alerts"),
			to: href("/app/:team/alerts", { team: props.team.slug }),
			icon: BellIcon,
			items: null,
		},
	];

	if (props.monitors.length > 0) {
		primaryNavItems.push({
			key: t("navigation.items.monitors"),
			items: props.monitors.map((monitor) => {
				return {
					id: monitor.id,
					label: monitor.name,
					icon: MonitorCogIcon,
					to: href("/app/:team/monitors/:monitorId", {
						team: props.team.slug,
						monitorId: monitor.id,
					}),
				};
			}),
		});
	}

	let secondaryNavItems: ComponentProps<typeof Navigation>["items"] = [];

	if (useTeam().ownerId === props.viewer.id) {
		secondaryNavItems.push({
			key: t("navigation.items.billing"),
			to: href("/app/:team/checkout", { team: props.team.slug }),
			icon: CreditCardIcon,
			items: null,
		});
	}

	if (props.viewer.isAdmin) {
		secondaryNavItems.push({
			key: t("navigation.items.domains"),
			to: href("/app/:team/domains", { team: props.team.slug }),
			icon: BadgeCheckIcon,
			items: null,
		});
		secondaryNavItems.push({
			key: t("navigation.items.members"),
			to: href("/app/:team/members", { team: props.team.slug }),
			icon: UsersIcon,
			items: null,
		});
	}

	return (
		<nav
			className={cn(
				"flex-shrink-0 flex-col gap-2",
				"w-72",
				"border-r border-neutral-300 dark:border-neutral-700",
				"bg-neutral-100 text-neutral-950",
				"dark:bg-neutral-900 dark:text-neutral-50",
				{
					"hidden lg:flex": sidebarStatus === "closed",
					"flex max-lg:fixed max-lg:inset-0 max-lg:z-100": sidebarStatus === "open",
				},
			)}
		>
			<div className="h-16 border-b border-neutral-300 p-2 dark:border-neutral-700">
				<TeamPicker active={props.team} teams={props.teams} />
			</div>

			<div className="flex flex-grow flex-col gap-2 overflow-y-auto px-2">
				<Navigation items={primaryNavItems} />
			</div>

			<div className="flex flex-col gap-2 px-2">
				<Navigation items={secondaryNavItems} />
			</div>

			<div className="h-16 border-t border-neutral-300 p-2 dark:border-neutral-700">
				<UserMenu user={props.viewer} />
			</div>
		</nav>
	);
}

function NavItemContent(props: {
	isPending: boolean;
	label: string;
	icon?: React.ForwardRefExoticComponent<Omit<LucideProps, "ref">>;
}) {
	let isPending = useSpinDelay(props.isPending, {
		minDuration: 100,
		delay: 50,
	});

	return (
		<>
			{props.icon && (
				<div aria-hidden className="flex size-5 flex-shrink-0 items-center justify-center">
					<props.icon className="size-4" />
				</div>
			)}
			<span className="line-clamp-1">{props.label}</span>
			{isPending && <LoaderIcon className="ml-auto size-4 flex-shrink-0 animate-spin" />}
		</>
	);
}

function Navigation(props: {
	items: Array<{
		key: string;
		to?: string;
		icon?: React.ForwardRefExoticComponent<Omit<LucideProps, "ref">>;
		items: Array<{
			id: string;
			label: string;
			to: string;
			icon?: React.ForwardRefExoticComponent<Omit<LucideProps, "ref">>;
		}> | null;
	}>;
}) {
	return (
		<AriaCollection items={props.items}>
			{(item) => {
				if (item.to) {
					return (
						<div className="flex w-full flex-col gap-1">
							<NavLink
								to={item.to}
								end
								className={({ isActive, isPending }) =>
									cn(
										"flex w-full items-center justify-start gap-2 rounded-lg p-2",
										"hover:bg-primary-200 hover:text-primary-950",
										"dark:hover:bg-primary-800 dark:hover:text-primary-50",
										{
											"bg-primary-200 text-primary-950 dark:bg-primary-800 dark:text-primary-50":
												isActive,
										},
										{
											"bg-neutral-200 text-neutral-950 dark:bg-neutral-800 dark:text-neutral-50":
												isPending,
										},
									)
								}
							>
								{({ isPending }) => {
									return <NavItemContent isPending={isPending} label={item.key} icon={item.icon} />;
								}}
							</NavLink>

							{item.items && item.items.length > 0 && (
								<ul className="flex flex-col gap-1 pl-7">
									{item.items.map((subItem) => (
										<NavLink
											key={subItem.id}
											to={subItem.to}
											end
											className={({ isActive, isPending }) =>
												cn(
													"flex w-full items-center justify-start gap-2 rounded-lg p-2",
													"hover:bg-primary-200 hover:text-primary-950",
													"dark:hover:bg-primary-800 dark:hover:text-primary-50",
													{
														"bg-primary-200 text-primary-950 dark:bg-primary-800 dark:text-primary-50":
															isActive,
													},
													{
														"bg-neutral-200 text-neutral-950 dark:bg-neutral-800 dark:text-neutral-50":
															isPending,
													},
												)
											}
										>
											{({ isPending }) => {
												return (
													<NavItemContent
														isPending={isPending}
														label={subItem.label}
														icon={CornerDownRightIcon}
													/>
												);
											}}
										</NavLink>
									))}
								</ul>
							)}
						</div>
					);
				}

				return (
					<div className="mt-2 flex w-full flex-col gap-0.5">
						<div className="flex w-full items-center justify-start gap-2 p-2 text-sm dark:text-neutral-300">
							{item.icon && (
								<div aria-hidden className="flex size-4 flex-shrink-0 items-center justify-center">
									<item.icon className="size-4" />
								</div>
							)}
							<span className="line-clamp-1">{item.key}</span>
						</div>

						{item.items && item.items.length > 0 && (
							<ul className="flex flex-col gap-1">
								{item.items?.map((subItem) => (
									<NavLink
										key={subItem.id}
										to={subItem.to}
										end
										className={({ isActive, isPending }) =>
											cn(
												"flex w-full items-center justify-start gap-2 rounded-lg p-2",
												"hover:bg-primary-200 hover:text-primary-950",
												"dark:hover:bg-primary-800 dark:hover:text-primary-50",
												{
													"bg-primary-200 text-primary-950 dark:bg-primary-800 dark:text-primary-50":
														isActive,
												},
												{
													"bg-neutral-200 text-neutral-950 dark:bg-neutral-800 dark:text-neutral-50":
														isPending,
												},
											)
										}
									>
										{({ isPending }) => {
											return (
												<NavItemContent
													isPending={isPending}
													label={subItem.label}
													icon={subItem.icon ?? CornerDownRightIcon}
												/>
											);
										}}
									</NavLink>
								))}
							</ul>
						)}
					</div>
				);
			}}
		</AriaCollection>
	);
}
