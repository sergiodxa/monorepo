import { cn } from "@pkg/cn";
import { ChevronsUpDownIcon } from "lucide-react";
import {
	Button as AriaButton,
	Menu as AriaMenu,
	MenuItem as AriaMenuItem,
	MenuTrigger as AriaMenuTrigger,
	Popover as AriaPopover,
} from "react-aria-components";
import { useTranslation } from "react-i18next";
import { href, useNavigate } from "react-router";

export function UserMenu(props: { user: { avatar: string; name: string; email: string } }) {
	let navigate = useNavigate();
	let { t } = useTranslation("translation", {
		keyPrefix: "app.layout.sidebar.userMenu",
	});

	let items = [
		{ key: "account", textValue: "Account", to: href("/app") },
		{ key: "logout", textValue: "Logout", to: href("/logout") },
	];

	return (
		<AriaMenuTrigger aria-label={t("label")}>
			<AriaButton
				className={cn(
					"flex items-center justify-start gap-2",
					"w-full p-2 rounded-lg",
					"text-left text-sm font-medium leading-tight",
					"hover:bg-primary-200 hover:text-primary-950",
					"aria-[expanded=true]:bg-primary-200 aria-[expanded=true]:text-primary-950",
					"dark:hover:bg-primary-800 dark:hover:text-primary-50",
					"dark:aria-[expanded=true]:bg-primary-800 dark:aria-[expanded=true]:text-primary-50",
				)}
			>
				<img
					src={props.user.avatar ?? undefined}
					alt={props.user.name}
					className="size-8 rounded-full object-cover flex-shrink-0 bg-neutral-50 border border-neutral-300"
				/>
				<span>{props.user.name}</span>
				<ChevronsUpDownIcon className="size-4 flex-shrink-0 ml-auto" aria-hidden />
			</AriaButton>

			<AriaPopover
				style={{ minWidth: "var(--trigger-width)" }}
				placement="right bottom"
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
					items={items}
					onAction={(key) => {
						let item = items.find((item) => item.key === key);
						if (item) return navigate(item.to);
					}}
				>
					{(item) => (
						<AriaMenuItem
							textValue={item.textValue}
							className={cn(
								// Default
								"flex items-center justify-between",
								"cursor-default py-2 px-4 rounded text-sm",
								// Selected
								"data-[selected]:after:content-['✓']",
								// Hovered
								"data-[hovered]:bg-primary-100 data-[hovered]:text-primary-900",
								"dark:data-[hovered]:bg-primary-800 dark:data-[hovered]:text-primary-50",
								// Focused
								"data-[focused]:bg-primary-100 data-[focused]:text-primary-900",
								"dark:data-[focused]:bg-primary-800 dark:data-[focused]:text-primary-50",
								// Disabled
								"data-[disabled]:text-neutral-400 data-[disabled]:cursor-not-allowed",
								"dark:data-[disabled]:text-neutral-600",
							)}
						>
							{item.textValue}
						</AriaMenuItem>
					)}
				</AriaMenu>
			</AriaPopover>
		</AriaMenuTrigger>
	);
}
