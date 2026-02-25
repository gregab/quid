/** Shared character-length limits — used by client maxLength, API Zod schemas, and DB CHECK constraints. */
export const MAX_GROUP_NAME = 40;
export const MAX_EXPENSE_DESCRIPTION = 65;
export const MAX_DISPLAY_NAME = 30;
export const MAX_EMAIL = 254; // RFC 5321
export const MAX_FEEDBACK_MESSAGE = 5000;

/** Emoji palette for user profile fallbacks. Shared between group page, auth, and migrations. */
export const MEMBER_EMOJIS = [
  "🦊", "🐼", "🧙", "🦄", "🐬", "🦁", "🐙", "🐢", "🦝", "🐻",
  "🐺", "🐲", "🦈", "🐸", "🦇", "🐿️", "🐨", "🐯", "🦦",
  "🦥", "🦔", "🐵", "🦋", "🐱",
];
