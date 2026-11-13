CREATE TABLE `quest_claims` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `day` text NOT NULL,
  `quest_id` text NOT NULL,
  `xp` integer NOT NULL CHECK (`xp` > 0),
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quest_claims_user_day_quest` ON `quest_claims` (`user_id`, `day`, `quest_id`);
--> statement-breakpoint
CREATE TABLE `adventure_profiles` (
  `user_id` text PRIMARY KEY NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `equipped_reward` text DEFAULT 'moon-scout' NOT NULL
);
