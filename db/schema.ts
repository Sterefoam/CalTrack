import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { check, index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    image: text("image"),
    emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().default(sql`0`).$onUpdateFn(() => new Date()),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date())
  },
  (table) => [uniqueIndex("users_email_lower_unique").on(sql`lower(${table.email})`)]
);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent")
}, table => [uniqueIndex("sessions_token_unique").on(table.token), index("sessions_user_idx").on(table.userId)]);

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  password: text("password"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
  scope: text("scope"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
}, table => [index("accounts_user_idx").on(table.userId), uniqueIndex("accounts_provider_unique").on(table.providerId, table.accountId)]);

export const verifications = sqliteTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull()
}, table => [index("verifications_identifier_idx").on(table.identifier)]);

export const jwks = sqliteTable("jwks", {
  id: text("id").primaryKey(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  alg: text("alg"),
  crv: text("crv")
});

export const userProfiles = sqliteTable(
  "user_profiles",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    age: integer("age").notNull(),
    gender: text("gender", { enum: ["female", "male", "other"] }).notNull(),
    weightKg: real("weight_kg").notNull(),
    heightCm: real("height_cm").notNull(),
    activityLevel: text("activity_level", {
      enum: ["sedentary", "light", "moderate", "active", "very_active"]
    }).notNull(),
    goal: text("goal", { enum: ["weight_loss", "maintenance", "weight_gain"] }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()).$onUpdateFn(() => new Date())
  },
  (table) => [
    uniqueIndex("user_profiles_user_id_unique").on(table.userId),
    check("user_profiles_age_range", sql`${table.age} BETWEEN 1 AND 120`),
    check("user_profiles_weight_positive", sql`${table.weightKg} > 0 AND ${table.weightKg} <= 500`),
    check("user_profiles_height_positive", sql`${table.heightCm} > 0 AND ${table.heightCm} <= 280`),
    check("user_profiles_gender_valid", sql`${table.gender} IN ('female', 'male', 'other')`),
    check("user_profiles_activity_valid", sql`${table.activityLevel} IN ('sedentary', 'light', 'moderate', 'active', 'very_active')`),
    check("user_profiles_goal_valid", sql`${table.goal} IN ('weight_loss', 'maintenance', 'weight_gain')`)
  ]
);

export const nutritionTargets = sqliteTable(
  "nutrition_targets",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    bmr: real("bmr").notNull(),
    tdee: real("tdee").notNull(),
    targetCalories: real("target_calories").notNull(),
    targetProteinG: real("target_protein_g").notNull(),
    targetCarbsG: real("target_carbs_g").notNull(),
    targetFatG: real("target_fat_g").notNull(),
    effectiveFrom: integer("effective_from", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date())
  },
  (table) => [
    index("nutrition_targets_user_effective_idx").on(table.userId, table.effectiveFrom),
    check("nutrition_targets_bmr_positive", sql`${table.bmr} > 0`),
    check("nutrition_targets_tdee_positive", sql`${table.tdee} > 0`),
    check("nutrition_targets_calories_positive", sql`${table.targetCalories} > 0`),
    check("nutrition_targets_macros_nonnegative", sql`${table.targetProteinG} >= 0 AND ${table.targetCarbsG} >= 0 AND ${table.targetFatG} >= 0`)
  ]
);

export const foods = sqliteTable("foods", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  name: text("name").notNull(),
  brand: text("brand"),
  barcode: text("barcode"),
  servingSizeG: real("serving_size_g").notNull(),
  caloriesPer100g: real("calories_per_100g").notNull(),
  proteinPer100g: real("protein_per_100g").notNull(),
  carbsPer100g: real("carbs_per_100g").notNull(),
  fatPer100g: real("fat_per_100g").notNull(),
  fiberPer100g: real("fiber_per_100g").notNull(),
  sugarPer100g: real("sugar_per_100g").notNull(),
  sodiumPer100g: real("sodium_per_100g").notNull(),
  source: text("source", { enum: ["manual", "openfoodfacts", "ai"] }).notNull()
}, table => [
  uniqueIndex("foods_barcode_unique").on(table.barcode),
  index("foods_name_idx").on(table.name),
  check("foods_serving_positive", sql`${table.servingSizeG} > 0`),
  check("foods_nutrients_nonnegative", sql`${table.caloriesPer100g} >= 0 AND ${table.proteinPer100g} >= 0 AND ${table.carbsPer100g} >= 0 AND ${table.fatPer100g} >= 0 AND ${table.fiberPer100g} >= 0 AND ${table.sugarPer100g} >= 0 AND ${table.sodiumPer100g} >= 0`),
  check("foods_source_valid", sql`${table.source} IN ('manual', 'openfoodfacts', 'ai')`)
]);

