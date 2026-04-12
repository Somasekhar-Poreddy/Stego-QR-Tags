import { createHash } from "crypto";

export function getMaskedIP(ip: string): string {
  if (!ip || ip === "::1" || ip === "127.0.0.1") return "localhost";

  if (ip.includes(":")) {
    const groups = ip.split(":");
    if (groups.length >= 4) {
      return groups.slice(0, 4).join(":") + ":xxxx:xxxx:xxxx:xxxx";
    }
    return ip;
  }

  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.xxx.xxx`;
  }
  return ip;
}

export function getHashedIP(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}
