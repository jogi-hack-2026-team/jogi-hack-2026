const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** uuidでない文字列はDBへ渡さず「存在しない」として扱う（型キャストの500を避ける）。 */
export const isGoalId = (value: string): boolean => UUID.test(value);
