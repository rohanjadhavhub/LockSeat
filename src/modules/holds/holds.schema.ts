const id = { type: "string", pattern: "^[A-Za-z0-9_-]{1,64}$" } as const;
const uuid = { type: "string", format: "uuid" } as const;

export const holdSchema = {
  params: { type: "object", required: ["id"], properties: { id } },
  body: {
    type: "object",
    required: ["seatIds", "userId"],
    additionalProperties: false,
    properties: {
      seatIds: { type: "array", items: id, minItems: 1, maxItems: 10, uniqueItems: true },
      userId: id,
    },
  },
} as const;

export const confirmSchema = {
  params: { type: "object", required: ["holdId"], properties: { holdId: uuid } },
  headers: {
    type: "object",
    required: ["idempotency-key"],
    properties: { "idempotency-key": { type: "string", minLength: 1, maxLength: 128 } },
  },
} as const;

export const releaseSchema = {
  params: { type: "object", required: ["holdId"], properties: { holdId: uuid } },
} as const;
