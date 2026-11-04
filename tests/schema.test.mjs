import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { readMigrationFiles } from 'drizzle-orm/migrator';

test('migrations enforce user/profile ownership and retain target history', async () => {
  const client = createClient({ url: ':memory:' });
  try {
    await migrate(drizzle(client), { migrationsFolder: './drizzle' });
    await client.execute('PRAGMA foreign_keys = ON');
    const insertUser = (id, email) => client.execute({
      sql: 'INSERT INTO users (id,email,name,password_hash,created_at) VALUES (?,?,?,?,?)',
      args: [id, email, 'Pengguna pengujian', 'test-only-not-a-password', Date.now()]
    });
    await insertUser('u1', 'profile@example.test');
    await assert.rejects(insertUser('u2', 'PROFILE@example.test'), /UNIQUE/);
    const insertProfile = (id, userId, age = 28, gender = 'male', activity = 'light', goal = 'maintenance') => client.execute({
      sql: 'INSERT INTO user_profiles (id,user_id,age,gender,weight_kg,height_cm,activity_level,goal,updated_at) VALUES (?,?,?,?,?,?,?,?,?)',
      args: [id, userId, age, gender, 75, 175, activity, goal, Date.now()]
    });
    await assert.rejects(insertProfile('bad-age', 'u1', 0), /CHECK/);
    await assert.rejects(insertProfile('bad-gender', 'u1', 28, 'invalid'), /CHECK/);
    await assert.rejects(insertProfile('bad-activity', 'u1', 28, 'male', 'invalid'), /CHECK/);
    await assert.rejects(insertProfile('bad-goal', 'u1', 28, 'male', 'light', 'invalid'), /CHECK/);
    await assert.rejects(insertProfile('orphan', 'missing-user'), /FOREIGN KEY/);
    await insertProfile('p1', 'u1');
    await assert.rejects(insertProfile('p2', 'u1'), /UNIQUE/);
    for (const [column, value] of [['weight_kg', 0], ['weight_kg', 501], ['height_cm', 0], ['height_cm', 281]]) {
      await assert.rejects(client.execute({ sql: `UPDATE user_profiles SET ${column} = ? WHERE id = 'p1'`, args: [value] }), /CHECK/);
    }
    const insertTarget = (id, effectiveFrom, bmr = 1708.75, protein = 120) => client.execute({
      sql: 'INSERT INTO nutrition_targets (id,user_id,bmr,tdee,target_calories,target_protein_g,target_carbs_g,target_fat_g,effective_from) VALUES (?,?,?,?,?,?,?,?,?)',
      args: [id, 'u1', bmr, 2349.53125, 2350, protein, 280, 65, effectiveFrom]
    });
    await assert.rejects(insertTarget('invalid-bmr', 1, 0), /CHECK/);
    await assert.rejects(insertTarget('invalid-protein', 1, 1708.75, -1), /CHECK/);
    await insertTarget('target-1', 1);
    await insertTarget('target-2', 2);
    assert.equal((await client.execute('SELECT count(*) AS total FROM nutrition_targets')).rows[0].total, 2);
    assert.equal((await client.execute("SELECT name FROM sqlite_master WHERE type='index' AND name='nutrition_targets_user_effective_idx'")).rows.length, 1);
    await client.execute("DELETE FROM users WHERE id = 'u1'");
    assert.equal((await client.execute('SELECT count(*) AS total FROM user_profiles')).rows[0].total, 0);
    assert.equal((await client.execute('SELECT count(*) AS total FROM nutrition_targets')).rows[0].total, 0);
    assert.deepEqual((await client.execute('PRAGMA foreign_key_check')).rows, []);
    // Re-running migrations must preserve an already initialized database.
    await migrate(drizzle(client), { migrationsFolder: './drizzle' });
  } finally {
    client.close();
  }
});

