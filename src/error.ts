export class BadRequestError extends Error {
    constructor(message: string, public readonly details: unknown[] = []) {
        super(message);
    }
}

export class NotFoundError extends Error {}