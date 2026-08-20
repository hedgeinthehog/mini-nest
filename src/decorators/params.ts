export const PARAMS_METADATA = Symbol.for('controller:params');
export enum paramsType {
    param = 'param',
    query = 'query',
    body = 'body'
}

export function Param(name: string) {
    return function(target: any, propertyKey: string, parameterIndex: number) {
        const params = Reflect.getOwnMetadata(PARAMS_METADATA, target, propertyKey) ?? new Map();

        params.set(parameterIndex, { type: paramsType.param, name });

        Reflect.defineMetadata(PARAMS_METADATA, params, target, propertyKey);
    }
}

export function Query(name: string) {
    return function(target: any, propertyKey: string, parameterIndex: number) {
        const params = Reflect.getOwnMetadata(PARAMS_METADATA, target, propertyKey) ?? new Map();

        params.set(parameterIndex, { type: paramsType.query, name });

        Reflect.defineMetadata(PARAMS_METADATA, params, target, propertyKey);
    }
}

export function Body() {
    return function(target: any, propertyKey: string, parameterIndex: number) {
        const params = Reflect.getOwnMetadata(PARAMS_METADATA, target, propertyKey) ?? new Map();

        params.set(parameterIndex, { type: paramsType.body });

        Reflect.defineMetadata(PARAMS_METADATA, params, target, propertyKey);
    }
}