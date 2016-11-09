"use strict";
var Module = require("module");
var callsite = require("callsite");
var CustomRequire = (function () {
    function CustomRequire(callback) {
        this.called = [];
        this.attachedModules = [];
        this.callback = callback;
    }
    CustomRequire.prototype.require = function (id) {
        if (!this.callback) {
            throw new Error("Callback not defined");
        }
        var callerModule = this.getCallerModule();
        var requiredFilename = Module._resolveFilename(id, callerModule, false);
        var res = callerModule.require(id);
        var cachedModule = Module._cache[requiredFilename];
        cachedModule.__addCustomRequire(this);
        return res;
    };
    CustomRequire.prototype.getCallerModule = function () {
        var stack = callsite();
        for (var i in stack) {
            var filename = stack[i].getFileName();
            if (filename !== module.filename) {
                var resolvedFile = Module._resolveFilename(filename, module, false);
                return Module._cache[resolvedFile];
            }
        }
        throw new Error("Cannot find parent module");
    };
    CustomRequire.prototype.dispose = function () {
        for (var i = 0; i < this.attachedModules.length; i++) {
            this.attachedModules[i].__removeCustomRequire(this);
        }
        this.callback = undefined;
        this.called = [];
        this.attachedModules = [];
    };
    return CustomRequire;
}());
exports.CustomRequire = CustomRequire;
Module.prototype.__require = Module.prototype.require;
Module.prototype.__removeCustomRequire = function (customRequire) {
    if (this.__customRequires.indexOf(customRequire) > -1) {
        this.__customRequires.splice(this.__customRequires.indexOf(customRequire), 1);
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
        for (var i = 0; i < this.__childModules.length; i++) {
            var childModule = this.__childModules[i];
            childModule.__callChildRequires(customRequire);
        }
    }
};
Module.prototype.__callRequires = function (mod) {
    var calllist = [];
    for (var i = 0; i < this.__customRequires.length; i++) {
        calllist.push(this.__customRequires[i]);
    }
    for (var i = 0; i < calllist.length; i++) {
        mod.__callChildRequires(calllist[i]);
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
    for (var i = 0; i < this.__parentModules.length; i++) {
        var parentModule = this.__parentModules[i];
        parentModule.__callParentRequires(mod);
    }
};
Module.prototype.require = function (path) {
    this.__initialize();
    var requiredFilename = Module._resolveFilename(path, this, false);
    var res = this.__require(path);
    var cachedModule = Module._cache[requiredFilename];
    if (cachedModule && this.__childModules.indexOf(cachedModule) < 0) {
        cachedModule.__initialize();
        this.__childModules.push(cachedModule);
        cachedModule.__parentModules.push(this);
        this.__callParentRequires(cachedModule);
    }
    return res;
};
//# sourceMappingURL=CustomRequire.js.map