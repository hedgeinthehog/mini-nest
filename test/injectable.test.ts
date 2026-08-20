import { expect } from "vitest";

import {INJECTABLE, Injectable, SCOPE} from "../src/decorators/injectable.js";
import { ScopeEnum } from "../src/decorators/injectable.js";

@Injectable()
class UserService {}

@Injectable({scope: ScopeEnum.transient})
class UserServiceTransient {}

describe('Injectable', () => {
    test('metadata must contain scope and injectable flag', () => {

        expect(Reflect.getMetadata(INJECTABLE, UserService))
            .toBe(true);
        expect(Reflect.getMetadata(SCOPE, UserService))
            .toBe(ScopeEnum.singleton);

        expect(Reflect.getMetadata(SCOPE, UserServiceTransient))
            .toBe(ScopeEnum.transient);
    })
});
