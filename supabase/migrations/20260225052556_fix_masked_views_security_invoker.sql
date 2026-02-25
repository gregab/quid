-- Fix SECURITY DEFINER warning on masked views.
-- Set security_invoker = true so RLS policies of the querying user apply,
-- not the view owner's permissions.

ALTER VIEW "ExpenseMasked" SET (security_invoker = true);
ALTER VIEW "RecurringExpenseMasked" SET (security_invoker = true);
ALTER VIEW "ActivityLogMasked" SET (security_invoker = true);
