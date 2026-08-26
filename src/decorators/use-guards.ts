import { Constructor } from "../container.js";
import { IncomingMessage } from "node:http";

export const GUARDS_METADATA = Symbol.for('controller:guards');

export interface Guard {
    canActivate(req: IncomingMessage): boolean;
}

export function UseGuards(...guards: Constructor<Guard>[]) {
    return function (target: any, propertyKey?: string) {
        if (propertyKey) {
            Reflect.defineMetadata(GUARDS_METADATA, guards, target, propertyKey);
        } else {
            Reflect.defineMetadata(GUARDS_METADATA, guards, target);
        }
    };
}

export function getEffectiveGuards(controller: Constructor, propertyKey: string): Constructor<Guard>[] {
    const classGuards: Constructor<Guard>[] = Reflect.getOwnMetadata(GUARDS_METADATA, controller) ?? [];
    const methodGuards: Constructor<Guard>[] = Reflect.getOwnMetadata(GUARDS_METADATA, controller.prototype, propertyKey) ?? [];

    return [...classGuards, ...methodGuards];
}
