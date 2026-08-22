import { expect } from "vitest";

import { Injectable } from "../src/decorators/injectable.js";
import { Container } from "../src/container.js";

@Injectable()
class X {}

describe('Singleton', () => {
    test('single instance of class is reused in singleton scope', () => {
        const container = new Container();

        expect(container.resolve(X) === container.resolve(X)).toBe(true);
    });
});
