const { execSync } = require("child_process");

const PORT = process.env.PORT || 3000;

function freePort(port) {
  try {
    const output = execSync(`netstat -ano | findstr :${port}`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });

    const pids = new Set();
    for (const line of output.split("\n")) {
      if (!line.includes("LISTENING")) continue;
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (/^\d+$/.test(pid)) pids.add(pid);
    }

    for (const pid of pids) {
      console.log(`[predev] port ${port} in use — stopping PID ${pid}`);
      execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
    }
  } catch {
    // nothing listening
  }
}

freePort(PORT);
