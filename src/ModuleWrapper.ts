import { CustomRequire } from "./CustomRequire";

export var Module = require("module");

//declare global {
    export interface CustomNodeModule extends NodeModule {
        __require:(id:string)=>any;
        __initialize:()=>void;
        __isInvalid:(cyclicCheck?:{[filename:string]:boolean})=>boolean;
        __invalidate:(cyclicCheck?:{[filename:string]:boolean})=>CustomNodeModule[];
        __childModules:{[filename:string]:boolean};
        __parentModules:{[filename:string]:boolean};
        __deleteCache:()=>void;
        __addChildModule:(filename:string)=>void;
        __removeChildModule:(mod:CustomNodeModule)=>void;
        __addParentModule:(filename:string)=>void;
        __callParentRequires:(mod:CustomNodeModule, cyclicCheck?:{[filename:string]:boolean})=>void;
        __cleanCalled:(customRequire:CustomRequire, cyclicCheck?:{[filename:string]:boolean})=>CustomNodeModule[];
        __callRequires:(mod:CustomNodeModule)=>void;
        __callChildRequires:(customRequire:CustomRequire)=>void;
        __removeCustomRequire:(customRequire:CustomRequire)=>CustomNodeModule[];
        __addCustomRequire:(customRequire:CustomRequire)=>void;
        __getCustomRequires:(getAll?:boolean, cyclicCheck?:{[filename:string]:boolean})=>CustomRequire[];
        __customRequires:CustomRequire[];
        __invalid:boolean;
    }
//}

