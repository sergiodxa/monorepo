import type { ComponentProps } from "react";

import { cn } from "@pkg/cn";
import { ModalOverlay as AriaModalOverlay, Modal as AriaModal } from "react-aria-components";

export namespace Modal {
	export interface Props extends Omit<ComponentProps<typeof AriaModal>, "className"> {
		className?: cn.ClassName;
	}

	export interface OverlayProps extends Omit<ComponentProps<typeof AriaModalOverlay>, "className"> {
		className?: cn.ClassName;
	}
}

export function Modal({ className, ...props }: Modal.Props) {
	return <AriaModal {...props} className={cn("ui-modal", className)} />;
}

Modal.Overlay = function ModalOverlay({ className, ...props }: Modal.OverlayProps) {
	return <AriaModalOverlay {...props} className={cn("ui-modal-overlay", className)} />;
};
