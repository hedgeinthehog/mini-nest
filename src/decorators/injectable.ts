import 'reflect-metadata';

export const INJECTABLE = Symbol.for('custom:injectable');
export const SCOPE = Symbol.for('custom:scope');

export enum ScopeEnum {
    singleton = 'singleton',
    transient = 'transient'
}

export interface InjectableOptions {
    scope?: ScopeEnum;
}

export function Injectable(options: InjectableOptions = {}) {
    const scope = options.scope ?? ScopeEnum.singleton;

    return function (target: Function) {
        Reflect.defineMetadata(INJECTABLE, true, target);
        Reflect.defineMetadata(SCOPE, scope, target);
    };
}
