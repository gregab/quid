/**
 * Mock for react-native-gesture-handler.
 */
import type { ReactNode } from "react";

type Props = Record<string, unknown> & { children?: ReactNode };

export const GestureHandlerRootView = ({ children, ...props }: Props) => <div {...props}>{children}</div>;
export const Swipeable = ({ children }: Props) => <>{children}</>;
export const DrawerLayout = ({ children }: Props) => <>{children}</>;
export const PanGestureHandler = ({ children }: Props) => <>{children}</>;
export const TapGestureHandler = ({ children }: Props) => <>{children}</>;
export const LongPressGestureHandler = ({ children }: Props) => <>{children}</>;

export const State = { BEGAN: 0, FAILED: 1, ACTIVE: 2, END: 3, CANCELLED: 4, UNDETERMINED: 5 };
export const Directions = { RIGHT: 1, LEFT: 2, UP: 4, DOWN: 8 };
export const gestureHandlerRootHOC = <T,>(component: T): T => component;
