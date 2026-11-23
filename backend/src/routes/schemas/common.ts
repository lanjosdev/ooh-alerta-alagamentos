import { z } from 'zod'

export function successResponseSchema<T extends z.ZodType>(data: T) {
  return z.object({
    success: z.literal(true),
    message: z.string().nullable(),
    data,
  })
}

export const errorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  data: z.null(),
})
