import type { cn } from "@pkg/cn";
import type { ComponentProps } from "react";

import { cn as classNames } from "@pkg/cn";
import { Dialog as AriaDialog, DialogTrigger } from "react-aria-components";

export { DialogTrigger };

export namespace Dialog {
	export interface Props extends Omit<ComponentProps<typeof AriaDialog>, "className"> {
		className?: cn.ClassName;
	}
}

export function Dialog({ className, ...props }: Dialog.Props) {
	return <AriaDialog {...props} className={classNames("ui-dialog", className)} />;
}
