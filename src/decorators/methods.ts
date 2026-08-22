export const ROUTES_METADATA = Symbol.for('routes:methods');

export function Get(path: string = '', statusCode: number = 200) {
    return function(target: any, propertyKey: string) {
        const methods = [...(Reflect.getOwnMetadata(ROUTES_METADATA, target.constructor) ?? [])];

        methods.push({
            method: 'GET',
            path,
            handler: propertyKey,
            statusCode,
        })

        Reflect.defineMetadata(ROUTES_METADATA, methods, target.constructor);
    };
}

export function Post(path: string = '', statusCode: number = 201) {
    return function (target: any, propertyKey: string) {
        const methods = [...(Reflect.getOwnMetadata(ROUTES_METADATA, target.constructor) ?? [])];

        methods.push({
            method: 'POST',
            path,
            handler: propertyKey,
            statusCode,
        })

        Reflect.defineMetadata(ROUTES_METADATA, methods, target.constructor);
    }
}
