var Module = require("module");
var callsite = require("callsite");

export interface CustomNodeModule extends NodeModule {
    __childModules:CustomNodeModule[];
    __customRequires:CustomRequire[];
    __parentModules:CustomNodeModule[];
    __removeCustomRequire:(customRequire:CustomRequire)=>CustomNodeModule[];
    __addCustomRequire:(customRequire:CustomRequire)=>void;
    __invalidateCache:()=>void;
    __checkInvalid:()=>boolean;
    __whoRequired:()=>CustomNodeModule[];
    __getChildModules:()=>CustomNodeModule[];
    __invalid:boolean;
}

export class CustomRequire {
    callback:(module:CustomNodeModule)=>void;
    unrequirecallback:(moduleList:CustomNodeModule[])=>void;
    called:string[] = [];
    attachedModules:CustomNodeModule[] = [];
    constructor(requirecallback:(module:CustomNodeModule)=>void, unrequirecallback?:(moduleList:CustomNodeModule[])=>void) {
        this.callback = requirecallback;
        this.unrequirecallback = unrequirecallback;
    }
    require(id:string, callerModule?:CustomNodeModule) {
        if (!this.callback) {
            throw new Error("Callback not defined");
        }
        if (!callerModule) {
            callerModule = this.getCallerModule();
        }
        var cachedModule = this.getCachedModule(id, callerModule);
        if (cachedModule && cachedModule.__checkInvalid()) {
            this.unrequire(cachedModule, undefined, true);
        }
        var res = callerModule.require(id);
        cachedModule = this.getCachedModule(id, callerModule);
        cachedModule.__addCustomRequire(this);
        return res;
    }
    unrequire(id:string|CustomNodeModule, callerModule?:CustomNodeModule, invalidateCache?:boolean) {
        if (typeof id == "string") {
            if (!callerModule) {
                callerModule = this.getCallerModule();
            }
            id = this.getCachedModule(id, callerModule);
        }
        var list = id.__removeCustomRequire(this);
        if (invalidateCache) {
            id.__invalidateCache();
        }
        if (this.unrequirecallback) {
            this.unrequirecallback(list);
        }
        return list;
    }
    getCachedModule(id:string, mod:NodeModule):CustomNodeModule {
        var resolvedFile:string = Module._resolveFilename(id, mod, false);
        return Module._cache[resolvedFile];
    }
    getCallerModule(filterlist?:string[]):CustomNodeModule {
        var stack = callsite();
        for (var i in stack) {
            var filename = stack[i].getFileName();
            if (filename != module.filename && (!filterlist || filterlist.indexOf(filename) < 0)) {
                return this.getCachedModule(filename, module);
            }
        }
        throw new Error("Cannot find caller module");
    }
    dispose() {
        for(let mod of this.attachedModules) {
            mod.__removeCustomRequire(this);
        }
        this.callback = undefined;
        this.called = [];
        this.attachedModules = [];
    }
}

