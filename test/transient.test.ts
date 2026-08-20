import { expect } from "vitest";

import { Injectable, ScopeEnum } from "../src/decorators/injectable.js";
import { Container } from "../src/container.js";

@Injectable({ scope: ScopeEnum.transient })
class X {}

describe('Transient', () => {
    test('instance of class is not reused in transient scope', () => {
        const container = new Container();

        expect(container.resolve(X) === container.resolve(X)).toBe(false);
    });
});
