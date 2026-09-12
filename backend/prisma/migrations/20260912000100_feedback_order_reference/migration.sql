-- FeedbackOrderReference
--
-- `POST /feedback` accepted an `orderId`, verified that the order belonged to the
-- caller, and then threw the value away: `customer_feedback` had no column to
-- store it. Support staff therefore could not tell which order a complaint was
-- about.
--
-- The column is nullable and the foreign key uses `ON DELETE SET NULL` so
-- purging an old order never deletes the audit trail of a resolved ticket.

ALTER TABLE "customer_feedback" ADD COLUMN IF NOT EXISTS "order_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customer_feedback_order_id_fkey'
  ) THEN
    ALTER TABLE "customer_feedback"
      ADD CONSTRAINT "customer_feedback_order_id_fkey"
      FOREIGN KEY ("order_id") REFERENCES "orders"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "customer_feedback_order_id_idx" ON "customer_feedback"("order_id");
