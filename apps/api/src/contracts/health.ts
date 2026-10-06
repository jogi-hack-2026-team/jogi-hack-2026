import { Type, type Static } from '@sinclair/typebox';

// GET /api/health の応答。DBへの往復を含めた生存確認で、認証は不要。
export const Health = Type.Object(
  {
    status: Type.Union([Type.Literal('ok'), Type.Literal('error')]),
    database: Type.Union([Type.Literal('ok'), Type.Literal('unreachable')]),
  },
  { additionalProperties: false },
);
export type Health = Static<typeof Health>;
