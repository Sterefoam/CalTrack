CREATE TABLE `foods` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`brand` text,
	`barcode` text,
	`serving_size_g` real NOT NULL,
	`calories_per_100g` real NOT NULL,
	`protein_per_100g` real NOT NULL,
	`carbs_per_100g` real NOT NULL,
	`fat_per_100g` real NOT NULL,
	`fiber_per_100g` real NOT NULL,
	`sugar_per_100g` real NOT NULL,
	`sodium_per_100g` real NOT NULL,
	`source` text NOT NULL,
	CONSTRAINT "foods_serving_positive" CHECK("foods"."serving_size_g" > 0),
	CONSTRAINT "foods_nutrients_nonnegative" CHECK("foods"."calories_per_100g" >= 0 AND "foods"."protein_per_100g" >= 0 AND "foods"."carbs_per_100g" >= 0 AND "foods"."fat_per_100g" >= 0 AND "foods"."fiber_per_100g" >= 0 AND "foods"."sugar_per_100g" >= 0 AND "foods"."sodium_per_100g" >= 0),
	CONSTRAINT "foods_source_valid" CHECK("foods"."source" IN ('manual', 'openfoodfacts', 'ai'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `foods_barcode_unique` ON `foods` (`barcode`);--> statement-breakpoint
CREATE INDEX `foods_name_idx` ON `foods` (`name`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_food_log_items` (
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
	FOREIGN KEY (`food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "food_log_items_weight_positive" CHECK("__new_food_log_items"."weight_grams" > 0),
	CONSTRAINT "food_log_items_nutrients_nonnegative" CHECK("__new_food_log_items"."calories" >= 0 AND "__new_food_log_items"."protein_g" >= 0 AND "__new_food_log_items"."carbs_g" >= 0 AND "__new_food_log_items"."fat_g" >= 0 AND "__new_food_log_items"."fiber_g" >= 0 AND "__new_food_log_items"."sugar_g" >= 0 AND "__new_food_log_items"."sodium_mg" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_food_log_items`("id", "food_log_id", "food_id", "food_name", "weight_grams", "calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "sugar_g", "sodium_mg") SELECT "id", "food_log_id", "food_id", "food_name", "weight_grams", "calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "sugar_g", "sodium_mg" FROM `food_log_items`;--> statement-breakpoint
DROP TABLE `food_log_items`;--> statement-breakpoint
ALTER TABLE `__new_food_log_items` RENAME TO `food_log_items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `food_log_items_log_idx` ON `food_log_items` (`food_log_id`);