"use strict";
exports.Module = require("module");
if (!exports.Module.__customCache) {
    exports.Module.__customCache = {};
    exports.Module.prototype.__require = exports.Module.prototype.require;
}
exports.Module.prototype.__initialize = function () {
    if (!this.__customRequires) {
        this.__customRequires = [];
        this.__childModules = {};
        this.__parentModules = {};
    }
};
exports.Module.prototype.__getCustomRequires = function (getAll, cyclicCheck) {
    var list = this.__customRequires.slice();
    if (!cyclicCheck) {
        cyclicCheck = {};
    }
    cyclicCheck[this.filename] = true;
    if (this.__customRequires.length == 0 || getAll) {
        for (var parentModule in this.__parentModules) {
            var cModule = exports.Module._cache[parentModule];
            if (!cyclicCheck[cModule.filename]) {
                list = list.concat(cModule.__getCustomRequires(getAll, cyclicCheck));
            }
        }
    }
    return list;
};
exports.Module.prototype.__cleanCalled = function (customRequire, cyclicCheck) {
    var list = [];
    if (!cyclicCheck) {
        cyclicCheck = {};
    }
    cyclicCheck[this.filename] = true;
    var cRequires = this.__getCustomRequires();
    if (cRequires.indexOf(customRequire) < 0) {
        delete customRequire.called[this.filename];
        list.push(this);
        for (var childModule in this.__childModules) {
            var cModule = exports.Module._cache[childModule];
            if (!cyclicCheck[cModule.filename]) {
                list = list.concat(cModule.__cleanCalled(customRequire, cyclicCheck));
            }
        }
    }
    return list;
};
exports.Module.prototype.__removeCustomRequire = function (customRequire) {
    if (this.__customRequires.indexOf(customRequire) > -1) {
        this.__customRequires.splice(this.__customRequires.indexOf(customRequire), 1);
        customRequire.attachedModules.splice(customRequire.attachedModules.indexOf(this), 1);
        return this.__cleanCalled(customRequire);
    }
    return [];
};
exports.Module.prototype.__isInvalid = function (cyclicCheck) {
    if (this.__invalid) {
        return true;
    }
    if (!cyclicCheck) {
        cyclicCheck = {};
    }
    cyclicCheck[this.filename] = true;
    for (var childModule in this.__childModules) {
        var cModule = exports.Module._cache[childModule];
        if (cModule.__customRequires.length == 0 && !cyclicCheck[cModule.filename] && cModule.__isInvalid(cyclicCheck)) {
            return true;
        }
    }
    return false;
};
exports.Module.prototype.__invalidate = function (cyclicCheck) {
    if (!cyclicCheck) {
        cyclicCheck = {};
    }
    var list = [];
    cyclicCheck[this.filename] = true;
    this.__invalid = true;
    if (this.__customRequires.length == 0) {
        for (var parentModule in this.__parentModules) {
            var pModule = exports.Module._cache[parentModule];
            if (!cyclicCheck[pModule.filename]) {
                list = list.concat(pModule.__invalidate(cyclicCheck));
            }
        }
    }
    else {
        list.push(this);
    }
    return list;
};
exports.Module.prototype.__addCustomRequire = function (customRequire) {
    if (this.__customRequires.indexOf(customRequire) < 0) {
        this.__customRequires.push(customRequire);
        customRequire.attachedModules.push(this);
    }
    this.__callChildRequires(customRequire);
};
exports.Module.prototype.__callChildRequires = function (customRequire) {
    if (this.__customRequires.length > 0 && this.__customRequires.indexOf(customRequire) < 0) {
        return;
    }
    if (customRequire.requirecallback && !customRequire.called[this.filename]) {
        customRequire.called[this.filename] = true;
        customRequire.requirecallback(this);
        for (var childModule in this.__childModules) {
            var cModule = exports.Module._cache[childModule];
            cModule.__callChildRequires(customRequire);
        }
    }
};
exports.Module.prototype.__addChildModule = function (filename) {
    if (!this.__childModules[filename]) {
        this.__childModules[filename] = true;
        return true;
    }
    return false;
};
exports.Module.prototype.__removeChildModule = function (mod) {
    delete this.__childModules[mod.filename];
};
exports.Module.prototype.__addParentModule = function (filename) {
    if (!this.__parentModules[filename]) {
        this.__parentModules[filename] = true;
        return true;
    }
    return false;
};
exports.Module.prototype.__callRequires = function (mod) {
    var calllist = this.__customRequires.slice();
    for (var _i = 0, calllist_1 = calllist; _i < calllist_1.length; _i++) {
        var call = calllist_1[_i];
        mod.__callChildRequires(call);
    }
};
exports.Module.prototype.__callParentRequires = function (mod, cyclicCheck) {
    this.__callRequires(mod);
    if (!cyclicCheck) {
        cyclicCheck = {};
    }
    else if (this.__customRequires.length > 0) {
        return;
    }
    cyclicCheck[this.filename] = true;
    for (var parentModule in this.__parentModules) {
        if (!cyclicCheck[parentModule]) {
            var pModule = exports.Module._cache[parentModule];
            pModule.__callParentRequires(mod, cyclicCheck);
        }
    }
};
exports.Module.prototype.__deleteCache = function () {
    delete exports.Module._cache[this.filename];
    if (this.parent && this.parent.children.indexOf(this) > -1) {
        this.parent.children.splice(this.parent.children.indexOf(this), 1);
    }
    delete this.parent;
};
exports.Module.prototype.require = function (path) {
    var _this = this;
    this.__initialize();
    var requiredFilename = exports.Module._resolveFilename(path, this, false);
    var oldCachedModule = exports.Module._cache[requiredFilename];
    if (oldCachedModule && oldCachedModule.__isInvalid()) {
        oldCachedModule.__deleteCache();
        this.__removeChildModule(oldCachedModule);
    }
    var res;
    var error = false;
    (function () {
        try {
            res = _this.__require(path);
        }
        catch (e) {
            error = e;
            if (!oldCachedModule) {
                throw e;
            }
        }
    })();
    if (error) {
        exports.Module._cache[requiredFilename] = oldCachedModule;
        res = oldCachedModule.exports;
    }
    var newCachedModule = exports.Module._cache[requiredFilename];
    if (newCachedModule) {
        newCachedModule.__initialize();
        if (this.__addChildModule(newCachedModule.filename)) {
            newCachedModule.__addParentModule(this.filename);
            this.__callParentRequires(newCachedModule);
        }
    }
    return res;
};
//# sourceMappingURL=ModuleWrapper.js.map