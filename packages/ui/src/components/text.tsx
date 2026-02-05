import type { cn } from "@pkg/cn";
import type { ComponentProps } from "react";

import { cn as classNames } from "@pkg/cn";
import { Text as AriaText } from "react-aria-components";

export namespace Text {
	export interface Props extends Omit<ComponentProps<typeof AriaText>, "className"> {
		className?: cn.ClassName;
	}
}

export function Text({ className, ...props }: Text.Props) {
	return <AriaText {...props} className={classNames("ui-text", className)} />;
}
