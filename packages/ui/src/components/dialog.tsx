import type { ComponentProps, ReactNode } from "react";

import { cn } from "@pkg/cn";
import { XIcon } from "lucide-react";
import {
	Dialog as AriaDialog,
	DialogTrigger,
	Heading as AriaHeading,
	Text as AriaText,
} from "react-aria-components";

import { Button } from "./button";

export { DialogTrigger };

export namespace Dialog {
	export interface Props extends Omit<ComponentProps<typeof AriaDialog>, "className"> {
		className?: cn.ClassName;
	}

	export interface HeaderProps {
		className?: cn.ClassName;
		children: ReactNode;
	}

	export interface TitleProps extends Omit<ComponentProps<typeof AriaHeading>, "className"> {
		className?: cn.ClassName;
	}

	export interface DescriptionProps extends Omit<ComponentProps<typeof AriaText>, "className"> {
		className?: cn.ClassName;
	}

	export interface FooterProps {
		className?: cn.ClassName;
		children: ReactNode;
	}

	export interface CloseProps {
		className?: cn.ClassName;
		"aria-label"?: string;
	}
}

export function Dialog({ className, ...props }: Dialog.Props) {
	return <AriaDialog {...props} className={cn("ui-dialog", className)} />;
}

function Header({ className, children }: Dialog.HeaderProps) {
	return <div className={cn("ui-dialog-header", className)}>{children}</div>;
}

function Title({ className, ...props }: Dialog.TitleProps) {
	return <AriaHeading {...props} slot="title" className={cn("ui-dialog-title", className)} />;
}

function Description({ className, ...props }: Dialog.DescriptionProps) {
	return (
		<AriaText {...props} slot="description" className={cn("ui-dialog-description", className)} />
	);
}

function Footer({ className, children }: Dialog.FooterProps) {
	return <div className={cn("ui-dialog-footer", className)}>{children}</div>;
}

function Close({ className, "aria-label": ariaLabel = "Close" }: Dialog.CloseProps) {
	return (
		<Button
			slot="close"
			variant="ghost"
			color="neutral"
			size="icon-sm"
			aria-label={ariaLabel}
			className={cn("ui-dialog-close", className)}
		>
			<XIcon className="size-4" />
		</Button>
	);
}

Dialog.Header = Header;
Dialog.Title = Title;
Dialog.Description = Description;
Dialog.Footer = Footer;
Dialog.Close = Close;
