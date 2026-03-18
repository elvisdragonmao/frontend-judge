import type { FastifyReply, FastifyRequest } from "fastify";
import type { Role } from "@judge/shared";
import { hasPermission, type Permission } from "@judge/shared";

// Extend Fastify request type
declare module "fastify" {
  interface FastifyRequest {
    userId: string;
    userRole: Role;
  }
}

/** Authenticate JWT — attach userId and userRole to request */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const decoded = await request.jwtVerify<{ sub: string; role: Role }>();
    request.userId = decoded.sub;
    request.userRole = decoded.role;
  } catch {
    reply.status(401).send({ error: "Unauthorized", statusCode: 401 });
  }
}

/** Require specific role(s) */
export function requireRole(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(request, reply);
    if (reply.sent) return;
    if (!roles.includes(request.userRole)) {
      reply.status(403).send({ error: "Forbidden", statusCode: 403 });
    }
  };
}

/** Require specific permission */
export function requirePermission(permission: Permission) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(request, reply);
    if (reply.sent) return;
    if (!hasPermission(request.userRole, permission)) {
      reply.status(403).send({ error: "Forbidden", statusCode: 403 });
    }
  };
}
