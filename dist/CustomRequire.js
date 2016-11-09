"use strict";
var Module = require("module");
var CustomRequire = (function () {
    function CustomRequire(callback) {
        this.called = [];
        this.callback = callback;
    }
    CustomRequire.prototype.require = function (id) {
        var requiredFilename = Module._resolveFilename(id, module, false);
        var res = require(id);
        var cachedModule = Module._cache[requiredFilename];
        cachedModule.__addCustomRequire(this);
        return res;
    };
    return CustomRequire;
}());
exports.CustomRequire = CustomRequire;
Module.prototype.__require = Module.prototype.require;
Module.prototype.__addCustomRequire = function (customRequire) {
    if (this.__customRequires.indexOf(customRequire) < 0) {
        this.__customRequires.push(customRequire);
    }
    if (customRequire.callback) {
        this.__callChildRequires(customRequire);
    }
};
Module.prototype.__callChildRequires = function (customRequire) {
    if (customRequire.called.indexOf(this) < 0) {
        customRequire.called.push(this);
        customRequire.callback(this);
        for (var i = 0; i < this.__childModules.length; i++) {
            var childModule = this.__childModules[i];
            childModule.__callChildRequires(customRequire);
        }
    }
};
Module.prototype.__callRequires = function (mod) {
    for (var i = 0; i < this.__customRequires.length; i++) {
        var customRequire = this.__customRequires[i];
        if (customRequire.callback) {
            mod.__callChildRequires(customRequire);
        }
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