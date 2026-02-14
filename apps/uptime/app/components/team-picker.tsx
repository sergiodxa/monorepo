import { Button, Logo, Menu, Popover } from "@pkg/ui";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { href, useNavigate } from "react-router";

interface Team {
	id: string;
	slug: string;
	name: string;
	logo: string | null;
}

function getTeamInitials(name: string): string {
	return name.substring(0, 2).toUpperCase();
}

export function TeamPicker(props: { teams: Team[]; active: Team }) {
	let navigate = useNavigate();

	let { t } = useTranslation("translation", {
		keyPrefix: "app.layout.sidebar.teamPicker",
	});

	if (props.teams.length === 1) {
		return (
			<div className="flex w-full items-center justify-start gap-2 rounded-lg p-2 text-left text-sm leading-tight font-medium">
				<Logo size="sm">
					{props.active.logo ? (
						<Logo.Image src={props.active.logo} alt="" />
					) : (
						<Logo.Fallback>{getTeamInitials(props.active.name)}</Logo.Fallback>
					)}
				</Logo>
				<span className="truncate">{props.active.name}</span>
			</div>
		);
	}

	return (
		<Menu.Trigger aria-label={t("label")}>
			<Button variant="ghost" className="w-full justify-start gap-2 px-2">
				<Logo size="sm">
					{props.active.logo ? (
						<Logo.Image src={props.active.logo} alt="" />
					) : (
						<Logo.Fallback>{getTeamInitials(props.active.name)}</Logo.Fallback>
					)}
				</Logo>
				<span className="text-sm font-medium">{props.active.name}</span>
				<ChevronsUpDownIcon className="ml-auto size-4 shrink-0" aria-hidden />
			</Button>

			<Popover placement="bottom start">
				<Menu
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
						<Menu.Item key={team.id} id={team.id} textValue={team.name}>
							<Logo size="sm">
								{team.logo ? (
									<Logo.Image src={team.logo} alt="" />
								) : (
									<Logo.Fallback>{getTeamInitials(team.name)}</Logo.Fallback>
								)}
							</Logo>
							<span>{team.name}</span>
							{team.slug === props.active.slug && (
								<CheckIcon className="ml-auto size-4" aria-hidden />
							)}
						</Menu.Item>
					)}
				</Menu>
			</Popover>
		</Menu.Trigger>
	);
}
