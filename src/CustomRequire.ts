import { Module, CustomNodeModule } from "./ModuleWrapper";

export { CustomNodeModule} ;

var callsite = require("callsite");

export class CustomRequire {
    requirecallback:(module:CustomNodeModule)=>void;
    unrequirecallback:(moduleList:CustomNodeModule[])=>void;
    called:{[filename:string]:boolean} = {};
    attachedModules:CustomNodeModule[] = [];
    constructor(requirecallback:(module:CustomNodeModule)=>void, unrequirecallback?:(moduleList:CustomNodeModule[])=>void) {
        this.requirecallback = requirecallback;
        this.unrequirecallback = unrequirecallback;
    }
    require(id:string, callerModule?:CustomNodeModule) {
        if (!this.requirecallback) {
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
    unrequire(id:string | CustomNodeModule, callerModule?:CustomNodeModule) {
        if (!callerModule) {
            callerModule = this.getCallerModule();
        }
        if (typeof id == "string") {
            id = this.getCachedModule(id, callerModule);
        }
        var list = id.__removeCustomRequire(this);
        if (list.length > 0) {
            this.unrequirecallback(list);
        }
    }
    getCachedModule(id:string, mod:CustomNodeModule|NodeModule):CustomNodeModule {
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
        this.requirecallback = null;
        this.called = {};
        this.attachedModules = [];
    }
}