Module.__customCache = {};
Module.prototype.__require = Module.prototype.require;
Module.prototype.__getChildModules = function() {
    var list = [];
    for (let childModule of this.__childModules) {
        list = list.concat(childModule.__getChildModules());
    }
    return list;
}
Module.prototype.__cleanCalled = function(customRequire:CustomRequire, mod:CustomNodeModule) {
    var list:CustomNodeModule[] = [];
    var whoRequired = this.__whoRequired();
    var clean = true;
    for (let req of whoRequired) {
        if (req != mod) {
            clean = false;
            break;
        }
        for (let cRequire of req.__customRequires) {
            if (cRequire != customRequire) {
                clean = false;
                break;
            }
        }
    }
    if (clean && customRequire.called.indexOf(this) > -1) {
        customRequire.called.splice(customRequire.called.indexOf(this), 1);
        list.push(this);
    }
    for (let childModule of this.__childModules) {
        list = list.concat(childModule.__cleanCalled(customRequire, mod));
    }
    return list;
}
Module.prototype.__removeCustomRequire = function(customRequire:CustomRequire) {
    var list:CustomNodeModule[] = [];
    if (this.__customRequires.indexOf(customRequire) > -1) {
        this.__customRequires.splice(this.__customRequires.indexOf(customRequire), 1);
        customRequire.attachedModules.splice(customRequire.attachedModules.indexOf(this), 1);
        list = this.__cleanCalled(customRequire, this);
    }
    return list;
}
Module.prototype.__addCustomRequire = function(customRequire:CustomRequire) {
    if (this.__customRequires.indexOf(customRequire) < 0) {
        this.__customRequires.push(customRequire);
        customRequire.attachedModules.push(this);
    }
    this.__callChildRequires(customRequire);
}
Module.prototype.__callChildRequires = function(customRequire:CustomRequire) {
    if (customRequire.callback && customRequire.called.indexOf(this) < 0) {
        customRequire.called.push(this);
        customRequire.callback(this);
        for (let childModule of this.__childModules) {
            childModule.__callChildRequires(customRequire);
        }
    }
}
Module.prototype.__whoRequired = function(cyclicCheck?:CustomNodeModule[]) {
    if (!cyclicCheck) {
        cyclicCheck = [];
    }
    cyclicCheck.push(this);
    var whoRequired:CustomNodeModule[] = [];
    if (this.__customRequires.length > 0) {
        whoRequired.push(this);
    }
    for (let parentModule of this.__parentModules) {
        if (cyclicCheck.indexOf(parentModule) < 0) {
            whoRequired = whoRequired.concat(parentModule.__whoRequired(cyclicCheck));
        }
    }
    return whoRequired;
}
Module.prototype.__checkInvalid = function() {
    if (this.__invalid) {
        return true;
    }
    for (let childModule of this.__childModules) {
        if (childModule.__checkInvalid()) {
            return true;
        }
    }
    return false;
}
Module.prototype.__invalidateCache = function() {
    this.__invalid = true;
    for (let childModule of this.__childModules) {
        childModule.__invalidateCache();
    }
}
Module.prototype.__callRequires = function(mod) {
    var calllist = [];
    for (let customRequire of this.__customRequires) {
        calllist.push(customRequire);
    }
    for (let call of calllist) {
        mod.__callChildRequires(call);
    }
}
Module.prototype.__initialize = function() {
    if (!this.__childModules) {
        this.__childModules = [];
        this.__customRequires = [];
        this.__parentModules = [];
    }
}
Module.prototype.__callParentRequires = function(mod) {
    this.__callRequires(mod);
    for (let parentModule of this.__parentModules) {
        parentModule.__callParentRequires(mod);
    }
}
Module.prototype.require = function(path) {
    this.__initialize();
    var requiredFilename = Module._resolveFilename(path, this, false);
    var customCache = Module.__customCache[requiredFilename];
    var cachedModule = Module._cache[requiredFilename];
    if (cachedModule && cachedModule.__invalid) {
        delete Module._cache[requiredFilename];
    }
    var res;
    (() => { // Try/catch inside function so V8 optimizes better
        try {
            res = this.__require(path);
        } catch (e) {
            if (!customCache) {
                throw e;
            }
            res = customCache.exports;
            Module._cache[requiredFilename] = customCache;
        }
    })();
    if (!cachedModule || cachedModule.__invalid) {
        cachedModule = Module._cache[requiredFilename];
    }
    if (cachedModule && !cachedModule.__invalid) {
        Module.__customCache[requiredFilename] = cachedModule;
    } else {
        cachedModule = customCache;
    }
    if (cachedModule && this.__childModules.indexOf(cachedModule) < 0) {
        for (var i = 0; i < this.__childModules.length; i++) {
            var mod = this.__childModules[i];
            if (mod.filename == cachedModule.filename) {
                this.__childModules.splice(i, 1);
                i--;
                mod.__parentModules.splice(mod.__parentModules.indexOf(this), 1);
            }
        }
        cachedModule.__initialize();
        this.__childModules.push(cachedModule);
        cachedModule.__parentModules.push(this);
        this.__callParentRequires(cachedModule);
    }
    return res;
}