import { Constructor } from "../container.js";
import { IncomingMessage, ServerResponse } from "node:http";

export const INTERCEPTORS_METADATA = Symbol.for('controller:interceptors');

export interface Interceptor {
    before(req: IncomingMessage, res: ServerResponse): unknown;
    after(state: unknown, req: IncomingMessage, res: ServerResponse): void;
}

export function UseInterceptors(...interceptors: Constructor<Interceptor>[]) {
    return function (target: any, propertyKey?: string) {
        if (propertyKey) {
            Reflect.defineMetadata(INTERCEPTORS_METADATA, interceptors, target, propertyKey);
        } else {
            Reflect.defineMetadata(INTERCEPTORS_METADATA, interceptors, target);
        }
    }
}

export function getEffectiveInterceptors(controller: Constructor, propertyKey: string): Constructor<Interceptor>[] {
    const classInterceptors: Constructor<Interceptor>[] = Reflect.getOwnMetadata(INTERCEPTORS_METADATA, controller) ?? [];
    const methodInterceptors: Constructor<Interceptor>[] = Reflect.getOwnMetadata(INTERCEPTORS_METADATA, controller.prototype, propertyKey) ?? [];

    return [...classInterceptors, ...methodInterceptors];
}