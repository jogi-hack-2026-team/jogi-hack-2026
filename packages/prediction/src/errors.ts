// Public Engine classifications distinguish causes without parsing messages.
// Paths locate input/config fields or a derived value (UNSAFE_POSTERIOR).
// They are not HTTP statuses, response codes, or a response schema.
type FieldPath = readonly (string | number)[];
type InputReason = 'INVALID_LOCAL_DATE' | 'FUTURE_LOG_DATE' | 'DUPLICATE_LOG_DATE' |
  'INVALID_QUANTITY' | 'INVALID_LOG_STATUS' | 'INVALID_LOG_AMOUNT' | 'UNSAFE_PROGRESS';
type ConfigReason = 'INVALID_INTEGER' | 'INVALID_SEED' | 'UNSUPPORTED_MODEL' | 'UNSAFE_POSTERIOR';

export class PredictionInputError extends RangeError {
  readonly reason: InputReason;
  readonly path: FieldPath;

  constructor(reason: InputReason, path: FieldPath, message: string) {
    super(message);
    this.name = 'PredictionInputError';
    this.reason = reason;
    this.path = Object.freeze([...path]);
  }
}

export class PredictionConfigError extends RangeError {
  readonly reason: ConfigReason;
  readonly path: FieldPath;

  constructor(reason: ConfigReason, path: FieldPath, message: string) {
    super(message);
    this.name = 'PredictionConfigError';
    this.reason = reason;
    this.path = Object.freeze([...path]);
  }
}
