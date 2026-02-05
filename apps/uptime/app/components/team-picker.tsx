import { cn } from "@pkg/cn";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import {
	Button as AriaButton,
	Menu as AriaMenu,
	MenuItem as AriaMenuItem,
	MenuTrigger as AriaMenuTrigger,
	Popover as AriaPopover,
} from "react-aria-components";
import { useTranslation } from "react-i18next";
import { href, useNavigate } from "react-router";

interface Team {
	id: string;
	slug: string;
	name: string;
	logo: string | null;
}

export function TeamPicker(props: { teams: Team[]; active: Team }) {
	let navigate = useNavigate();

	let { t } = useTranslation("translation", {
		keyPrefix: "app.layout.sidebar.teamPicker",
	});

	if (props.teams.length === 1) {
		return (
			<div
				className={cn(
					"flex items-center justify-start gap-2",
					"w-full rounded-lg p-2",
					"text-left text-sm leading-tight font-medium",
				)}
			>
				<img
					src={props.active?.logo ?? undefined}
					alt={props.active?.name}
					className="size-8 flex-shrink-0 rounded-xl border border-neutral-300 bg-neutral-50 object-cover"
				/>
				<span>{props.active?.name}</span>
			</div>
		);
	}

	return (
		<AriaMenuTrigger aria-label={t("label")}>
			<AriaButton
				className={cn(
					"flex items-center justify-start gap-2",
					"w-full rounded-lg p-2",
					"text-left text-sm leading-tight font-medium",
					"hover:bg-primary-200 hover:text-primary-950",
					"aria-[expanded=true]:bg-primary-200 aria-[expanded=true]:text-primary-950",
					"dark:hover:bg-primary-800 dark:hover:text-primary-50",
					"dark:aria-[expanded=true]:bg-primary-800 dark:aria-[expanded=true]:text-primary-50",
				)}
			>
				<img
					src={props.active?.logo ?? undefined}
					alt={props.active?.name}
					className="size-8 flex-shrink-0 rounded-xl border border-neutral-300 bg-neutral-50 object-cover"
				/>
				<span>{props.active?.name}</span>
				<ChevronsUpDownIcon className="ml-auto size-4 flex-shrink-0" aria-hidden />
			</AriaButton>

			<AriaPopover
				style={{ minWidth: "var(--trigger-width)" }}
				placement="right top"
				className={cn(
					"rounded-lg",
					"border border-neutral-300 shadow shadow-neutral-300",
					"bg-neutral-50 text-neutral-950",
					"dark:border-neutral-700 dark:shadow-neutral-700",
					"dark:bg-neutral-950 dark:text-neutral-50",
				)}
			>
				<AriaMenu
					className="flex flex-col gap-0.5 p-1"
					items={props.teams}
					onAction={(teamId) => {
						let team = props.teams.find((t) => t.id === teamId);
						if (!team) return;
						return navigate(href("/app/:team/dashboard", { team: team.slug }), {
							state: { team },
						});
					}}
				>
					{(team) => (
						<AriaMenuItem
							textValue={team.name}
							className={cn(
								// Default
								"flex items-center justify-between",
								"cursor-default rounded px-4 py-2 text-sm",
								// Selected
								"data-[selected]:after:content-['✓']",
								// Hovered
								"data-[hovered]:bg-primary-100 data-[hovered]:text-primary-900",
								"dark:data-[hovered]:bg-primary-800 dark:data-[hovered]:text-primary-50",
								// Focused
								"data-[focused]:bg-primary-100 data-[focused]:text-primary-900",
								"dark:data-[focused]:bg-primary-800 dark:data-[focused]:text-primary-50",
								// Disabled
								"data-[disabled]:cursor-not-allowed data-[disabled]:text-neutral-400",
								"dark:data-[disabled]:text-neutral-600",
							)}
						>
							{team.name}
							{team.slug === props.active.slug && <CheckIcon className="size-4" aria-hidden />}
						</AriaMenuItem>
					)}
				</AriaMenu>
			</AriaPopover>
		</AriaMenuTrigger>
	);
}
