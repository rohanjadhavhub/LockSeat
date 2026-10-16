export const seatsSchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: { id: { type: "string", pattern: "^[A-Za-z0-9_-]{1,64}$" } },
  },
} as const;
