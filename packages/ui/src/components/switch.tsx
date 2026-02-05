import type { cn } from "@pkg/cn";
import type { ComponentProps, ReactNode } from "react";

import { cn as classNames } from "@pkg/cn";
import { Switch as AriaSwitch } from "react-aria-components";

export namespace Switch {
	export interface Props extends Omit<ComponentProps<typeof AriaSwitch>, "className"> {
		children?: ReactNode;
		className?: cn.ClassName;
	}
}

export function Switch({ className, children, ...props }: Switch.Props) {
	return (
		<AriaSwitch className={classNames("ui-switch", className)} {...props}>
			{(renderProps) => (
				<>
					<div
						className="ui-switch-track"
						data-selected={renderProps.isSelected || undefined}
						data-focus-visible={renderProps.isFocusVisible || undefined}
						data-disabled={renderProps.isDisabled || undefined}
					>
						<span className="ui-switch-thumb" data-selected={renderProps.isSelected || undefined} />
					</div>
					{children}
				</>
			)}
		</AriaSwitch>
	);
}