export const foodLogs = sqliteTable(
  "food_logs",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    mealType: text("meal_type", { enum: ["breakfast", "lunch", "dinner", "snack"] }).notNull(),
    inputMethod: text("input_method", { enum: ["photo", "voice", "text", "barcode", "search", "chat", "recipe"] }).notNull(),
    imageUrl: text("image_url"),
    totalCalories: real("total_calories").notNull().default(0),
    totalProteinG: real("total_protein_g").notNull().default(0),
    totalCarbsG: real("total_carbs_g").notNull().default(0),
    totalFatG: real("total_fat_g").notNull().default(0),
    confidenceScore: real("confidence_score"),
    rawAiResponse: text("raw_ai_response"),
    notes: text("notes"),
    loggedAt: integer("logged_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date())
  },
  (table) => [
    index("food_logs_user_logged_idx").on(table.userId, table.loggedAt),
    check("food_logs_meal_type_valid", sql`${table.mealType} IN ('breakfast', 'lunch', 'dinner', 'snack')`),
    check("food_logs_input_method_valid", sql`${table.inputMethod} IN ('photo', 'voice', 'text', 'barcode', 'search', 'chat', 'recipe')`),
    check("food_logs_totals_nonnegative", sql`${table.totalCalories} >= 0 AND ${table.totalProteinG} >= 0 AND ${table.totalCarbsG} >= 0 AND ${table.totalFatG} >= 0`),
    check("food_logs_confidence_range", sql`${table.confidenceScore} IS NULL OR (${table.confidenceScore} >= 0 AND ${table.confidenceScore} <= 1)`)
  ]
);

export const foodLogItems = sqliteTable(
  "food_log_items",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    foodLogId: text("food_log_id").notNull().references(() => foodLogs.id, { onDelete: "cascade" }),
    foodId: text("food_id").references(() => foods.id, { onDelete: "set null" }),
    foodName: text("food_name").notNull(),
    weightGrams: real("weight_grams").notNull(),
    calories: real("calories").notNull(),
    proteinG: real("protein_g").notNull().default(0),
    carbsG: real("carbs_g").notNull().default(0),
    fatG: real("fat_g").notNull().default(0),
    fiberG: real("fiber_g").notNull().default(0),
    sugarG: real("sugar_g").notNull().default(0),
    sodiumMg: real("sodium_mg").notNull().default(0)
  },
  (table) => [
    index("food_log_items_log_idx").on(table.foodLogId),
    check("food_log_items_weight_positive", sql`${table.weightGrams} > 0`),
    check("food_log_items_nutrients_nonnegative", sql`${table.calories} >= 0 AND ${table.proteinG} >= 0 AND ${table.carbsG} >= 0 AND ${table.fatG} >= 0 AND ${table.fiberG} >= 0 AND ${table.sugarG} >= 0 AND ${table.sodiumMg} >= 0`)
  ]
);

export const waterLogs = sqliteTable(
  "water_logs",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    amountMl: integer("amount_ml").notNull(),
    loggedAt: integer("logged_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date())
  },
  (table) => [
    index("water_logs_user_logged_idx").on(table.userId, table.loggedAt),
    check("water_logs_amount_positive", sql`${table.amountMl} BETWEEN 1 AND 10000`)
  ]
);

export const exerciseLogs = sqliteTable(
  "exercise_logs",
  {
    id: text("id").primaryKey().$defaultFn(() => randomUUID()),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    activityName: text("activity_name").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    caloriesBurned: real("calories_burned").notNull(),
    loggedAt: integer("logged_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date())
  },
  (table) => [
    index("exercise_logs_user_logged_idx").on(table.userId, table.loggedAt),
    check("exercise_logs_duration_positive", sql`${table.durationMinutes} BETWEEN 1 AND 1440`),
    check("exercise_logs_calories_nonnegative", sql`${table.caloriesBurned} >= 0`)
  ]
);

export type User = typeof users.$inferSelect;
export const chatConversations = sqliteTable("chat_conversations", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date())
}, table => [index("chat_conversations_user_idx").on(table.userId, table.updatedAt)]);
export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  conversationId: text("conversation_id").notNull().references(() => chatConversations.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  suggestedFood: text("suggested_food"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date())
}, table => [index("chat_messages_conversation_idx").on(table.conversationId, table.createdAt), check("chat_messages_role_valid", sql`${table.role} IN ('user', 'assistant')`)]);
export type NewUser = typeof users.$inferInsert;
export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;
export type NutritionTarget = typeof nutritionTargets.$inferSelect;
export type NewNutritionTarget = typeof nutritionTargets.$inferInsert;
export type FoodLog = typeof foodLogs.$inferSelect;
export type NewFoodLog = typeof foodLogs.$inferInsert;
export type FoodLogItem = typeof foodLogItems.$inferSelect;
export type WaterLog = typeof waterLogs.$inferSelect;
export type ExerciseLog = typeof exerciseLogs.$inferSelect;
