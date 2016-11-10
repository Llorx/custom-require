var Module = require("module");
var callsite = require("callsite");

export interface CustomNodeModule extends NodeModule {
    __childModules:CustomNodeModule[];
    __customRequires:CustomRequire[];
    __parentModules:CustomNodeModule[];
    __removeCustomRequire:(customRequire:CustomRequire)=>void;
    __addCustomRequire:(customRequire:CustomRequire)=>void;
    __invalidateCache:()=>void;
    __getRequired:()=>CustomNodeModule[];
}

export class CustomRequire {
    callback:(module:CustomNodeModule)=>void;
    called:string[] = [];
    attachedModules:CustomNodeModule[] = [];
    constructor(callback:(module:CustomNodeModule)=>void) {
        this.callback = callback;
    }
    require(id:string, callerModule?:CustomNodeModule) {
        if (!this.callback) {
            throw new Error("Callback not defined");
        }
        if (!callerModule) {
            callerModule = this.getCallerModule();
        }
        var res = callerModule.require(id);
        var cachedModule = this.getCachedModule(id, callerModule);
        cachedModule.__addCustomRequire(this);
        return res;
    }
    unrequire(id:string, callerModule?:CustomNodeModule, invalidateCache?:boolean) {
        if (!callerModule) {
            callerModule = this.getCallerModule();
        }
        var cachedModule = this.getCachedModule(id, callerModule);
        cachedModule.__removeCustomRequire(this);
        if (invalidateCache) {
            cachedModule.__invalidateCache();
        }
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

Module.prototype.__require = Module.prototype.require;
Module.prototype.__cleanCalled = function(customRequire:CustomRequire) {
    var whoRequired = this.__whoRequired();
    var found = false;
    for (let req of whoRequired) {
        for (let cRequire of req.__customRequires) {
            if (cRequire == customRequire) {
                found = true;
                break;
            }
        }
    }
    if (!found && customRequire.called.indexOf(this) > -1) {
        customRequire.called.splice(customRequire.called.indexOf(this), 1);
    }
    for (let childModule of this.__childModules) {
        childModule.__cleanCalled(customRequire);
    }
}
Module.prototype.__removeCustomRequire = function(customRequire:CustomRequire) {
    if (this.__customRequires.indexOf(customRequire) > -1) {
        this.__customRequires.splice(this.__customRequires.indexOf(customRequire), 1);
        this.__cleanCalled(customRequire);
    }
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
Module.prototype.__invalidateCache = function() {
    delete Module._cache[this.filename];
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
    var res = this.__require(path);
    var requiredFilename = Module._resolveFilename(path, this, false);
    var cachedModule = Module._cache[requiredFilename];
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