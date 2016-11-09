/// <reference types="node" />
declare class CustomRequire {
    callback: (module: NodeModule) => void;
    called: string[];
    constructor(callback: (module: NodeModule) => void);
    require(id: string): any;
}
export = CustomRequire;
