PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_user_profiles` (
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
	CONSTRAINT "user_profiles_age_range" CHECK("__new_user_profiles"."age" BETWEEN 1 AND 120),
	CONSTRAINT "user_profiles_weight_positive" CHECK("__new_user_profiles"."weight_kg" > 0 AND "__new_user_profiles"."weight_kg" <= 500),
	CONSTRAINT "user_profiles_height_positive" CHECK("__new_user_profiles"."height_cm" > 0 AND "__new_user_profiles"."height_cm" <= 280),
	CONSTRAINT "user_profiles_gender_valid" CHECK("__new_user_profiles"."gender" IN ('female', 'male', 'other')),
	CONSTRAINT "user_profiles_activity_valid" CHECK("__new_user_profiles"."activity_level" IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
	CONSTRAINT "user_profiles_goal_valid" CHECK("__new_user_profiles"."goal" IN ('weight_loss', 'maintenance', 'weight_gain'))
);
--> statement-breakpoint
INSERT INTO `__new_user_profiles`("id", "user_id", "age", "gender", "weight_kg", "height_cm", "activity_level", "goal", "updated_at") SELECT "id", "user_id", "age", "gender", "weight_kg", "height_cm", "activity_level", "goal", "updated_at" FROM `user_profiles`;--> statement-breakpoint
DROP TABLE `user_profiles`;--> statement-breakpoint
ALTER TABLE `__new_user_profiles` RENAME TO `user_profiles`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `user_profiles_user_id_unique` ON `user_profiles` (`user_id`);