import { describe, expect, it } from 'vitest';

import { Container } from '../src/container.js';
import { Injectable } from '../src/decorators/injectable.js';

@Injectable()
class Parent {
    value = 'parent';
}

class Child extends Parent {}

describe('Inheritance', () => {
    it('does not treat an undecorated subclass as injectable via inherited metadata', () => {
        const container = new Container();

        expect(() => container.resolve(Child)).toThrowError(/Child is not injectable/);
    });

    it('still resolves the decorated parent normally', () => {
        const container = new Container();

        const parent = container.resolve(Parent);

        expect(parent).toBeInstanceOf(Parent);
        expect(parent.value).toBe('parent');
    });
});
