import { IncomingMessage } from "node:http";
import { Injectable } from "../decorators/injectable.js";
import { Interceptor } from "../decorators/use-interceptors.js";

@Injectable()
export class LoggingInterceptor implements Interceptor {
    before(): number {
        return performance.now();
    }

    after(state: unknown, req: IncomingMessage): void {
        const startedAt = state as number;
        const durationMs = performance.now() - startedAt;
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

        console.log(`${req.method} ${url.pathname} — ${durationMs.toFixed(1)} ms`);
    }
}
