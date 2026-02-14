import { Avatar, Button, Menu, Popover } from "@pkg/ui";
import { ChevronsUpDownIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { href, useNavigate } from "react-router";

import { useTeam } from "~/hooks/use-team";

function getInitials(name: string): string {
	return name
		.split(" ")
		.map((part) => part[0])
		.join("")
		.toUpperCase()
		.slice(0, 2);
}

export function UserMenu(props: { user: { avatar: string; name: string; email: string } }) {
	let navigate = useNavigate();
	let team = useTeam();
	let { t } = useTranslation("translation", {
		keyPrefix: "app.layout.sidebar.userMenu",
	});

	let items = [
		{ key: "account", textValue: "Account", to: href("/app/:team/account", { team: team.slug }) },
		{ key: "logout", textValue: "Logout", to: href("/logout") },
	];

	return (
		<Menu.Trigger aria-label={t("label")}>
			<Button variant="ghost" className="w-full justify-start gap-2 px-2">
				<Avatar size="sm">
					{props.user.avatar ? (
						<Avatar.Image src={props.user.avatar} alt="" />
					) : (
						<Avatar.Fallback>{getInitials(props.user.name)}</Avatar.Fallback>
					)}
				</Avatar>
				<span className="truncate text-sm font-medium">{props.user.name}</span>
				<ChevronsUpDownIcon className="ml-auto size-4 shrink-0" aria-hidden />
			</Button>

			<Popover placement="top start">
				<Menu
					items={items}
					onAction={(key) => {
						let item = items.find((item) => item.key === key);
						if (item) return navigate(item.to);
					}}
				>
					{(item) => (
						<Menu.Item key={item.key} id={item.key} textValue={item.textValue}>
							{item.textValue}
						</Menu.Item>
					)}
				</Menu>
			</Popover>
		</Menu.Trigger>
	);
}
