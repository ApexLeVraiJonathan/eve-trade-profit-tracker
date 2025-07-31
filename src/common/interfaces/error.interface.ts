// Common error handling interfaces

export interface AppError extends Error {
  message: string;
  code?: string;
  statusCode?: number;
}

// Type guard to check if error is an Error instance
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

// Helper to safely get error message
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  return String(error);
}
