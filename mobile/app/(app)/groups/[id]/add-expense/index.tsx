// This file exists so that split.tsx and advanced.tsx can import extractMembers
// from a stable path. The actual Screen 1 is rendered by add-expense.tsx (the
// parent file takes precedence over this index in Expo Router).
export { default, extractMembers } from "../add-expense";
