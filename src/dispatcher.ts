import { ServerResponse, IncomingMessage } from "node:http";
import { Router } from "./router.js";
import { Container } from "./container.js";
import { PARAMS_METADATA, paramsType } from "./decorators/params.js";
import { BadRequestError } from "./error.js";
import { validateDto } from "./pipes/validation.pipe.js";

export class Dispatcher {
    constructor(
        private readonly router: Router,
        private readonly container: Container
    ) {}

    private readBody(req: IncomingMessage): Promise<unknown> {
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            req.on('data', chunk => chunks.push(chunk));
            req.on('end', () => {
                const buffer =  Buffer.concat(chunks);
                try {
                    resolve(JSON.parse(buffer.toString()));
                } catch (e) {
                    reject(new BadRequestError('Invalid JSON body'));
                }
            });
            req.on('error', reject);
        });
    }

    async dispatch(
        req: IncomingMessage,
        res: ServerResponse
    ) {
        const url = new URL(
            req.url ?? '/',
            `http://${req.headers.host ?? 'localhost'}`
        )

        try {
            const { route, params } = this.router.find(req.method ?? 'GET', url.pathname);

            if (route === null) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({error: 'Not Found'}));
                return;
            }

            const handler = this.container.resolve(route.controller);

            const paramsMeta =
                Reflect.getOwnMetadata(PARAMS_METADATA, route.controller.prototype, route.handler) ?? new Map();

            const needsBody = [...paramsMeta.values()].some((p: any) => p.type === 'body');
            const body = needsBody ? await this.readBody(req) : undefined;

            const paramTypes =
                Reflect.getMetadata('design:paramtypes', route.controller.prototype, route.handler) ?? [];

            const args: any[] = [];

            for (const [index, param] of paramsMeta.entries()) {
                if (param.type === paramsType.param) args[index] = params[param.name];
                if (param.type === paramsType.query) args[index] = url.searchParams.get(param.name);
                if (param.type === paramsType.body) {
                    const Dto = paramTypes[index];
                    args[index] = (Dto && Dto !== Object)
                        ? await validateDto(Dto, body)
                        : body;
                }
            }

            const result = await handler[route.handler](...args);

            res.writeHead(route.statusCode, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
        } catch (e) {
            if (e instanceof BadRequestError) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({error: e.message, details: e.details}));
            } else {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end();
            }
        }
    }
}
