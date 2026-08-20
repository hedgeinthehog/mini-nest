import { describe, expect, it } from 'vitest';

import { Container } from '../src/container.js';
import { Injectable } from '../src/decorators/injectable.js';

@Injectable()
class Database {
    query(): string {
        return 'real';
    }
}

@Injectable()
class UserRepo {
    constructor(public db: Database) {}
}

describe('register() override for class tokens', () => {
    it('injects the registered mock instead of constructing the real class', () => {
        const container = new Container();
        const mockDb = { query: () => 'mock' } as Database;

        container.register(Database, mockDb);

        const repo = container.resolve(UserRepo);

        expect(repo.db).toBe(mockDb);
        expect(repo.db.query()).toBe('mock');
    });
});
