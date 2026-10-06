import { Type, type Static } from '@sinclair/typebox';

// 業務APIの共通エラー形式（Architecture「検証コードとの差分」の案に沿う）。
// 契約違反（422）は違反した項目をすべて fields に含める。
export const ErrorBody = Type.Object(
  {
    error: Type.Object(
      {
        code: Type.String(),
        message: Type.String(),
        fields: Type.Optional(
          Type.Array(Type.Object({ path: Type.String(), message: Type.String() }, { additionalProperties: false })),
        ),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);
export type ErrorBody = Static<typeof ErrorBody>;
