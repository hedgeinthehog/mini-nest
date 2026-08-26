import { IncomingMessage } from "node:http";
import { Injectable } from "../decorators/injectable.js";
import { Guard } from "../decorators/use-guards.js";

@Injectable()
export class AuthGuard implements Guard {
    canActivate(req: IncomingMessage): boolean {
        return Boolean(req.headers.authorization);
    }
}
