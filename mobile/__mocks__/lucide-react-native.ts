/**
 * Mock for lucide-react-native.
 * Used as a vitest alias + server.deps.inline to avoid loading the real barrel.
 *
 * All named imports used in the app are explicitly listed here so vitest can
 * enumerate the module's exports without falling back to the real package
 * (a Proxy with no ownKeys trap triggers that fallback, causing a hang).
 */
import { createElement } from "react";

const stub = (props: Record<string, unknown>) =>
  createElement("span", { "data-icon": true, ...props });

// Named exports — every icon used anywhere in mobile/
export const ArrowDownLeft = stub;
export const ArrowRight = stub;
export const ArrowUpRight = stub;
export const Calendar = stub;
export const Check = stub;
export const CheckCircle = stub;
export const CheckCircle2 = stub;
export const ChevronDown = stub;
export const ChevronLeft = stub;
export const ChevronRight = stub;
export const FileText = stub;
export const Hash = stub;
export const ImageIcon = stub;
export const Info = stub;
export const LogOut = stub;
export const Moon = stub;
export const Pencil = stub;
export const Plus = stub;
export const Receipt = stub;
export const Repeat = stub;
export const Settings = stub;
export const Shield = stub;
export const Square = stub;
export const Trash2 = stub;
export const TrendingDown = stub;
export const TrendingUp = stub;
export const TriangleAlert = stub;
export const UserPlus = stub;
export const Users = stub;
export const X = stub;
export const XCircle = stub;

export const createLucideIcon = () => stub;
export default { createLucideIcon };
