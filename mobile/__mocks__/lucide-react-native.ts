/**
 * Mock for lucide-react-native.
 * Used as a vitest alias + server.deps.inline to avoid loading the real barrel.
 *
 * All named imports used in the app are explicitly listed here so vitest can
 * enumerate the module's exports without falling back to the real package
 * (a Proxy with no ownKeys trap triggers that fallback, causing a hang).
 *
 * Each icon renders with data-testid="icon-<Name>" so tests can assert
 * which specific icon is rendered.
 */
import { createElement } from "react";

function makeStub(name: string) {
  return (props: Record<string, unknown>) =>
    createElement("span", { "data-icon": true, "data-testid": `icon-${name}`, ...props });
}

// Named exports — every icon used anywhere in mobile/
export const ArrowDownLeft = makeStub("ArrowDownLeft");
export const Link = makeStub("Link");
export const ArrowRight = makeStub("ArrowRight");
export const ArrowUpRight = makeStub("ArrowUpRight");
export const Calendar = makeStub("Calendar");
export const Check = makeStub("Check");
export const CheckCircle = makeStub("CheckCircle");
export const CheckCircle2 = makeStub("CheckCircle2");
export const ChevronDown = makeStub("ChevronDown");
export const ChevronLeft = makeStub("ChevronLeft");
export const ChevronRight = makeStub("ChevronRight");
export const CirclePlus = makeStub("CirclePlus");
export const FileText = makeStub("FileText");
export const Hash = makeStub("Hash");
export const ImageIcon = makeStub("ImageIcon");
export const Info = makeStub("Info");
export const LogOut = makeStub("LogOut");
export const Moon = makeStub("Moon");
export const Pencil = makeStub("Pencil");
export const Plus = makeStub("Plus");
export const Receipt = makeStub("Receipt");
export const RefreshCw = makeStub("RefreshCw");
export const Repeat = makeStub("Repeat");
export const Search = makeStub("Search");
export const Settings = makeStub("Settings");
export const SlidersHorizontal = makeStub("SlidersHorizontal");
export const Shield = makeStub("Shield");
export const Square = makeStub("Square");
export const Trash2 = makeStub("Trash2");
export const TrendingDown = makeStub("TrendingDown");
export const TrendingUp = makeStub("TrendingUp");
export const TriangleAlert = makeStub("TriangleAlert");
export const UserPlus = makeStub("UserPlus");
export const Users = makeStub("Users");
export const X = makeStub("X");
export const XCircle = makeStub("XCircle");

export const createLucideIcon = () => makeStub("unknown");
export default { createLucideIcon };
