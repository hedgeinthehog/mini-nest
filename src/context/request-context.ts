import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

interface RequestStore {
    requestId: string;
    trace: string[];
}

class RequestContext {
    private readonly als = new AsyncLocalStorage<RequestStore>();

    run<T>(incomingRequestId: string | undefined, callback: () => T): T {
        const store: RequestStore = {
            requestId: incomingRequestId ?? randomUUID(),
            trace: [],
        }

        return this.als.run(store, callback);
    }

    getStore() {
        const store = this.als.getStore();
        if (!store) {
            throw new Error('RequestContext: No request context found');
        }

        return store;
    }

    get requestId():string {
        return this.getStore().requestId;
    }

    mark(stage: string): void {
        this.getStore().trace.push(stage);
    }
}

export const requestContext = new RequestContext();



