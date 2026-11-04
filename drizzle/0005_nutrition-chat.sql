CREATE TABLE `chat_conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chat_conversations_user_idx` ON `chat_conversations` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`suggested_food` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `chat_conversations`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chat_messages_role_valid" CHECK("chat_messages"."role" IN ('user', 'assistant'))
);
--> statement-breakpoint
CREATE INDEX `chat_messages_conversation_idx` ON `chat_messages` (`conversation_id`,`created_at`);