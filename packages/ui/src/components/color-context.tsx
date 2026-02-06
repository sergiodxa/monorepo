import { createContext, use, type ReactNode } from "react";

export type Color = "primary" | "neutral" | "danger" | "warning" | "success";

const ColorContext = createContext<Color>("neutral");

export function useColor(propsColor?: Color): Color {
	let contextColor = use(ColorContext);
	return propsColor ?? contextColor;
}

export interface ColorProviderProps {
	color: Color;
	children: ReactNode;
}

export function ColorProvider({ color, children }: ColorProviderProps) {
	return <ColorContext value={color}>{children}</ColorContext>;
}
