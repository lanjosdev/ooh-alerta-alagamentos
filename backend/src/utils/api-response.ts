export interface ApiResponse<T> {
  success: boolean
  message: string | null
  data: T | null
}

export function successResponse<T>(data: T, message: string | null = null) {
  return { success: true, message, data } as const satisfies ApiResponse<T>
}

export function errorResponse(message: string) {
  return { success: false, message, data: null } as const satisfies ApiResponse<null>
}
