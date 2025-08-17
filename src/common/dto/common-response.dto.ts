// Common response DTOs used across all modules

export interface ErrorResponseDto {
  success: false;
  message: string;
}

export interface SuccessResponseDto {
  success: true;
  message?: string;
}

export interface BaseResponseDto {
  success: boolean;
  message?: string;
}
