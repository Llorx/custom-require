/// <reference types="node" />
import { CustomNodeModule } from "./ModuleWrapper";
export { CustomNodeModule };
export declare class CustomRequire {
    requirecallback: (module: CustomNodeModule) => void;
    unrequirecallback: (moduleList: CustomNodeModule[]) => void;
    called: {
        [filename: string]: boolean;
    };
    attachedModules: CustomNodeModule[];
    constructor(requirecallback: (module: CustomNodeModule) => void, unrequirecallback?: (moduleList: CustomNodeModule[]) => void);
    require(id: string, callerModule?: CustomNodeModule): any;
    unrequire(id: string | CustomNodeModule, callerModule?: CustomNodeModule): void;
    getCachedModule(id: string, mod: CustomNodeModule | NodeModule): CustomNodeModule;
    getCallerModule(filterlist?: string[]): CustomNodeModule;
    dispose(): void;
}
