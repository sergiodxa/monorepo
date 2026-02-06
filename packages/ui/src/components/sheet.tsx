import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";
import {
	Dialog as AriaDialog,
	DialogTrigger,
	Heading,
	Modal as AriaModal,
	ModalOverlay as AriaModalOverlay,
	Text as AriaText,
} from "react-aria-components";

export type SheetSide = "right" | "left";

export { DialogTrigger as SheetTrigger };

export namespace Sheet {
	export interface Props extends Omit<ComponentProps<typeof AriaModal>, "className"> {
		className?: cn.ClassName;
		side?: SheetSide;
	}

	export interface OverlayProps extends Omit<ComponentProps<typeof AriaModalOverlay>, "className"> {
		className?: cn.ClassName;
	}

	export interface ContentProps extends Omit<ComponentProps<typeof AriaDialog>, "className"> {
		className?: cn.ClassName;
	}

	export interface HeaderProps extends Omit<ComponentProps<"header">, "className"> {
		className?: cn.ClassName;
	}

	export interface FooterProps extends Omit<ComponentProps<"footer">, "className"> {
		className?: cn.ClassName;
	}

	export interface TitleProps extends Omit<ComponentProps<typeof Heading>, "className" | "slot"> {
		className?: cn.ClassName;
	}

	export interface DescriptionProps extends Omit<
		ComponentProps<typeof AriaText>,
		"className" | "slot"
	> {
		className?: cn.ClassName;
	}
}

export function Sheet({ className, side = "right", ...props }: Sheet.Props) {
	return <AriaModal {...props} data-side={side} className={cn("ui-sheet", className)} />;
}

Sheet.Overlay = function SheetOverlay({ className, ...props }: Sheet.OverlayProps) {
	return <AriaModalOverlay {...props} className={cn("ui-sheet-overlay", className)} />;
};

Sheet.Content = function SheetContent({ className, ...props }: Sheet.ContentProps) {
	return <AriaDialog {...props} className={cn("ui-sheet-content", className)} />;
};

Sheet.Header = function SheetHeader({ className, ...props }: Sheet.HeaderProps) {
	return <header {...props} data-slot="header" className={cn("ui-sheet-header", className)} />;
};

Sheet.Footer = function SheetFooter({ className, ...props }: Sheet.FooterProps) {
	return <footer {...props} data-slot="footer" className={cn("ui-sheet-footer", className)} />;
};

Sheet.Title = function SheetTitle({ className, ...props }: Sheet.TitleProps) {
	return <Heading {...props} slot="title" className={cn("ui-sheet-title", className)} />;
};

Sheet.Description = function SheetDescription({ className, ...props }: Sheet.DescriptionProps) {
	return (
		<AriaText {...props} slot="description" className={cn("ui-sheet-description", className)} />
	);
};
