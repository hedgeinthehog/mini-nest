import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BadRequestError } from '../error.js';

export async function validateDto<T extends object>(
    Dto: new () => T,
    body: unknown
): Promise<T> {
    const instance = plainToInstance(Dto, body);
    const errors = await validate(instance, { whitelist: true });

    if (errors.length > 0) {
        const details = errors.map(err => ({
            field: err.property,
            constraints: Object.values(err.constraints ?? {}),
        }));

        throw new BadRequestError('Validation failed', details);
    }

    return instance;
}