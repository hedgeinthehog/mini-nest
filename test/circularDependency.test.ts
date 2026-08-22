import { describe, expect, it } from 'vitest';

import { Container } from '../src/container.js';
import { Injectable } from '../src/decorators/injectable.js';

@Injectable()
class A {
    constructor(public b: unknown) {}
}

@Injectable()
class B {
    constructor(public a: unknown) {}
}

Reflect.defineMetadata('design:paramtypes', [B], A);
Reflect.defineMetadata('design:paramtypes', [A], B);

describe('Circular dependency', () => {
    it('detects A -> B -> A', () => {
        const container = new Container();

        expect(() => container.resolve(A)).toThrowError(
            /A -> B -> A/
        );
    });
});