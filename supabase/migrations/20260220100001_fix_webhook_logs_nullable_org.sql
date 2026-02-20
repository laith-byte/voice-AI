-- Make webhook_logs.organization_id nullable so that Stripe webhook events
-- without organization_id metadata (e.g. invoice.paid, invoice.payment_failed,
-- customer.subscription.deleted/updated) can still be logged.

ALTER TABLE webhook_logs ALTER COLUMN organization_id DROP NOT NULL;
