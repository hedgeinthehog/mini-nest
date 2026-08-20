import { expect } from "vitest";

import { Injectable } from "../src/decorators/injectable.js";
import { Container } from "../src/container.js";

@Injectable()
class C {
    value = 'C';
}

@Injectable()
class B {
    constructor(public c: C) {}
}

@Injectable()
class A {
    constructor(public b: B) {}
}

describe('Container', () => {
    it('resolves A -> B -> C recursively', () => {
        const container = new Container();

        const a = container.resolve(A);

        expect(a).toBeInstanceOf(A);
        expect(a.b).toBeInstanceOf(B);
        expect(a.b.c).toBeInstanceOf(C);
        expect(a.b.c.value).toBe('C');
    });
});
