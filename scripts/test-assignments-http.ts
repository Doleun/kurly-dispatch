import "./load-env";

async function main() {
  const base = "http://localhost:3000";

  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: process.env.ADMIN_USERNAME ?? "admin",
      password: process.env.ADMIN_PASSWORD ?? "admin123",
    }),
  });
  console.log("login", loginRes.status, await loginRes.text());

  const cookie = loginRes.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) {
    console.error("no cookie");
    return;
  }

  for (const body of [
    { centerId: 1, random: true, zoneIds: [] },
    { centerId: 1, random: false, zoneIds: [12] },
  ]) {
    const res = await fetch(`${base}/api/drivers/10/assignments`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    console.log("assignments", body, res.status, text.slice(0, 200));
  }
}

main().catch(console.error);
