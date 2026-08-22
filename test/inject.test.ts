import { describe, expect, it } from 'vitest';

import { Container } from '../src/container.js';
import { Injectable } from '../src/decorators/injectable.js';
import { Inject } from '../src/decorators/inject.js';
import { CONFIG } from "../src/tokens.js";

@Injectable()
class Database {
    name = 'database';
}

@Injectable()
class UserService {
    constructor(
        public database: Database,
        @Inject(CONFIG) public config: any,
    ) {}
}

describe('Inject', () => {
    it('@Inject resolves dependency by token', () => {
        const container = new Container();

        const config = {
            port: 3000,
            host: 'localhost',
        };

        container.register(CONFIG, config);

        const service = container.resolve(UserService);

        expect(service).toBeInstanceOf(UserService);
        expect(service.database).toBeInstanceOf(Database);
        expect(service.config).toBe(config);
    });
});