test('food catalog upgrade preserves logs and deleting catalog food keeps nutrition snapshots', async () => {
  const client = createClient({ url: ':memory:' });
  try {
    const migrations = readMigrationFiles({ migrationsFolder: './drizzle' });
    const upgrade = migrations.findIndex(m => m.sql.some(sql => sql.includes('CREATE TABLE `foods`')));
    assert.ok(upgrade > 0);
    const apply = async migration => { for (const sql of migration.sql) if (sql.trim()) await client.execute(sql); };
    for (const migration of migrations.slice(0, upgrade)) await apply(migration);
    await client.execute("INSERT INTO users (id,email,name,password_hash,created_at) VALUES ('owner','catalog@example.test','Test','test-only',1)");
    await client.execute("INSERT INTO food_logs (id,user_id,meal_type,input_method,logged_at) VALUES ('meal','owner','lunch','search',1)");
    await client.execute("INSERT INTO food_log_items (id,food_log_id,food_name,weight_grams,calories) VALUES ('rice','meal','Nasi',100,130)");
    for (const migration of migrations.slice(upgrade)) await apply(migration);
    assert.equal((await client.execute("SELECT calories FROM food_log_items WHERE id='rice'")).rows[0].calories, 130);
    const insertFood = (id, barcode, calories = 130) => client.execute({ sql: 'INSERT INTO foods (id,name,barcode,serving_size_g,calories_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,fiber_per_100g,sugar_per_100g,sodium_per_100g,source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', args: [id,'Nasi',barcode,100,calories,2.5,28,0.3,0.4,0.1,1,'manual'] });
    await insertFood('catalog-rice','12345678');
    await assert.rejects(insertFood('duplicate','12345678'), /UNIQUE/);
    await assert.rejects(insertFood('invalid',null,-1), /CHECK/);
    await client.execute("UPDATE food_log_items SET food_id='catalog-rice' WHERE id='rice'");
    await client.execute("DELETE FROM foods WHERE id='catalog-rice'");
    const [saved] = (await client.execute("SELECT food_id,food_name,calories FROM food_log_items WHERE id='rice'")).rows;
    assert.equal(saved.food_id, null);
    assert.equal(saved.food_name, 'Nasi');
    assert.equal(saved.calories, 130);
    assert.deepEqual((await client.execute('PRAGMA foreign_key_check')).rows, []);
  } finally { client.close(); }
});

test('food-log migration supports multiple items and rejects invalid nutrition', async () => {
  const client = createClient({ url: ':memory:' });
  try {
    await migrate(drizzle(client), { migrationsFolder: './drizzle' });
    await client.execute('PRAGMA foreign_keys = ON');
    await client.execute("INSERT INTO users (id,email,name,password_hash,created_at) VALUES ('owner','food@example.test','Test','test-only',1)");
    await client.execute("INSERT INTO food_logs (id,user_id,meal_type,input_method,confidence_score,logged_at) VALUES ('meal','owner','lunch','photo',0.88,1)");
    for (const [id, name, grams, calories] of [['rice','Nasi',200,260], ['chicken','Ayam',100,165]]) {
      await client.execute({ sql: 'INSERT INTO food_log_items (id,food_log_id,food_name,weight_grams,calories) VALUES (?,?,?,?,?)', args: [id,'meal',name,grams,calories] });
    }
    assert.equal((await client.execute("SELECT sum(calories) AS calories FROM food_log_items WHERE food_log_id='meal'")).rows[0].calories, 425);
    for (const [column, value] of [['meal_type','invalid'], ['input_method','invalid'], ['confidence_score',1.1], ['total_calories',-1]]) {
      await assert.rejects(client.execute({ sql: `UPDATE food_logs SET ${column}=? WHERE id='meal'`, args: [value] }), /CHECK/);
    }
    for (const [column, value] of [['weight_grams',0], ['calories',-1], ['sodium_mg',-1]]) {
      await assert.rejects(client.execute({ sql: `UPDATE food_log_items SET ${column}=? WHERE id='rice'`, args: [value] }), /CHECK/);
    }
    await assert.rejects(client.execute("INSERT INTO food_log_items (id,food_log_id,food_name,weight_grams,calories) VALUES ('orphan','absent','Nasi',100,130)"), /FOREIGN KEY/);
    await client.execute("DELETE FROM users WHERE id='owner'");
    assert.equal((await client.execute('SELECT count(*) AS total FROM food_logs')).rows[0].total, 0);
    assert.equal((await client.execute('SELECT count(*) AS total FROM food_log_items')).rows[0].total, 0);
  } finally { client.close(); }
});
