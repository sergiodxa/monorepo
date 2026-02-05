import type { ComponentProps } from "react";

import { FileTrigger as AriaFileTrigger } from "react-aria-components";

export namespace FileTrigger {
	export interface Props extends ComponentProps<typeof AriaFileTrigger> {}
}

export function FileTrigger(props: FileTrigger.Props) {
	return <AriaFileTrigger {...props} />;
}
