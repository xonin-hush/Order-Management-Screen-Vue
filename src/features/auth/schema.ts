import { z } from 'zod'

/** What the sign-in form checks before calling the API. */
export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter your email address.')
    .pipe(z.email('Enter an email address like name@example.com.')),
  password: z.string().min(1, 'Enter your password.'),
})
