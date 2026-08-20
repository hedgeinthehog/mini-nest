export const IS_CONTROLLER = Symbol.for('controller:isController');
export const CONTROLLER_PATH = Symbol.for('controller:path');

export function Controller(path: string = '') {
    return function (target: any) {
        Reflect.defineMetadata(IS_CONTROLLER, true, target);
        Reflect.defineMetadata(CONTROLLER_PATH, path, target);
    }
}