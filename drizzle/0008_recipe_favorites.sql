CREATE TABLE `recipe_favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`recipe_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_favorites_user_recipe_unique` ON `recipe_favorites` (`user_id`,`recipe_id`);--> statement-breakpoint
CREATE INDEX `recipe_favorites_user_created_idx` ON `recipe_favorites` (`user_id`,`created_at`);