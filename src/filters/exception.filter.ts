import { ServerResponse } from "node:http";
import { BadRequestError, ForbiddenError, NotFoundError } from "../error.js";
import { requestContext } from "../context/request-context.js";

export class ExceptionFilter {
    catch(error: unknown, res: ServerResponse): void {
        if (error instanceof NotFoundError) {
            this.respond(res, 404, { error: error.message });
            return;
        }

        if (error instanceof ForbiddenError) {
            this.respond(res, 403, { error: error.message });
            return;
        }

        if (error instanceof BadRequestError) {
            this.respond(res, 400, { error: error.message, details: error.details });
            return;
        }

        console.error(`[${requestContext.requestId}]`, error);
        this.respond(res, 500, { error: 'Internal Server Error' });
    }

    private respond(res: ServerResponse, statusCode: number, body: Record<string, unknown>): void {
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ...body, requestId: requestContext.requestId }));
    }
}
