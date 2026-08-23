import { ZodType } from 'zod';
import { BadRequestError } from '../error.js';

export function validateWithSchema<T>(schema: ZodType<T>, body: unknown): T {
    const result = schema.safeParse(body);

    if (!result.success) {
        const details = result.error.issues.map(issue => ({
            field: issue.path.join('.') || '(root)',
            constraints: [issue.message],
        }));

        throw new BadRequestError('Validation failed', details);
    }

    return result.data;
}
