CREATE TABLE `nutrition_targets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`bmr` real NOT NULL,
	`tdee` real NOT NULL,
	`target_calories` real NOT NULL,
	`target_protein_g` real NOT NULL,
	`target_carbs_g` real NOT NULL,
	`target_fat_g` real NOT NULL,
	`effective_from` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "nutrition_targets_bmr_positive" CHECK("nutrition_targets"."bmr" > 0),
	CONSTRAINT "nutrition_targets_tdee_positive" CHECK("nutrition_targets"."tdee" > 0),
	CONSTRAINT "nutrition_targets_calories_positive" CHECK("nutrition_targets"."target_calories" > 0),
	CONSTRAINT "nutrition_targets_macros_nonnegative" CHECK("nutrition_targets"."target_protein_g" >= 0 AND "nutrition_targets"."target_carbs_g" >= 0 AND "nutrition_targets"."target_fat_g" >= 0)
);
--> statement-breakpoint
CREATE INDEX `nutrition_targets_user_effective_idx` ON `nutrition_targets` (`user_id`,`effective_from`);--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`age` integer NOT NULL,
	`gender` text NOT NULL,
	`weight_kg` real NOT NULL,
	`height_cm` real NOT NULL,
	`activity_level` text NOT NULL,
	`goal` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "user_profiles_age_range" CHECK("user_profiles"."age" BETWEEN 1 AND 120),
	CONSTRAINT "user_profiles_weight_positive" CHECK("user_profiles"."weight_kg" > 0 AND "user_profiles"."weight_kg" <= 500),
	CONSTRAINT "user_profiles_height_positive" CHECK("user_profiles"."height_cm" > 0 AND "user_profiles"."height_cm" <= 280)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_profiles_user_id_unique` ON `user_profiles` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`image` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_lower_unique` ON `users` (lower("email"));