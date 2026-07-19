import * as z from 'zod'

export const renameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: 'Name is required' })
    .max(255, { error: 'Name is too long' }),
})

export type RenameInput = z.infer<typeof renameSchema>
