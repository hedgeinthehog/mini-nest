import { Injectable } from "../decorators/injectable.js";

export interface User {
    id: string;
    email: string;
}

@Injectable()
export class UserService {
    private readonly users = new Map<string, User>();

    findOne(id: string): User | undefined {
        return this.users.get(id);
    }

    findAll(limit?: number): User[] {
        const all = [...this.users.values()];

        return typeof limit === 'number' && !Number.isNaN(limit)
            ? all.slice(0, limit)
            : all;
    }

    create(data: Omit<User, 'id'>): User {
        const id = String(this.users.size + 1);
        const user: User = { id, ...data };

        this.users.set(id, user);

        return user;
    }
}
