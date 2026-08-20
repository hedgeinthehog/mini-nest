import { describe, expect, it } from 'vitest';

import { Container } from '../src/container.js';
import { Injectable } from '../src/decorators/injectable.js';
import { Inject } from '../src/decorators/inject.js';

const MISSING = Symbol.for('MISSING_TOKEN');

@Injectable()
class ServiceWithMissingDep {
    constructor(@Inject(MISSING) public dep: unknown) {}
}

describe('Missing provider', () => {
    it('names the token when resolved directly', () => {
        const container = new Container();

        expect(() => container.resolve(MISSING)).toThrowError(/MISSING_TOKEN/);
    });

    it('names the requesting chain when resolved as a dependency', () => {
        const container = new Container();

        expect(() => container.resolve(ServiceWithMissingDep)).toThrowError(
            /MISSING_TOKEN.*requested via ServiceWithMissingDep/,
        );
    });
});
