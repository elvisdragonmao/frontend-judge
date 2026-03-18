import bcrypt from "bcrypt";
import { pool } from "./pool.js";

async function seed() {
  console.log("Seeding database...");

  const passwordHash = await bcrypt.hash("admin123", 12);

  await pool.query(
    `INSERT INTO users (username, display_name, password_hash, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (username) DO NOTHING`,
    ["admin", "管理員", passwordHash, "admin"],
  );

  console.log("Seed completed. Default admin: admin / admin123");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
