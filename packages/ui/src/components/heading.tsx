import type { cn } from "@pkg/cn";
import type { ComponentProps } from "react";

import { cn as classNames } from "@pkg/cn";
import { Heading as AriaHeading } from "react-aria-components";

export namespace Heading {
	export interface Props extends Omit<ComponentProps<typeof AriaHeading>, "className"> {
		className?: cn.ClassName;
	}
}

export function Heading({ className, ...props }: Heading.Props) {
	return <AriaHeading {...props} className={classNames("ui-heading", className)} />;
}
