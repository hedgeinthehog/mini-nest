import { INJECTABLE, SCOPE, ScopeEnum } from "./decorators/injectable.js";
import { INJECT_TOKENS } from "./decorators/inject.js";

export type Constructor<T = any> = new (...args: any[]) => T;
export type Token<T = any> = Constructor<T> | symbol | string;

export class Container {
    private singletons = new Map<Constructor, unknown>();
    private registeredTokens = new Map<Token, unknown>();

    register<T>(token: Token<T>, value: T): void {
        this.registeredTokens.set(token, value);
    }

    resolve<T>(Target: Token<T>, path: Set<Function> = new Set()): T {
        if (this.registeredTokens.has(Target)) {
            return this.registeredTokens.get(Target) as T;
        }

        if (typeof Target !== 'function') {
            const chain = [...path].map(item => item.name).join(' -> ');
            const requestedVia = chain ? ` (requested via ${chain})` : '';

            throw new Error(`No provider registered for token: ${String(Target)}${requestedVia}`);
        }

        if (!Reflect.getOwnMetadata(INJECTABLE, Target)) {
            throw new Error(`${Target.name} is not injectable`);
        }

        if (path.has(Target)) {
            const cycle = [...path, Target]
                .map(item => item.name)
                .join(' -> ');

            throw new Error(`Circular dependency: ${cycle}`);
        }

        const scope = Reflect.getMetadata(SCOPE, Target);

        if (
            scope === ScopeEnum.singleton &&
            this.singletons.has(Target)
        ) {
            return this.singletons.get(Target) as T;
        }

        const injectTokens = Reflect.getMetadata(INJECT_TOKENS, Target);

        const paramTypes = Reflect.getMetadata('design:paramtypes', Target) ?? [];

        const instances = paramTypes.map((paramType: Constructor, index: number) => {
            const token = injectTokens?.get(index) ?? paramType;

            return this.resolve(token, new Set(path).add(Target));
        });

        const instance = new Target(...instances);

        if (scope === ScopeEnum.singleton) {
            this.singletons.set(Target, instance);
        }

        return instance;
    }
}
