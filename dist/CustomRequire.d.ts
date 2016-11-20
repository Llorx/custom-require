/// <reference types="node" />
declare global  {
    interface NodeModule {
        __childModules: NodeModule[];
        __customRequires: CustomRequire[];
        __parentModules: NodeModule[];
        __removeCustomRequire: (customRequire: CustomRequire) => NodeModule[];
        __addCustomRequire: (customRequire: CustomRequire) => void;
        __invalidateCache: () => void;
        __invalidate: () => NodeModule[];
        __checkInvalid: () => boolean;
        __whoRequired: () => NodeModule[];
        __invalid: boolean;
    }
}
export declare class CustomRequire {
    callback: (module: NodeModule) => void;
    unrequirecallback: (moduleList: NodeModule[]) => void;
    called: string[];
    attachedModules: NodeModule[];
    constructor(requirecallback: (module: NodeModule) => void, unrequirecallback?: (moduleList: NodeModule[]) => void);
    require(id: string, callerModule?: NodeModule): any;
    unrequire(id: string | NodeModule, callerModule?: NodeModule): NodeModule[];
    getCachedModule(id: string, mod: NodeModule): NodeModule;
    getCallerModule(filterlist?: string[]): NodeModule;
    dispose(): void;
}
export {};
