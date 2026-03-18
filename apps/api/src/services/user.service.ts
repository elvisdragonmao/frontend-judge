import bcrypt from "bcrypt";
import { query, queryOne, queryMany, transaction } from "../db/pool.js";
import type { CreateUserRequest, BulkImportRow } from "@judge/shared";

interface UserRow {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  role: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

function toSummary(row: UserRow) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role as "admin" | "teacher" | "student",
    createdAt: row.created_at.toISOString(),
  };
}

export async function findByUsername(username: string) {
  return queryOne<UserRow>(
    "SELECT * FROM users WHERE username = $1 AND is_active = true",
    [username],
  );
}

export async function findById(id: string) {
  return queryOne<UserRow>(
    "SELECT * FROM users WHERE id = $1 AND is_active = true",
    [id],
  );
}

export async function listUsers(page: number, limit: number) {
  const offset = (page - 1) * limit;
  const [rows, countResult] = await Promise.all([
    queryMany<UserRow>(
      "SELECT * FROM users WHERE is_active = true ORDER BY created_at DESC LIMIT $1 OFFSET $2",
      [limit, offset],
    ),
    queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM users WHERE is_active = true",
    ),
  ]);
  return {
    users: rows.map(toSummary),
    total: parseInt(countResult?.count ?? "0", 10),
  };
}

export async function createUser(data: CreateUserRequest) {
  const passwordHash = await bcrypt.hash(data.password, 12);
  const row = await queryOne<UserRow>(
    `INSERT INTO users (username, display_name, password_hash, role)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [data.username, data.displayName, passwordHash, data.role ?? "student"],
  );
  return row ? toSummary(row) : null;
}

export async function bulkImport(users: BulkImportRow[], importedBy: string) {
  return transaction(async (client) => {
    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ username: string; error: string }> = [];

    for (const user of users) {
      try {
        const passwordHash = await bcrypt.hash(user.password, 12);
        await client.query(
          `INSERT INTO users (username, display_name, password_hash, role)
           VALUES ($1, $2, $3, $4)`,
          [
            user.username,
            user.displayName,
            passwordHash,
            user.role ?? "student",
          ],
        );
        successCount++;
      } catch (err: unknown) {
        errorCount++;
        const message = err instanceof Error ? err.message : "Unknown error";
        errors.push({ username: user.username, error: message });
      }
    }

    // Log the import job
    await client.query(
      `INSERT INTO bulk_import_jobs (imported_by, total_count, success_count, error_count, errors)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        importedBy,
        users.length,
        successCount,
        errorCount,
        JSON.stringify(errors),
      ],
    );

    return { totalCount: users.length, successCount, errorCount, errors };
  });
}

export async function updateProfile(userId: string, displayName: string) {
  await query("UPDATE users SET display_name = $1 WHERE id = $2", [
    displayName,
    userId,
  ]);
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<boolean> {
  const user = await findById(userId);
  if (!user) return false;

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) return false;

  const newHash = await bcrypt.hash(newPassword, 12);
  await query("UPDATE users SET password_hash = $1 WHERE id = $2", [
    newHash,
    userId,
  ]);
  return true;
}

export async function resetPassword(
  userId: string,
  newPassword: string,
  resetBy: string,
) {
  const newHash = await bcrypt.hash(newPassword, 12);
  await query("UPDATE users SET password_hash = $1 WHERE id = $2", [
    newHash,
    userId,
  ]);
  await query(
    "INSERT INTO password_reset_logs (user_id, reset_by) VALUES ($1, $2)",
    [userId, resetBy],
  );
}

export async function verifyPassword(username: string, password: string) {
  const user = await findByUsername(username);
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return null;

  return toSummary(user);
}
