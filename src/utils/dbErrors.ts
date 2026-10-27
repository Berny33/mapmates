const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';

function hasPgCode(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === code
  );
}

export function isUniqueViolation(error: unknown): boolean {
  return hasPgCode(error, UNIQUE_VIOLATION);
}

export function isForeignKeyViolation(error: unknown): boolean {
  return hasPgCode(error, FOREIGN_KEY_VIOLATION);
}
