import { Injectable } from "../decorators/injectable.js";
import { requestContext } from "../context/request-context.js";

export interface User {
    id: string;
    email: string;
}

@Injectable()
export class UserService {
    private readonly users = new Map<string, User>();

    findOne(id: string): User | undefined {
        this.trace(`findOne(${id})`);

        return this.users.get(id);
    }

    findAll(limit?: number): User[] {
        this.trace(`findAll(${limit ?? ''})`);

        const all = [...this.users.values()];

        return typeof limit === 'number' && !Number.isNaN(limit)
            ? all.slice(0, limit)
            : all;
    }

    create(data: Omit<User, 'id'>): User {
        this.trace('create(...)');

        const id = String(this.users.size + 1);
        const user: User = { id, ...data };

        this.users.set(id, user);

        return user;
    }

    private trace(action: string): void {
        console.log(`[${requestContext.requestId}] UserService.${action}`);
    }
}
