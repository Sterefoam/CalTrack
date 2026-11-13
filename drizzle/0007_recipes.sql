CREATE TABLE `recipe_ingredients` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`position` integer NOT NULL,
	`label` text NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "recipe_ingredients_position_valid" CHECK("recipe_ingredients"."position" >= 0),
	CONSTRAINT "recipe_ingredients_label_valid" CHECK(length(trim("recipe_ingredients"."label")) BETWEEN 1 AND 500)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_ingredients_position_unique` ON `recipe_ingredients` (`recipe_id`,`position`);--> statement-breakpoint
CREATE TABLE `recipe_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`position` integer NOT NULL,
	`instruction` text NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "recipe_steps_position_valid" CHECK("recipe_steps"."position" >= 0),
	CONSTRAINT "recipe_steps_instruction_valid" CHECK(length(trim("recipe_steps"."instruction")) BETWEEN 1 AND 2000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_steps_position_unique` ON `recipe_steps` (`recipe_id`,`position`);--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`meal_type` text NOT NULL,
	`minutes` integer NOT NULL,
	`serving_weight_g` real,
	`calories` real NOT NULL,
	`protein_g` real NOT NULL,
	`carbs_g` real NOT NULL,
	`fat_g` real NOT NULL,
	`fiber_g` real,
	`sugar_g` real,
	`sodium_mg` real,
	`allergens` text NOT NULL,
	`source` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "recipes_name_valid" CHECK(length(trim("recipes"."name")) BETWEEN 1 AND 120),
	CONSTRAINT "recipes_meal_valid" CHECK("recipes"."meal_type" IN ('breakfast', 'lunch', 'dinner', 'snack')),
	CONSTRAINT "recipes_minutes_valid" CHECK("recipes"."minutes" BETWEEN 1 AND 1440),
	CONSTRAINT "recipes_serving_valid" CHECK("recipes"."serving_weight_g" IS NULL OR "recipes"."serving_weight_g" > 0),
	CONSTRAINT "recipes_macros_valid" CHECK("recipes"."calories" >= 0 AND "recipes"."protein_g" >= 0 AND "recipes"."carbs_g" >= 0 AND "recipes"."fat_g" >= 0),
	CONSTRAINT "recipes_micros_valid" CHECK(("recipes"."fiber_g" IS NULL OR "recipes"."fiber_g" >= 0) AND ("recipes"."sugar_g" IS NULL OR "recipes"."sugar_g" >= 0) AND ("recipes"."sodium_mg" IS NULL OR "recipes"."sodium_mg" >= 0)),
	CONSTRAINT "recipes_source_valid" CHECK("recipes"."source" IN ('example', 'curated'))
);
--> statement-breakpoint
CREATE INDEX `recipes_meal_calories_idx` ON `recipes` (`meal_type`,`calories`);