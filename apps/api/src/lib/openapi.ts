import type { FastifySchema } from "fastify";
import { z, type ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ErrorResponse } from "@judge/shared";

type SchemaMap = Record<number, ZodTypeAny | Record<string, unknown>>;

function stripJsonSchemaMeta(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripJsonSchemaMeta);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([key]) => key !== "$schema")
    .map(([key, child]) => [key, stripJsonSchemaMeta(child)]);

  return Object.fromEntries(entries);
}

export function toJsonSchema(schema: ZodTypeAny, name?: string) {
  const jsonSchema = stripJsonSchemaMeta(
    zodToJsonSchema(schema, {
      name,
      target: "openApi3",
      $refStrategy: "none",
    }),
  ) as Record<string, unknown>;

  const definitions = jsonSchema.definitions as
    | Record<string, unknown>
    | undefined;
  if (name && definitions && name in definitions) {
    return definitions[name] as Record<string, unknown>;
  }

  return jsonSchema;
}

export function buildResponseSchemas(schemas: SchemaMap) {
  return Object.fromEntries(
    Object.entries(schemas).map(([statusCode, schema]) => [
      statusCode,
      schema instanceof z.ZodType ? toJsonSchema(schema) : schema,
    ]),
  );
}

export function withErrorResponses(
  schemas: SchemaMap,
  extraErrors: number[] = [],
): Record<number, Record<string, unknown>> {
  const response = buildResponseSchemas(schemas) as Record<
    number,
    Record<string, unknown>
  >;

  for (const statusCode of extraErrors) {
    response[statusCode] = toJsonSchema(
      ErrorResponse,
      `ErrorResponse${statusCode}`,
    );
  }

  return response;
}

export const authSecurity = [{ bearerAuth: [] }];

export function createRouteSchema(schema: FastifySchema): FastifySchema {
  return schema;
}
