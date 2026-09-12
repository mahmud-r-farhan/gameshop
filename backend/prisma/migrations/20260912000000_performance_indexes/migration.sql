-- PerformanceIndexes
--
-- PostgreSQL does not create indexes for foreign keys, and the initial migration
-- only emitted unique constraints. As a result every list endpoint scanned whole
-- tables:
--
--   * `GET /orders`            -> seq scan on `orders` filtered by `user_id`
--   * `GET /reviews/product/:id` -> seq scan on `reviews` filtered by `product_id`
--   * `GET /products`          -> seq scan + sort on `products`
--   * every `onDelete: Cascade` -> seq scan of the child table per deleted parent
--
-- The indexes below match the access patterns used by the service layer. They are
-- created with `IF NOT EXISTS` so the migration is safe to replay against a
-- database that already has some of them (e.g. one built by `prisma db push`).

-- users
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users"("role");
CREATE INDEX IF NOT EXISTS "users_is_active_idx" ON "users"("is_active");
CREATE INDEX IF NOT EXISTS "users_phone_idx" ON "users"("phone");
CREATE INDEX IF NOT EXISTS "users_created_at_idx" ON "users"("created_at" DESC);

-- products
CREATE INDEX IF NOT EXISTS "products_category_game_type_idx" ON "products"("category", "game_type");
CREATE INDEX IF NOT EXISTS "products_is_available_is_featured_idx" ON "products"("is_available", "is_featured");
CREATE INDEX IF NOT EXISTS "products_price_idx" ON "products"("price");
CREATE INDEX IF NOT EXISTS "products_created_by_idx" ON "products"("created_by");
CREATE INDEX IF NOT EXISTS "products_created_at_idx" ON "products"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "products_name_idx" ON "products"("name");

-- product_specs
CREATE INDEX IF NOT EXISTS "product_specs_product_id_idx" ON "product_specs"("product_id");

-- promotions
CREATE INDEX IF NOT EXISTS "promotions_is_active_valid_until_idx" ON "promotions"("is_active", "valid_until");
CREATE INDEX IF NOT EXISTS "promotions_created_by_idx" ON "promotions"("created_by");

-- order_items
CREATE INDEX IF NOT EXISTS "order_items_order_id_idx" ON "order_items"("order_id");
CREATE INDEX IF NOT EXISTS "order_items_product_id_idx" ON "order_items"("product_id");

-- orders
CREATE INDEX IF NOT EXISTS "orders_user_id_created_at_idx" ON "orders"("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "orders_order_status_created_at_idx" ON "orders"("order_status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "orders_payment_status_idx" ON "orders"("payment_status");
CREATE INDEX IF NOT EXISTS "orders_delivery_status_idx" ON "orders"("delivery_status");
CREATE INDEX IF NOT EXISTS "orders_created_at_idx" ON "orders"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "orders_promo_id_idx" ON "orders"("promo_id");
CREATE INDEX IF NOT EXISTS "orders_payment_verified_by_idx" ON "orders"("payment_verified_by");
CREATE INDEX IF NOT EXISTS "orders_transaction_id_idx" ON "orders"("transaction_id");

-- order_status_history
CREATE INDEX IF NOT EXISTS "order_status_history_order_id_created_at_idx" ON "order_status_history"("order_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "order_status_history_changed_by_idx" ON "order_status_history"("changed_by");

-- reviews
CREATE INDEX IF NOT EXISTS "reviews_product_id_created_at_idx" ON "reviews"("product_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "reviews_product_id_rating_idx" ON "reviews"("product_id", "rating");
CREATE INDEX IF NOT EXISTS "reviews_user_id_idx" ON "reviews"("user_id");
CREATE INDEX IF NOT EXISTS "reviews_order_id_idx" ON "reviews"("order_id");

-- payments
CREATE INDEX IF NOT EXISTS "payments_order_id_idx" ON "payments"("order_id");
CREATE INDEX IF NOT EXISTS "payments_user_id_idx" ON "payments"("user_id");
CREATE INDEX IF NOT EXISTS "payments_status_created_at_idx" ON "payments"("status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "payments_payment_method_idx" ON "payments"("payment_method");
CREATE INDEX IF NOT EXISTS "payments_verified_by_idx" ON "payments"("verified_by");

-- customer_feedback
CREATE INDEX IF NOT EXISTS "customer_feedback_user_id_created_at_idx" ON "customer_feedback"("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "customer_feedback_status_created_at_idx" ON "customer_feedback"("status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "customer_feedback_replied_by_idx" ON "customer_feedback"("replied_by");

-- payment_gateways
CREATE INDEX IF NOT EXISTS "payment_gateways_is_enabled_display_order_idx" ON "payment_gateways"("is_enabled", "display_order");

-- admin_settings
CREATE INDEX IF NOT EXISTS "admin_settings_updated_by_idx" ON "admin_settings"("updated_by");
