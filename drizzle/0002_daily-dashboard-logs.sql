CREATE TABLE `exercise_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`activity_name` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`calories_burned` real NOT NULL,
	`logged_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "exercise_logs_duration_positive" CHECK("exercise_logs"."duration_minutes" BETWEEN 1 AND 1440),
	CONSTRAINT "exercise_logs_calories_nonnegative" CHECK("exercise_logs"."calories_burned" >= 0)
);
--> statement-breakpoint
CREATE INDEX `exercise_logs_user_logged_idx` ON `exercise_logs` (`user_id`,`logged_at`);--> statement-breakpoint
CREATE TABLE `food_log_items` (
	`id` text PRIMARY KEY NOT NULL,
	`food_log_id` text NOT NULL,
	`food_id` text,
	`food_name` text NOT NULL,
	`weight_grams` real NOT NULL,
	`calories` real NOT NULL,
	`protein_g` real DEFAULT 0 NOT NULL,
	`carbs_g` real DEFAULT 0 NOT NULL,
	`fat_g` real DEFAULT 0 NOT NULL,
	`fiber_g` real DEFAULT 0 NOT NULL,
	`sugar_g` real DEFAULT 0 NOT NULL,
	`sodium_mg` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`food_log_id`) REFERENCES `food_logs`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "food_log_items_weight_positive" CHECK("food_log_items"."weight_grams" > 0),
	CONSTRAINT "food_log_items_nutrients_nonnegative" CHECK("food_log_items"."calories" >= 0 AND "food_log_items"."protein_g" >= 0 AND "food_log_items"."carbs_g" >= 0 AND "food_log_items"."fat_g" >= 0 AND "food_log_items"."fiber_g" >= 0 AND "food_log_items"."sugar_g" >= 0 AND "food_log_items"."sodium_mg" >= 0)
);
--> statement-breakpoint
CREATE INDEX `food_log_items_log_idx` ON `food_log_items` (`food_log_id`);--> statement-breakpoint
CREATE TABLE `food_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`meal_type` text NOT NULL,
	`input_method` text NOT NULL,
	`image_url` text,
	`total_calories` real DEFAULT 0 NOT NULL,
	`total_protein_g` real DEFAULT 0 NOT NULL,
	`total_carbs_g` real DEFAULT 0 NOT NULL,
	`total_fat_g` real DEFAULT 0 NOT NULL,
	`confidence_score` real,
	`raw_ai_response` text,
	`notes` text,
	`logged_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "food_logs_meal_type_valid" CHECK("food_logs"."meal_type" IN ('breakfast', 'lunch', 'dinner', 'snack')),
	CONSTRAINT "food_logs_input_method_valid" CHECK("food_logs"."input_method" IN ('photo', 'voice', 'text', 'barcode', 'search', 'chat', 'recipe')),
	CONSTRAINT "food_logs_totals_nonnegative" CHECK("food_logs"."total_calories" >= 0 AND "food_logs"."total_protein_g" >= 0 AND "food_logs"."total_carbs_g" >= 0 AND "food_logs"."total_fat_g" >= 0),
	CONSTRAINT "food_logs_confidence_range" CHECK("food_logs"."confidence_score" IS NULL OR ("food_logs"."confidence_score" >= 0 AND "food_logs"."confidence_score" <= 1))
);
--> statement-breakpoint
CREATE INDEX `food_logs_user_logged_idx` ON `food_logs` (`user_id`,`logged_at`);--> statement-breakpoint
CREATE TABLE `water_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount_ml` integer NOT NULL,
	`logged_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "water_logs_amount_positive" CHECK("water_logs"."amount_ml" BETWEEN 1 AND 10000)
);
--> statement-breakpoint
CREATE INDEX `water_logs_user_logged_idx` ON `water_logs` (`user_id`,`logged_at`);