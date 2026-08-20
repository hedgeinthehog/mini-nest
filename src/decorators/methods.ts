export const ROUTES_METADATA = Symbol.for('routes:methods');

export function Get(path: string = '') {
    return function(target: any, propertyKey: string) {
        const methods = Reflect.getMetadata(ROUTES_METADATA, target.constructor) ?? [];

        methods.push({
            method: 'GET',
            path,
            handler: propertyKey,
        })

        Reflect.defineMetadata(ROUTES_METADATA, methods, target.constructor);
    };
}

export function Post(path: string = '') {
    return function (target: any, propertyKey: string) {
        const methods = Reflect.getMetadata(ROUTES_METADATA, target.constructor) ?? [];

        methods.push({
            method: 'POST',
            path,
            handler: propertyKey,
        })

        Reflect.defineMetadata(ROUTES_METADATA, methods, target.constructor);
    }
}