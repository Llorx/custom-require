var Module = require("module");
var callsite = require("callsite");

declare global {
    interface NodeModule {
        __childModules:NodeModule[];
        __customRequires:CustomRequire[];
        __parentModules:NodeModule[];
        __removeCustomRequire:(customRequire:CustomRequire)=>NodeModule[];
        __addCustomRequire:(customRequire:CustomRequire)=>void;
        __invalidateCache:()=>void;
        __invalidate:()=>NodeModule[];
        __checkInvalid:()=>boolean;
        __whoRequired:()=>NodeModule[];
        __invalid:boolean;
    }
}

export class CustomRequire {
    callback:(module:NodeModule)=>void;
    unrequirecallback:(moduleList:NodeModule[])=>void;
    called:string[] = [];
    attachedModules:NodeModule[] = [];
    constructor(requirecallback:(module:NodeModule)=>void, unrequirecallback?:(moduleList:NodeModule[])=>void) {
        this.callback = requirecallback;
        this.unrequirecallback = unrequirecallback;
    }
    require(id:string, callerModule?:NodeModule) {
        if (!this.callback) {
            throw new Error("Callback not defined");
        }
        if (!callerModule) {
            callerModule = this.getCallerModule();
        }
        var cachedModule = this.getCachedModule(id, callerModule);
        if (cachedModule && cachedModule.__checkInvalid()) {
            cachedModule.__invalidate();
        }
        var res = callerModule.require(id);
        cachedModule = this.getCachedModule(id, callerModule);
        cachedModule.__addCustomRequire(this);
        return res;
    }
    unrequire(id:string|NodeModule, callerModule?:NodeModule) {
        if (typeof id == "string") {
            if (!callerModule) {
                callerModule = this.getCallerModule();
            }
            id = this.getCachedModule(id, callerModule);
        }
        if (this.attachedModules.indexOf(id) > -1) {
            var list = id.__removeCustomRequire(this);
            if (this.unrequirecallback) {
                this.unrequirecallback(list);
            }
        }
        return list;
    }
    getCachedModule(id:string, mod:NodeModule):NodeModule {
        var resolvedFile:string = Module._resolveFilename(id, mod, false);
        return Module._cache[resolvedFile];
    }
    getCallerModule(filterlist?:string[]):NodeModule {
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
        this.callback = null;
        this.called = [];
        this.attachedModules = [];
    }
}

if (!Module.__customCache) {
    Module.__customCache = {};
    Module.prototype.__require = Module.prototype.require;
}
Module.prototype.__invalidate = function(list?:NodeModule[]) {
    if (this.__invalid) {
        return;
    }
    if (!list) {
        list = [];
    }
    list.push(this);
    this.__invalid = true;
    if (this.__customRequires.length == 0) {
        for (let parentModule of this.__parentModules) {
            parentModule.__invalidate(list);
        }
    }
    return list;
}
Module.prototype.__cleanCalled = function(customRequire:CustomRequire, mod:NodeModule, cyclicCheck?:NodeModule[]) {
    if (!cyclicCheck) {
        cyclicCheck = [];
    }
    cyclicCheck.push(this);
    var list:NodeModule[] = [];
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
        if (cyclicCheck.indexOf(childModule) < 0) {
            list = list.concat(childModule.__cleanCalled(customRequire, mod, cyclicCheck));
        }
    }
    return list;
}
Module.prototype.__removeCustomRequire = function(customRequire:CustomRequire) {
    var list:NodeModule[] = [];
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
    if (this.__customRequires.length > 0 && this.__customRequires.indexOf(customRequire) < 0) {
        return;
    }
    if (customRequire.callback && customRequire.called.indexOf(this) < 0) {
        customRequire.called.push(this);
        customRequire.callback(this);
        for (let childModule of this.__childModules) {
            childModule.__callChildRequires(customRequire);
        }
    }
}
Module.prototype.__whoRequired = function(cyclicCheck?:NodeModule[]) {
    if (!cyclicCheck) {
        cyclicCheck = [];
    }
    cyclicCheck.push(this);
    var whoRequired:NodeModule[] = [];
    if (this.__customRequires.length > 0) {
        whoRequired.push(this);
    } else {
        for (let parentModule of this.__parentModules) {
            if (cyclicCheck.indexOf(parentModule) < 0) {
                whoRequired = whoRequired.concat(parentModule.__whoRequired(cyclicCheck));
            }
        }
    }
    return whoRequired;
}
Module.prototype.__checkInvalid = function(cyclicCheck?:NodeModule[]) {
    if (!cyclicCheck) {
        cyclicCheck = [];
    } else if (this.__customRequires.length > 0) {
        return;
    }
    cyclicCheck.push(this);
    if (!this.__childModules) {
        return;
    }
    if (this.__invalid) {
        return true;
    }
    for (let childModule of this.__childModules) {
        if (cyclicCheck.indexOf(childModule) < 0) {
            if (childModule.__checkInvalid(cyclicCheck)) {
                return true;
            }
        }
    }
    return false;
}
Module.prototype.__invalidateCache = function(cyclicCheck?:NodeModule[]) {
    this.__invalid = true;
    if (!cyclicCheck) {
        cyclicCheck = [];
    }
    cyclicCheck.push(this);
    if (this.__customRequires.length == 0) {
        for (let childModule of this.__childModules) {
            if (cyclicCheck.indexOf(childModule) < 0 && childModule.__customRequires.length == 0) {
                childModule.__invalidateCache(cyclicCheck);
            }
        }
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
Module.prototype.__callParentRequires = function(mod, cyclicCheck?:NodeModule[]) {
    this.__callRequires(mod);
    if (!cyclicCheck) {
        cyclicCheck = [];
    } else if (this.__customRequires.length > 0) {
        return;
    }
    cyclicCheck.push(this);
    for (let parentModule of this.__parentModules) {
        if (cyclicCheck.indexOf(parentModule) < 0) {
            parentModule.__callParentRequires(mod, cyclicCheck);
        }
    }
}
Module.prototype.require = function(path) {
    this.__initialize();
    var requiredFilename = Module._resolveFilename(path, this, false);
    var customCache = Module.__customCache[requiredFilename];
    var cachedModule = Module._cache[requiredFilename];
    if (cachedModule && cachedModule.__checkInvalid()) {
        cachedModule = null;
        delete Module._cache[requiredFilename];
    }
    var res;
    var error:any;
    (() => { // Try/catch inside function so V8 optimizes better
        try {
            res = this.__require(path);
        } catch (e) {
            error = e;
            if (!customCache) {
                throw e;
            }
        }
    })();
    if (!cachedModule) {
        cachedModule = Module._cache[requiredFilename];
    }
    if (error || !cachedModule || cachedModule.__checkInvalid()) {
        if (!customCache) {
            if (error) {
                throw error;
            }
        } else {
            res = customCache.exports;
            cachedModule = customCache;
            Module._cache[requiredFilename] = customCache;
        }
    } else {
        Module.__customCache[requiredFilename] = cachedModule;
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