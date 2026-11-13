CREATE TABLE `favorite_items` (
	`id` text PRIMARY KEY NOT NULL,
	`favorite_id` text NOT NULL,
	`position` integer NOT NULL,
	`food_id` text,
	`food_name` text NOT NULL,
	`weight_grams` real NOT NULL,
	`calories` real NOT NULL,
	`protein_g` real NOT NULL,
	`carbs_g` real NOT NULL,
	`fat_g` real NOT NULL,
	`fiber_g` real NOT NULL,
	`sugar_g` real NOT NULL,
	`sodium_mg` real NOT NULL,
	FOREIGN KEY (`favorite_id`) REFERENCES `favorites`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "favorite_items_position_valid" CHECK("favorite_items"."position" BETWEEN 0 AND 19),
	CONSTRAINT "favorite_items_weight_positive" CHECK("favorite_items"."weight_grams" > 0),
	CONSTRAINT "favorite_items_nutrients_nonnegative" CHECK("favorite_items"."calories" >= 0 AND "favorite_items"."protein_g" >= 0 AND "favorite_items"."carbs_g" >= 0 AND "favorite_items"."fat_g" >= 0 AND "favorite_items"."fiber_g" >= 0 AND "favorite_items"."sugar_g" >= 0 AND "favorite_items"."sodium_mg" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `favorite_items_position_unique` ON `favorite_items` (`favorite_id`,`position`);--> statement-breakpoint
CREATE TABLE `favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`input_method` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "favorites_input_method_valid" CHECK("favorites"."input_method" IN ('photo', 'voice', 'text', 'barcode', 'search', 'chat', 'recipe'))
);
--> statement-breakpoint
CREATE INDEX `favorites_user_created_idx` ON `favorites` (`user_id`,`created_at`);