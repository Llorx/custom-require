"use strict";
var Module = require("module");
var callsite = require("callsite");
var CustomRequire = (function () {
    function CustomRequire(callback) {
        this.called = [];
        this.attachedModules = [];
        this.callback = callback;
    }
    CustomRequire.prototype.require = function (id, callerModule) {
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
    };
    CustomRequire.prototype.unrequire = function (id, callerModule, invalidateCache) {
        if (!callerModule) {
            callerModule = this.getCallerModule();
        }
        var cachedModule = this.getCachedModule(id, callerModule);
        cachedModule.__removeCustomRequire(this);
        if (invalidateCache) {
            cachedModule.__invalidateCache();
        }
    };
    CustomRequire.prototype.getCachedModule = function (id, mod) {
        var resolvedFile = Module._resolveFilename(id, mod, false);
        return Module._cache[resolvedFile];
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
        this.callback = undefined;
        this.called = [];
        this.attachedModules = [];
    };
    return CustomRequire;
}());
exports.CustomRequire = CustomRequire;
Module.prototype.__require = Module.prototype.require;
Module.prototype.__cleanCalled = function (customRequire) {
    var whoRequired = this.__whoRequired();
    var found = false;
    for (var _i = 0, whoRequired_1 = whoRequired; _i < whoRequired_1.length; _i++) {
        var req = whoRequired_1[_i];
        for (var _a = 0, _b = req.__customRequires; _a < _b.length; _a++) {
            var cRequire = _b[_a];
            if (cRequire == customRequire) {
                found = true;
                break;
            }
        }
    }
    if (!found && customRequire.called.indexOf(this) > -1) {
        customRequire.called.splice(customRequire.called.indexOf(this), 1);
    }
    for (var _c = 0, _d = this.__childModules; _c < _d.length; _c++) {
        var childModule = _d[_c];
        childModule.__cleanCalled(customRequire);
    }
};
Module.prototype.__removeCustomRequire = function (customRequire) {
    if (this.__customRequires.indexOf(customRequire) > -1) {
        this.__customRequires.splice(this.__customRequires.indexOf(customRequire), 1);
        this.__cleanCalled(customRequire);
    }
};
Module.prototype.__addCustomRequire = function (customRequire) {
    if (this.__customRequires.indexOf(customRequire) < 0) {
        this.__customRequires.push(customRequire);
        customRequire.attachedModules.push(this);
    }
    this.__callChildRequires(customRequire);
};
Module.prototype.__callChildRequires = function (customRequire) {
    if (customRequire.callback && customRequire.called.indexOf(this) < 0) {
        customRequire.called.push(this);
        customRequire.callback(this);
        for (var _i = 0, _a = this.__childModules; _i < _a.length; _i++) {
            var childModule = _a[_i];
            childModule.__callChildRequires(customRequire);
        }
    }
};
Module.prototype.__whoRequired = function (cyclicCheck) {
    if (!cyclicCheck) {
        cyclicCheck = [];
    }
    cyclicCheck.push(this);
    var whoRequired = [];
    if (this.__customRequires.length > 0) {
        whoRequired.push(this);
    }
    for (var _i = 0, _a = this.__parentModules; _i < _a.length; _i++) {
        var parentModule = _a[_i];
        if (cyclicCheck.indexOf(parentModule) < 0) {
            whoRequired = whoRequired.concat(parentModule.__whoRequired(cyclicCheck));
        }
    }
    return whoRequired;
};
Module.prototype.__invalidateCache = function () {
    delete Module._cache[this.filename];
    for (var _i = 0, _a = this.__childModules; _i < _a.length; _i++) {
        var childModule = _a[_i];
        childModule.__invalidateCache();
    }
};
Module.prototype.__callRequires = function (mod) {
    var calllist = [];
    for (var _i = 0, _a = this.__customRequires; _i < _a.length; _i++) {
        var customRequire = _a[_i];
        calllist.push(customRequire);
    }
    for (var _b = 0, calllist_1 = calllist; _b < calllist_1.length; _b++) {
        var call = calllist_1[_b];
        mod.__callChildRequires(call);
    }
};
Module.prototype.__initialize = function () {
    if (!this.__childModules) {
        this.__childModules = [];
        this.__customRequires = [];
        this.__parentModules = [];
    }
};
Module.prototype.__callParentRequires = function (mod) {
    this.__callRequires(mod);
    for (var _i = 0, _a = this.__parentModules; _i < _a.length; _i++) {
        var parentModule = _a[_i];
        parentModule.__callParentRequires(mod);
    }
};
Module.prototype.require = function (path) {
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
};
//# sourceMappingURL=CustomRequire.js.map