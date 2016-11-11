# Custom Require

[![npm](https://img.shields.io/npm/v/npm.svg)]([![npm](https://img.shields.io/npm/dm/localeval.svg)](https://www.npmjs.com/package/custom-require)) [![npm](https://img.shields.io/npm/dm/localeval.svg)](https://www.npmjs.com/package/custom-require)

With this module you can receive a callback for any non-native dependecies an specific module loads, including the dependencies of his dependencies, and so on.

To check for module and dependencies modifications, see https://github.com/Llorx/watcher-require

To always receive an updated version of your modules, checking files and dependencies modifications,see https://github.com/Llorx/updated-require

## Installation

`npm install custom-require`

## Usage

```js
/* FILE: test1.js */
// Load any non-native module
require("react");

module.exports = "yay";
```

```js
/* FILE: test2.js */
// Load any non-native module
require("react");
require("redux");
```

```js
/* FILE: main.js */
// Load the module at the top of the entry point file
var CustomRequire = require("custom-require").CustomRequire;

// If you are using TypeScript, you can use import
import { CustomRequire } from "custom-require";

// Instantiate an object with a callback that will be called when a module is loaded
var firstWalker = new CustomRequire(function(module) {
    console.log("First walker", module.filename);
});

// Require a module to see its dependencies
firstWalker.require("./test");

// You can also require another file. Already called dependencies will not be called again
firstWalker.require("./test2");

// You can create different Custom Require instances together in the same script
var secondWalker = new CustomRequire(function(module) {
    console.log("Second walker", module.filename);
});

// Requiring modules already required by another instance will not be a problem
// Second walker will receive all the dependencies too
// The require method will work as the default require one, returning the exports contents
var yay = secondWalker.require("./test");

// Yay it
console.log(yay);

// After you have finished, call dispose() to clean resources attached to modules
firstWalker.dispose();
secondWalker.dispose();
```

Also, it works with asynchronous requires
```js
/* FILE: async_test.js */
// Load any non-native module
require("react");
setTimeout(function() {
    require("redux");
}, 1000);
```

## Limitations

As the nature of Node.js, required modules are cached, so doing this will not work as expected:
```js
// Load the test module before the Custom Require
require("./test");

// Now load Custom Require
var CustomRequire = require("custom-require").CustomRequire;

// And make an instance
var walker = new CustomRequire(function(module) {
    console.log("Walker", module.filename);
});

// This will show redux dependencies, but not react ones as they were loaded before Custom Require
walker.require("./test2");
```
Custom Require will be only able to track modules loaded after it has been required for the first time, so is recommendable to require it at the top of the entry-point file. Is not needed to add it to each file. Only at the entry-point.

NOTE: Custom Require will start tracking right after requiring it. Is not necessary to immediately create an instance.
