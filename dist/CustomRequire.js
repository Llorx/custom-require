"use strict";
var Module = require("module");
var callsite = require("callsite");
var CustomRequire = (function () {
    function CustomRequire(requirecallback, unrequirecallback) {
        this.called = [];
        this.attachedModules = [];
        this.callback = requirecallback;
        this.unrequirecallback = unrequirecallback;
    }
    CustomRequire.prototype.require = function (id, callerModule) {
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
    };
    CustomRequire.prototype.unrequire = function (id, callerModule) {
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
        this.callback = null;
        this.called = [];
        this.attachedModules = [];
    };
    return CustomRequire;
}());
exports.CustomRequire = CustomRequire;
if (!Module.__customCache) {
    Module.__customCache = {};
    Module.prototype.__require = Module.prototype.require;
}
Module.prototype.__invalidate = function (list) {
    if (this.__invalid) {
        return;
    }
    if (!list) {
        list = [];
    }
    list.push(this);
    this.__invalid = true;
    if (this.__customRequires.length == 0) {
        for (var _i = 0, _a = this.__parentModules; _i < _a.length; _i++) {
            var parentModule = _a[_i];
            parentModule.__invalidate(list);
        }
    }
    return list;
};
Module.prototype.__cleanCalled = function (customRequire, mod, cyclicCheck) {
    if (!cyclicCheck) {
        cyclicCheck = [];
    }
    cyclicCheck.push(this);
    var list = [];
    var whoRequired = this.__whoRequired();
    var clean = true;
    for (var _i = 0, whoRequired_1 = whoRequired; _i < whoRequired_1.length; _i++) {
        var req = whoRequired_1[_i];
        if (req != mod) {
            clean = false;
            break;
        }
        for (var _a = 0, _b = req.__customRequires; _a < _b.length; _a++) {
            var cRequire = _b[_a];
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
    for (var _c = 0, _d = this.__childModules; _c < _d.length; _c++) {
        var childModule = _d[_c];
        if (cyclicCheck.indexOf(childModule) < 0) {
            list = list.concat(childModule.__cleanCalled(customRequire, mod, cyclicCheck));
        }
    }
    return list;
};
Module.prototype.__removeCustomRequire = function (customRequire) {
    var list = [];
    if (this.__customRequires.indexOf(customRequire) > -1) {
        this.__customRequires.splice(this.__customRequires.indexOf(customRequire), 1);
        customRequire.attachedModules.splice(customRequire.attachedModules.indexOf(this), 1);
        list = this.__cleanCalled(customRequire, this);
    }
    return list;
};
Module.prototype.__addCustomRequire = function (customRequire) {
    if (this.__customRequires.indexOf(customRequire) < 0) {
        this.__customRequires.push(customRequire);
        customRequire.attachedModules.push(this);
    }
    this.__callChildRequires(customRequire);
};
Module.prototype.__callChildRequires = function (customRequire) {
    if (this.__customRequires.length > 0 && this.__customRequires.indexOf(customRequire) < 0) {
        return;
    }
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
    else {
        for (var _i = 0, _a = this.__parentModules; _i < _a.length; _i++) {
            var parentModule = _a[_i];
            if (cyclicCheck.indexOf(parentModule) < 0) {
                whoRequired = whoRequired.concat(parentModule.__whoRequired(cyclicCheck));
            }
        }
    }
    return whoRequired;
};
Module.prototype.__checkInvalid = function (cyclicCheck) {
    if (!cyclicCheck) {
        cyclicCheck = [];
    }
    else if (this.__customRequires.length > 0) {
        return;
    }
    cyclicCheck.push(this);
    if (!this.__childModules) {
        return;
    }
    if (this.__invalid) {
        return true;
    }
    for (var _i = 0, _a = this.__childModules; _i < _a.length; _i++) {
        var childModule = _a[_i];
        if (cyclicCheck.indexOf(childModule) < 0) {
            if (childModule.__checkInvalid(cyclicCheck)) {
                return true;
            }
        }
    }
    return false;
};
Module.prototype.__invalidateCache = function (cyclicCheck) {
    this.__invalid = true;
    if (!cyclicCheck) {
        cyclicCheck = [];
    }
    cyclicCheck.push(this);
    if (this.__customRequires.length == 0) {
        for (var _i = 0, _a = this.__childModules; _i < _a.length; _i++) {
            var childModule = _a[_i];
            if (cyclicCheck.indexOf(childModule) < 0 && childModule.__customRequires.length == 0) {
                childModule.__invalidateCache(cyclicCheck);
            }
        }
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
Module.prototype.__callParentRequires = function (mod, cyclicCheck) {
    this.__callRequires(mod);
    if (!cyclicCheck) {
        cyclicCheck = [];
    }
    else if (this.__customRequires.length > 0) {
        return;
    }
    cyclicCheck.push(this);
    for (var _i = 0, _a = this.__parentModules; _i < _a.length; _i++) {
        var parentModule = _a[_i];
        if (cyclicCheck.indexOf(parentModule) < 0) {
            parentModule.__callParentRequires(mod, cyclicCheck);
        }
    }
};
Module.prototype.require = function (path) {
    var _this = this;
    this.__initialize();
    var requiredFilename = Module._resolveFilename(path, this, false);
    var customCache = Module.__customCache[requiredFilename];
    var cachedModule = Module._cache[requiredFilename];
    if (cachedModule && cachedModule.__checkInvalid()) {
        cachedModule = null;
        delete Module._cache[requiredFilename];
    }
    var res;
    var error;
    (function () {
        try {
            res = _this.__require(path);
        }
        catch (e) {
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
        }
        else {
            res = customCache.exports;
            cachedModule = customCache;
            Module._cache[requiredFilename] = customCache;
        }
    }
    else {
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
};
//# sourceMappingURL=CustomRequire.js.map