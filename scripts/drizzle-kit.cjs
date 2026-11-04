const os = require("node:os");

try {
  os.userInfo();
} catch {
  const username = process.env.USERNAME || "caltrack";
  const homedir = process.env.USERPROFILE || process.cwd();
  os.userInfo = () => ({ username, uid: -1, gid: -1, shell: null, homedir });
}

require("../node_modules/drizzle-kit/bin.cjs");
