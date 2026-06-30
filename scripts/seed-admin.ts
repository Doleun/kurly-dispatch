import "./load-env";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, ensureDbReady } from "../src/lib/db";
import { users } from "../src/lib/db/schema";

async function seed() {
  await ensureDbReady();
  const username = process.env.ADMIN_USERNAME ?? "admin";
  const password = process.env.ADMIN_PASSWORD ?? "admin123";

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (existing.length > 0) {
    console.log(`Admin user "${username}" already exists. Skipping.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.insert(users).values({ username, passwordHash });
  console.log(`Created admin user: ${username}`);
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
