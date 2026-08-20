import 'reflect-metadata';

export const INJECT_TOKENS = Symbol.for('custom:inject_tokens');

export function Inject(token: string | symbol) {
    return function(target: any, _propertyKey: string | symbol | undefined, parameterIndex: number) {
        const params = Reflect.getOwnMetadata(INJECT_TOKENS, target) ?? new Map();

        params.set(parameterIndex, token);

        Reflect.defineMetadata(
            INJECT_TOKENS,
            params,
            target,
        );
    }
}
