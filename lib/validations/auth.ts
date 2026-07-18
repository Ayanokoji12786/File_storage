import * as z from 'zod'

export const emailSchema = z.object({
  email: z.email({ error: 'Enter a valid email address' }),
})

export const signUpSchema = z.object({
  name: z
    .string()
    .min(2, { error: 'Name must be at least 2 characters' })
    .max(60, { error: 'Name is too long' }),
  email: z.email({ error: 'Enter a valid email address' }),
})

export const otpSchema = z.object({
  token: z.string().regex(/^\d{6}$/, { error: 'Enter the 6-digit code' }),
})

export type EmailInput = z.infer<typeof emailSchema>
export type SignUpInput = z.infer<typeof signUpSchema>
export type OtpInput = z.infer<typeof otpSchema>
