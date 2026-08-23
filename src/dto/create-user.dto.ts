import { z } from 'zod';

export const CreateUserSchema = z.object({
    email: z.string().email(),
});

export type CreateUserDto = z.infer<typeof CreateUserSchema>;
