/// <reference types="node" />
export declare class CustomRequire {
    callback: (module: NodeModule) => void;
    called: string[];
    attachedModules: any[];
    constructor(callback: (module: NodeModule) => void);
    require(id: string): any;
    getCallerModule(): NodeModule;
    dispose(): void;
}
