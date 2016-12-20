"use strict";
var ModuleWrapper_1 = require("./ModuleWrapper");
var callsite = require("callsite");
var CustomRequire = (function () {
    function CustomRequire(requirecallback, unrequirecallback) {
        this.called = {};
        this.attachedModules = [];
        this.requirecallback = requirecallback;
        this.unrequirecallback = unrequirecallback;
    }
    CustomRequire.prototype.require = function (id, callerModule) {
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
    };
    CustomRequire.prototype.unrequire = function (id, callerModule) {
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
    };
    CustomRequire.prototype.getCachedModule = function (id, mod) {
        var resolvedFile = ModuleWrapper_1.Module._resolveFilename(id, mod, false);
        return ModuleWrapper_1.Module._cache[resolvedFile];
    };
    CustomRequire.prototype.getCallerModule = function (filterlist) {
        var stack = callsite();
        for (var i in stack) {
            var filename = stack[i].getFileName();
            if (filename != module.filename && (!filterlist || filterlist.indexOf(filename) < 0)) {
                return this.getCachedModule(filename, module);
            }
        }
        throw new Error("Cannot find caller module");
    };
    CustomRequire.prototype.dispose = function () {
        for (var _i = 0, _a = this.attachedModules; _i < _a.length; _i++) {
            var mod = _a[_i];
            mod.__removeCustomRequire(this);
        }
        this.requirecallback = null;
        this.called = {};
        this.attachedModules = [];
    };
    return CustomRequire;
}());
exports.CustomRequire = CustomRequire;
//# sourceMappingURL=CustomRequire.js.map