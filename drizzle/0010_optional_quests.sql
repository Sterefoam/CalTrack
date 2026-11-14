CREATE TABLE `quest_selections` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `day` text NOT NULL,
  `quest_id` text NOT NULL,
  `slot` integer NOT NULL CHECK (`slot` IN (1, 2)),
  `accepted_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quest_selections_user_day_quest` ON `quest_selections` (`user_id`, `day`, `quest_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `quest_selections_user_day_slot` ON `quest_selections` (`user_id`, `day`, `slot`);
