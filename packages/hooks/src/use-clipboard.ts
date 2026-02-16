import { type Result, failure, success } from "@pkg/result";
import { useCallback, useState } from "react";

export class ClipboardError extends Error {
	readonly operation: "read" | "write";

	constructor(message: string, operation: "read" | "write", cause?: Error) {
		super(message, { cause });
		this.name = "ClipboardError";
		this.operation = operation;
	}
}

export namespace useClipboard {
	export type Status = "idle" | "loading" | "success" | "failure";

	export interface State {
		status: Status;
		data: ClipboardItems | ClipboardError | null;
	}

	export interface Return {
		status: Status;
		data: ClipboardItems | ClipboardError | null;
		read(): Promise<Result<ClipboardItems, ClipboardError>>;
		write(data: ClipboardItems): Promise<Result<null, ClipboardError>>;
		reset(): void;
	}
}

export function useClipboard(): useClipboard.Return {
	let [state, setState] = useState<useClipboard.State>({
		status: "idle",
		data: null,
	});

	let read = useCallback(async (): Promise<Result<ClipboardItems, ClipboardError>> => {
		setState({ status: "loading", data: null });
		try {
			let items = await navigator.clipboard.read();
			setState({ status: "success", data: items });
			return success(items);
		} catch (error) {
			let clipboardError = new ClipboardError(
				"Failed to read clipboard",
				"read",
				error instanceof Error ? error : new Error(String(error)),
			);
			setState({ status: "failure", data: clipboardError });
			return failure(clipboardError);
		}
	}, []);

	let write = useCallback(async (data: ClipboardItems): Promise<Result<null, ClipboardError>> => {
		setState({ status: "loading", data: null });
		try {
			await navigator.clipboard.write(data);
			setState({ status: "success", data: null });
			return success(null);
		} catch (error) {
			let clipboardError = new ClipboardError(
				"Failed to write to clipboard",
				"write",
				error instanceof Error ? error : new Error(String(error)),
			);
			setState({ status: "failure", data: clipboardError });
			return failure(clipboardError);
		}
	}, []);

	let reset = useCallback(() => void setState({ status: "idle", data: null }), []);

	return { status: state.status, data: state.data, read, write, reset };
}
