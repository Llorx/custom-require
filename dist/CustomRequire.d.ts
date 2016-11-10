/// <reference types="node" />
export interface CustomNodeModule extends NodeModule {
    __childModules: CustomNodeModule[];
    __customRequires: CustomRequire[];
    __parentModules: CustomNodeModule[];
    __removeCustomRequire: (customRequire: CustomRequire) => CustomNodeModule[];
    __addCustomRequire: (customRequire: CustomRequire) => void;
    __invalidateCache: () => void;
    __checkInvalid: () => boolean;
    __whoRequired: () => CustomNodeModule[];
    __getChildModules: () => CustomNodeModule[];
    __invalid: boolean;
}
export declare class CustomRequire {
    callback: (module: CustomNodeModule) => void;
    unrequirecallback: (moduleList: CustomNodeModule[]) => void;
    called: string[];
    attachedModules: CustomNodeModule[];
    constructor(requirecallback: (module: CustomNodeModule) => void, unrequirecallback?: (moduleList: CustomNodeModule[]) => void);
    require(id: string, callerModule?: CustomNodeModule): any;
    unrequire(id: string | CustomNodeModule, callerModule?: CustomNodeModule, invalidateCache?: boolean): CustomNodeModule[];
    getCachedModule(id: string, mod: NodeModule): CustomNodeModule;
    getCallerModule(filterlist?: string[]): CustomNodeModule;
    dispose(): void;
}
