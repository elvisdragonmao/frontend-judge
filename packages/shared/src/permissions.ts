import type { Role } from "./constants.js";

export const PERMISSIONS = {
  // User management
  "users:list": ["admin"],
  "users:create": ["admin"],
  "users:bulk-import": ["admin"],
  "users:reset-password": ["admin"],
  "users:delete": ["admin"],

  // Class management
  "classes:create": ["admin", "teacher"],
  "classes:update": ["admin", "teacher"],
  "classes:delete": ["admin"],
  "classes:manage-members": ["admin", "teacher"],
  "classes:view": ["admin", "teacher", "student"],

  // Assignment management
  "assignments:create": ["admin", "teacher"],
  "assignments:update": ["admin", "teacher"],
  "assignments:delete": ["admin", "teacher"],
  "assignments:view": ["admin", "teacher", "student"],

  // Submissions
  "submissions:create": ["student"],
  "submissions:view-own": ["student"],
  "submissions:view-all": ["admin", "teacher"],
  "submissions:download": ["admin", "teacher"],

  // Profile
  "profile:update": ["admin", "teacher", "student"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: Role, permission: Permission): boolean {
  const allowed = PERMISSIONS[permission];
  return (allowed as readonly string[]).includes(role);
}

export function isStaff(role: Role): boolean {
  return role === "admin" || role === "teacher";
}
