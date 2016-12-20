/// <reference types="node" />
import { CustomRequire } from "./CustomRequire";
export declare var Module: any;
export interface CustomNodeModule extends NodeModule {
    __require: (id: string) => any;
    __initialize: () => void;
    __isInvalid: (cyclicCheck?: {
        [filename: string]: boolean;
    }) => boolean;
    __invalidate: (cyclicCheck?: {
        [filename: string]: boolean;
    }) => CustomNodeModule[];
    __childModules: {
        [filename: string]: boolean;
    };
    __parentModules: {
        [filename: string]: boolean;
    };
    __deleteCache: () => void;
    __addChildModule: (filename: string) => void;
    __removeChildModule: (mod: CustomNodeModule) => void;
    __addParentModule: (filename: string) => void;
    __callParentRequires: (mod: CustomNodeModule, cyclicCheck?: {
        [filename: string]: boolean;
    }) => void;
    __cleanCalled: (customRequire: CustomRequire, cyclicCheck?: {
        [filename: string]: boolean;
    }) => CustomNodeModule[];
    __callRequires: (mod: CustomNodeModule) => void;
    __callChildRequires: (customRequire: CustomRequire) => void;
    __removeCustomRequire: (customRequire: CustomRequire) => CustomNodeModule[];
    __addCustomRequire: (customRequire: CustomRequire) => void;
    __getCustomRequires: (getAll?: boolean, cyclicCheck?: {
        [filename: string]: boolean;
    }) => CustomRequire[];
    __customRequires: CustomRequire[];
    __invalid: boolean;
}
