import type { cn } from "@pkg/cn";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn as classNames } from "@pkg/cn";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

export namespace Avatar {
	export type Status = "idle" | "loaded" | "error";

	export interface Props extends Omit<ComponentPropsWithoutRef<"span">, "className" | "children"> {
		src?: string;
		alt?: string;
		fallback?: string;
		children?: ReactNode;
		className?: cn.ClassName;
	}

	export interface ImageProps extends Omit<
		ComponentPropsWithoutRef<"img">,
		"className" | "src" | "alt"
	> {
		src: string;
		alt?: string;
		className?: cn.ClassName;
	}

	export interface FallbackProps extends Omit<
		ComponentPropsWithoutRef<"span">,
		"className" | "children"
	> {
		children?: ReactNode;
		className?: cn.ClassName;
	}
}

type AvatarContextValue = {
	status: Avatar.Status;
	setStatus: (status: Avatar.Status) => void;
};

let AvatarContext = createContext<AvatarContextValue | null>(null);

function useAvatarContext() {
	return useContext(AvatarContext);
}

export function Avatar({ src, alt, fallback, children, className, ...props }: Avatar.Props) {
	let [status, setStatus] = useState<Avatar.Status>(src ? "idle" : "error");

	useEffect(() => {
		setStatus(src ? "idle" : "error");
	}, [src]);

	let value = useMemo(() => ({ status, setStatus }), [status]);
	let showImage = Boolean(src) && status !== "error";
	let showFallback = !src || status !== "loaded";

	return (
		<span {...props} data-status={status} className={classNames("ui-avatar", className)}>
			<AvatarContext.Provider value={value}>
				{children ?? (
					<>
						{showImage && <Avatar.Image src={src ?? ""} alt={alt} />}
						{showFallback && fallback ? <Avatar.Fallback>{fallback}</Avatar.Fallback> : null}
					</>
				)}
			</AvatarContext.Provider>
		</span>
	);
}

Avatar.Image = function AvatarImage({ className, onLoad, onError, ...props }: Avatar.ImageProps) {
	let context = useAvatarContext();

	return (
		<img
			{...props}
			className={classNames("ui-avatar-image", className)}
			alt={props.alt ?? ""}
			onLoad={(event) => {
				context?.setStatus("loaded");
				onLoad?.(event);
			}}
			onError={(event) => {
				context?.setStatus("error");
				onError?.(event);
			}}
		/>
	);
};

Avatar.Fallback = function AvatarFallback({ className, children, ...props }: Avatar.FallbackProps) {
	let context = useAvatarContext();
	let hidden = context?.status === "loaded";

	return (
		<span {...props} hidden={hidden} className={classNames("ui-avatar-fallback", className)}>
			{children}
		</span>
	);
};
