import type { ComponentProps, ReactNode } from "react";

import { cn } from "@pkg/cn";
import {
	Dialog as AriaDialog,
	DialogTrigger,
	Heading as AriaHeading,
	Text as AriaText,
} from "react-aria-components";

import { Button } from "./button";
import { Modal } from "./modal";

export { DialogTrigger as AlertDialogTrigger };

export namespace AlertDialog {
	export interface Props extends Omit<ComponentProps<typeof AriaDialog>, "className" | "role"> {
		className?: cn.ClassName;
	}

	export interface ContentProps extends Omit<ComponentProps<typeof Modal>, "className"> {
		className?: cn.ClassName;
		overlayClassName?: cn.ClassName;
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

	export interface ActionProps extends Omit<Button.Props, "slot"> {}

	export interface CancelProps extends Omit<Button.Props, "slot"> {}
}

export function AlertDialog({ className, ...props }: AlertDialog.Props) {
	return <AriaDialog {...props} role="alertdialog" className={cn("ui-alert-dialog", className)} />;
}

function Content({ className, overlayClassName, children, ...props }: AlertDialog.ContentProps) {
	return (
		<Modal.Overlay {...props} className={overlayClassName} isDismissable={false}>
			<Modal className={cn("ui-alert-dialog-content", className)}>{children}</Modal>
		</Modal.Overlay>
	);
}

function Header({ className, children }: AlertDialog.HeaderProps) {
	return <div className={cn("ui-alert-dialog-header", className)}>{children}</div>;
}

function Title({ className, ...props }: AlertDialog.TitleProps) {
	return <AriaHeading {...props} slot="title" className={cn("ui-alert-dialog-title", className)} />;
}

function Description({ className, ...props }: AlertDialog.DescriptionProps) {
	return (
		<AriaText
			{...props}
			slot="description"
			className={cn("ui-alert-dialog-description", className)}
		/>
	);
}

function Footer({ className, children }: AlertDialog.FooterProps) {
	return <div className={cn("ui-alert-dialog-footer", className)}>{children}</div>;
}

function Action({ color = "danger", ...props }: AlertDialog.ActionProps) {
	return <Button {...props} slot="close" color={color} />;
}

function Cancel({ variant = "outline", color = "neutral", ...props }: AlertDialog.CancelProps) {
	return <Button {...props} slot="close" variant={variant} color={color} />;
}

AlertDialog.Content = Content;
AlertDialog.Header = Header;
AlertDialog.Title = Title;
AlertDialog.Description = Description;
AlertDialog.Footer = Footer;
AlertDialog.Action = Action;
AlertDialog.Cancel = Cancel;