if (!Module.__customCache) {
    Module.__customCache = {};
    Module.prototype.__require = Module.prototype.require;
}
/* Initializes the module variables */
Module.prototype.__initialize = function(this:CustomNodeModule) {
    if (!this.__customRequires) {
        this.__customRequires = [];
        this.__childModules = {};
        this.__parentModules = {};
    }
};
/* Get direct or all CustomRequires */
Module.prototype.__getCustomRequires = function(this:CustomNodeModule, getAll?:boolean, cyclicCheck?:{[filename:string]:boolean}) {
    var list:CustomRequire[] = this.__customRequires.slice();
    if (!cyclicCheck) {
        cyclicCheck = {};
    }
    cyclicCheck[this.filename] = true;
    if (this.__customRequires.length == 0 || getAll) {
        for (let parentModule in this.__parentModules) {
            let cModule:CustomNodeModule = Module._cache[parentModule];
            if (!cyclicCheck[cModule.filename]) {
                list = list.concat(cModule.__getCustomRequires(getAll, cyclicCheck));
            }
        }
    }
    return list;
};
/* Removes the called child modules from the CustomRequire so they are called again in a new require */
Module.prototype.__cleanCalled = function(this:CustomNodeModule, customRequire:CustomRequire, cyclicCheck?:{[filename:string]:boolean}) {
    var list:CustomNodeModule[] = [];
    if (!cyclicCheck) {
        cyclicCheck = {};
    }
    cyclicCheck[this.filename] = true;
    var cRequires = this.__getCustomRequires();
    if (cRequires.indexOf(customRequire) < 0) {
        delete customRequire.called[this.filename];
        list.push(this);
        for (let childModule in this.__childModules) {
            let cModule:CustomNodeModule = Module._cache[childModule];
            if (!cyclicCheck[cModule.filename]) {
                list = list.concat(cModule.__cleanCalled(customRequire, cyclicCheck));
            }
        }
    }
    return list;
}
/* Removes the attached CustomRequire from this module */
Module.prototype.__removeCustomRequire = function(this:CustomNodeModule, customRequire:CustomRequire) {
    if (this.__customRequires.indexOf(customRequire) > -1) {
        this.__customRequires.splice(this.__customRequires.indexOf(customRequire), 1);
        customRequire.attachedModules.splice(customRequire.attachedModules.indexOf(this), 1);
        /* Cleans the called modules */
        return this.__cleanCalled(customRequire);
    }
    return [];
}
/* Checks if the module or any of his children, until a CustomRequire is found, are invalid */
Module.prototype.__isInvalid = function(this:CustomNodeModule, cyclicCheck?:{[filename:string]:boolean}) {
    if (this.__invalid) {
        return true;
    }
    if (!cyclicCheck) {
        cyclicCheck = {};
    }
    cyclicCheck[this.filename] = true;
    for (let childModule in this.__childModules) {
        let cModule:CustomNodeModule = Module._cache[childModule];
        if (cModule.__customRequires.length == 0 && !cyclicCheck[cModule.filename] && cModule.__isInvalid(cyclicCheck)) {
            return true;
        }
    }
    return false;
}
/* Invalidate the module and all parents until a CustomRequire is found */
Module.prototype.__invalidate = function(this:CustomNodeModule, cyclicCheck?:{[filename:string]:boolean}) {
    if (!cyclicCheck) {
        cyclicCheck = {};
    }
    var list:CustomNodeModule[] = [];
    cyclicCheck[this.filename] = true;
    this.__invalid = true;
    if (this.__customRequires.length == 0) {
        for (let parentModule in this.__parentModules) {
            let pModule:CustomNodeModule = Module._cache[parentModule];
            if (!cyclicCheck[pModule.filename]) {
                list = list.concat(pModule.__invalidate(cyclicCheck));
            }
        }
    } else {
        list.push(this);
    }
    return list;
}
/* Attaches a CustomRequire to this module */
Module.prototype.__addCustomRequire = function(this:CustomNodeModule, customRequire:CustomRequire) {
    if (this.__customRequires.indexOf(customRequire) < 0) {
        this.__customRequires.push(customRequire);
        customRequire.attachedModules.push(this);
    }
    /* Call the module and child modules to the added CustomRequire callback */
    this.__callChildRequires(customRequire);
}
/* Calls the argument CustomRequire callback for this module and all this module children */
Module.prototype.__callChildRequires = function(this:CustomNodeModule, customRequire:CustomRequire) {
    /* If finds another CustomRequire, stops */
    if (this.__customRequires.length > 0 && this.__customRequires.indexOf(customRequire) < 0) {
        return;
    }
    if (customRequire.requirecallback && !customRequire.called[this.filename]) {
        customRequire.called[this.filename] = true;
        customRequire.requirecallback(this);
        for (let childModule in this.__childModules) {
            let cModule:CustomNodeModule = Module._cache[childModule];
            cModule.__callChildRequires(customRequire);
        }
    }
}
/* Appends a child module to this module */
Module.prototype.__addChildModule = function(this:CustomNodeModule, filename:string) {
    if (!this.__childModules[filename]) {
        this.__childModules[filename] = true;
        return true;
    }
    return false;
}
/* Appends a child module to this module */
Module.prototype.__removeChildModule = function(this:CustomNodeModule, mod:CustomNodeModule) {
    delete this.__childModules[mod.filename];
}
/* Appends a parent module to this module */
Module.prototype.__addParentModule = function(this:CustomNodeModule, filename:string) {
    if (!this.__parentModules[filename]) {
        this.__parentModules[filename] = true;
        return true;
    }
    return false;
}
/* Calls all CustomRequires callbacks inside this module with the module passed as argument */
Module.prototype.__callRequires = function(this:CustomNodeModule, mod:CustomNodeModule) {
    var calllist:CustomRequire[] = this.__customRequires.slice();
    for (let call of calllist) {
        /* Calls all this module files and child files */
        mod.__callChildRequires(call);
    }
}
/* Calls all CustomRequires and parent CustomRequires callbacks with the module (and children) passed as argument */
Module.prototype.__callParentRequires = function(this:CustomNodeModule, mod:CustomNodeModule, cyclicCheck?:{[filename:string]:boolean}) {
    this.__callRequires(mod);
    if (!cyclicCheck) {
        cyclicCheck = {};
    } else if (this.__customRequires.length > 0) { // If finds a CustomRequire attached to this NodeModule, stops calling the parents
        return;
    }
    cyclicCheck[this.filename] = true;
    for (let parentModule in this.__parentModules) {
        if (!cyclicCheck[parentModule]) {
            let pModule:CustomNodeModule = Module._cache[parentModule];
            pModule.__callParentRequires(mod, cyclicCheck);
        }
    }
}
Module.prototype.__deleteCache = function(this:CustomNodeModule) {
    delete Module._cache[this.filename];
    if (this.parent && this.parent.children.indexOf(this) > -1) {
        this.parent.children.splice(this.parent.children.indexOf(this), 1);
    }
    delete this.parent;
};
/* Custom require */
Module.prototype.require = function(this:CustomNodeModule, path:string) {
    // TODO: Cuando se hace require a un módulo invalidado, se elimina ese módulo del children.
    this.__initialize();
    var requiredFilename:string = Module._resolveFilename(path, this, false);
    var oldCachedModule:CustomNodeModule = Module._cache[requiredFilename];
    if (oldCachedModule && oldCachedModule.__isInvalid()) {
        // If the module is invalid, delete its cache and module references
        oldCachedModule.__deleteCache();
        this.__removeChildModule(oldCachedModule);
    }
    var res;
    var error:any = false;
    (() => { // Try/catch inside function so V8 optimizes better
        try {
            res = this.__require(path);
        } catch (e) {
            error = e;
            if (!oldCachedModule) {
                throw e;
            }
        }
    })();
    if (error) {
        Module._cache[requiredFilename] = oldCachedModule;
        res = oldCachedModule.exports;
    }
    var newCachedModule = Module._cache[requiredFilename];
    if (newCachedModule) {
        newCachedModule.__initialize();
        if (this.__addChildModule(newCachedModule.filename)) {
            newCachedModule.__addParentModule(this.filename);
            /* This module has a new child. Call all CustomRequires from this module and all parents until a CustomRequire is found */
            this.__callParentRequires(newCachedModule);
        }
    }
    return res;
}