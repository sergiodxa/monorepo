import { cn } from "@pkg/cn";
import { toast, Toaster as SonnerToaster, type ToasterProps } from "sonner";

export { toast };

interface ToastClassNames {
	toast?: string;
	title?: string;
	description?: string;
	actionButton?: string;
	cancelButton?: string;
	closeButton?: string;
	icon?: string;
	loader?: string;
}

interface ToastOptions extends Record<string, unknown> {
	classNames?: ToastClassNames;
}

export namespace Toaster {
	export interface Props extends Omit<ToasterProps, "className" | "toastOptions"> {
		className?: cn.ClassName;
		toastOptions?: ToastOptions;
	}
}

export function Toaster({ className, toastOptions, ...props }: Toaster.Props) {
	let mergedClassNames = {
		toast: cn("ui-toast", toastOptions?.classNames?.toast),
		title: cn("ui-toast-title", toastOptions?.classNames?.title),
		description: cn("ui-toast-description", toastOptions?.classNames?.description),
		actionButton: cn("ui-toast-action", toastOptions?.classNames?.actionButton),
		cancelButton: cn("ui-toast-cancel", toastOptions?.classNames?.cancelButton),
		closeButton: cn("ui-toast-close", toastOptions?.classNames?.closeButton),
		icon: cn("ui-toast-icon", toastOptions?.classNames?.icon),
		loader: cn("ui-toast-loader", toastOptions?.classNames?.loader),
	};

	return (
		<SonnerToaster
			{...props}
			className={cn("ui-toaster", className)}
			toastOptions={{
				...toastOptions,
				classNames: mergedClassNames,
			}}
		/>
	);
}
