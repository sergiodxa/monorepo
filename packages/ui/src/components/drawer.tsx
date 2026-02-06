import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";
import { Modal as AriaModal, ModalOverlay as AriaModalOverlay } from "react-aria-components";

export namespace Drawer {
	export type Placement = "bottom" | "top";

	export interface Props extends Omit<ComponentProps<typeof AriaModal>, "className"> {
		className?: cn.ClassName;
		placement?: Placement;
	}

	export interface OverlayProps extends Omit<ComponentProps<typeof AriaModalOverlay>, "className"> {
		className?: cn.ClassName;
		placement?: Placement;
	}
}

export function Drawer({ className, placement = "bottom", ...props }: Drawer.Props) {
	return <AriaModal {...props} data-placement={placement} className={cn("ui-drawer", className)} />;
}

Drawer.Overlay = function DrawerOverlay({
	className,
	placement = "bottom",
	...props
}: Drawer.OverlayProps) {
	return (
		<AriaModalOverlay
			{...props}
			data-placement={placement}
			className={cn("ui-drawer-overlay", className)}
		/>
	);
};
