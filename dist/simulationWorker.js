"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/better-sqlite3/lib/util.js
var require_util = __commonJS({
  "node_modules/better-sqlite3/lib/util.js"(exports2) {
    "use strict";
    exports2.getBooleanOption = (options, key) => {
      let value = false;
      if (key in options && typeof (value = options[key]) !== "boolean") {
        throw new TypeError(`Expected the "${key}" option to be a boolean`);
      }
      return value;
    };
    exports2.cppdb = /* @__PURE__ */ Symbol();
    exports2.inspect = /* @__PURE__ */ Symbol.for("nodejs.util.inspect.custom");
  }
});

// node_modules/better-sqlite3/lib/sqlite-error.js
var require_sqlite_error = __commonJS({
  "node_modules/better-sqlite3/lib/sqlite-error.js"(exports2, module2) {
    "use strict";
    var descriptor = { value: "SqliteError", writable: true, enumerable: false, configurable: true };
    function SqliteError(message, code) {
      if (new.target !== SqliteError) {
        return new SqliteError(message, code);
      }
      if (typeof code !== "string") {
        throw new TypeError("Expected second argument to be a string");
      }
      Error.call(this, message);
      descriptor.value = "" + message;
      Object.defineProperty(this, "message", descriptor);
      Error.captureStackTrace(this, SqliteError);
      this.code = code;
    }
    Object.setPrototypeOf(SqliteError, Error);
    Object.setPrototypeOf(SqliteError.prototype, Error.prototype);
    Object.defineProperty(SqliteError.prototype, "name", descriptor);
    module2.exports = SqliteError;
  }
});

// node_modules/file-uri-to-path/index.js
var require_file_uri_to_path = __commonJS({
  "node_modules/file-uri-to-path/index.js"(exports2, module2) {
    var sep = require("path").sep || "/";
    module2.exports = fileUriToPath;
    function fileUriToPath(uri) {
      if ("string" != typeof uri || uri.length <= 7 || "file://" != uri.substring(0, 7)) {
        throw new TypeError("must pass in a file:// URI to convert to a file path");
      }
      var rest = decodeURI(uri.substring(7));
      var firstSlash = rest.indexOf("/");
      var host = rest.substring(0, firstSlash);
      var path6 = rest.substring(firstSlash + 1);
      if ("localhost" == host) host = "";
      if (host) {
        host = sep + sep + host;
      }
      path6 = path6.replace(/^(.+)\|/, "$1:");
      if (sep == "\\") {
        path6 = path6.replace(/\//g, "\\");
      }
      if (/^.+\:/.test(path6)) {
      } else {
        path6 = sep + path6;
      }
      return host + path6;
    }
  }
});

// node_modules/bindings/bindings.js
var require_bindings = __commonJS({
  "node_modules/bindings/bindings.js"(exports2, module2) {
    var fs6 = require("fs");
    var path6 = require("path");
    var fileURLToPath = require_file_uri_to_path();
    var join3 = path6.join;
    var dirname = path6.dirname;
    var exists = fs6.accessSync && function(path7) {
      try {
        fs6.accessSync(path7);
      } catch (e) {
        return false;
      }
      return true;
    } || fs6.existsSync || path6.existsSync;
    var defaults = {
      arrow: process.env.NODE_BINDINGS_ARROW || " \u2192 ",
      compiled: process.env.NODE_BINDINGS_COMPILED_DIR || "compiled",
      platform: process.platform,
      arch: process.arch,
      nodePreGyp: "node-v" + process.versions.modules + "-" + process.platform + "-" + process.arch,
      version: process.versions.node,
      bindings: "bindings.node",
      try: [
        // node-gyp's linked version in the "build" dir
        ["module_root", "build", "bindings"],
        // node-waf and gyp_addon (a.k.a node-gyp)
        ["module_root", "build", "Debug", "bindings"],
        ["module_root", "build", "Release", "bindings"],
        // Debug files, for development (legacy behavior, remove for node v0.9)
        ["module_root", "out", "Debug", "bindings"],
        ["module_root", "Debug", "bindings"],
        // Release files, but manually compiled (legacy behavior, remove for node v0.9)
        ["module_root", "out", "Release", "bindings"],
        ["module_root", "Release", "bindings"],
        // Legacy from node-waf, node <= 0.4.x
        ["module_root", "build", "default", "bindings"],
        // Production "Release" buildtype binary (meh...)
        ["module_root", "compiled", "version", "platform", "arch", "bindings"],
        // node-qbs builds
        ["module_root", "addon-build", "release", "install-root", "bindings"],
        ["module_root", "addon-build", "debug", "install-root", "bindings"],
        ["module_root", "addon-build", "default", "install-root", "bindings"],
        // node-pre-gyp path ./lib/binding/{node_abi}-{platform}-{arch}
        ["module_root", "lib", "binding", "nodePreGyp", "bindings"]
      ]
    };
    function bindings(opts) {
      if (typeof opts == "string") {
        opts = { bindings: opts };
      } else if (!opts) {
        opts = {};
      }
      Object.keys(defaults).map(function(i2) {
        if (!(i2 in opts)) opts[i2] = defaults[i2];
      });
      if (!opts.module_root) {
        opts.module_root = exports2.getRoot(exports2.getFileName());
      }
      if (path6.extname(opts.bindings) != ".node") {
        opts.bindings += ".node";
      }
      var requireFunc = typeof __webpack_require__ === "function" ? __non_webpack_require__ : require;
      var tries = [], i = 0, l = opts.try.length, n, b, err;
      for (; i < l; i++) {
        n = join3.apply(
          null,
          opts.try[i].map(function(p) {
            return opts[p] || p;
          })
        );
        tries.push(n);
        try {
          b = opts.path ? requireFunc.resolve(n) : requireFunc(n);
          if (!opts.path) {
            b.path = n;
          }
          return b;
        } catch (e) {
          if (e.code !== "MODULE_NOT_FOUND" && e.code !== "QUALIFIED_PATH_RESOLUTION_FAILED" && !/not find/i.test(e.message)) {
            throw e;
          }
        }
      }
      err = new Error(
        "Could not locate the bindings file. Tried:\n" + tries.map(function(a) {
          return opts.arrow + a;
        }).join("\n")
      );
      err.tries = tries;
      throw err;
    }
    module2.exports = exports2 = bindings;
    exports2.getFileName = function getFileName(calling_file) {
      var origPST = Error.prepareStackTrace, origSTL = Error.stackTraceLimit, dummy = {}, fileName;
      Error.stackTraceLimit = 10;
      Error.prepareStackTrace = function(e, st) {
        for (var i = 0, l = st.length; i < l; i++) {
          fileName = st[i].getFileName();
          if (fileName !== __filename) {
            if (calling_file) {
              if (fileName !== calling_file) {
                return;
              }
            } else {
              return;
            }
          }
        }
      };
      Error.captureStackTrace(dummy);
      dummy.stack;
      Error.prepareStackTrace = origPST;
      Error.stackTraceLimit = origSTL;
      var fileSchema = "file://";
      if (fileName.indexOf(fileSchema) === 0) {
        fileName = fileURLToPath(fileName);
      }
      return fileName;
    };
    exports2.getRoot = function getRoot(file) {
      var dir = dirname(file), prev;
      while (true) {
        if (dir === ".") {
          dir = process.cwd();
        }
        if (exists(join3(dir, "package.json")) || exists(join3(dir, "node_modules"))) {
          return dir;
        }
        if (prev === dir) {
          throw new Error(
            'Could not find module root given file: "' + file + '". Do you have a `package.json` file? '
          );
        }
        prev = dir;
        dir = join3(dir, "..");
      }
    };
  }
});

// node_modules/better-sqlite3/lib/methods/wrappers.js
var require_wrappers = __commonJS({
  "node_modules/better-sqlite3/lib/methods/wrappers.js"(exports2) {
    "use strict";
    var { cppdb } = require_util();
    exports2.prepare = function prepare(sql) {
      return this[cppdb].prepare(sql, this, false);
    };
    exports2.exec = function exec(sql) {
      this[cppdb].exec(sql);
      return this;
    };
    exports2.close = function close() {
      this[cppdb].close();
      return this;
    };
    exports2.loadExtension = function loadExtension(...args) {
      this[cppdb].loadExtension(...args);
      return this;
    };
    exports2.defaultSafeIntegers = function defaultSafeIntegers(...args) {
      this[cppdb].defaultSafeIntegers(...args);
      return this;
    };
    exports2.unsafeMode = function unsafeMode(...args) {
      this[cppdb].unsafeMode(...args);
      return this;
    };
    exports2.getters = {
      name: {
        get: function name() {
          return this[cppdb].name;
        },
        enumerable: true
      },
      open: {
        get: function open() {
          return this[cppdb].open;
        },
        enumerable: true
      },
      inTransaction: {
        get: function inTransaction() {
          return this[cppdb].inTransaction;
        },
        enumerable: true
      },
      readonly: {
        get: function readonly() {
          return this[cppdb].readonly;
        },
        enumerable: true
      },
      memory: {
        get: function memory() {
          return this[cppdb].memory;
        },
        enumerable: true
      }
    };
  }
});

// node_modules/better-sqlite3/lib/methods/transaction.js
var require_transaction = __commonJS({
  "node_modules/better-sqlite3/lib/methods/transaction.js"(exports2, module2) {
    "use strict";
    var { cppdb } = require_util();
    var controllers = /* @__PURE__ */ new WeakMap();
    module2.exports = function transaction(fn) {
      if (typeof fn !== "function") throw new TypeError("Expected first argument to be a function");
      const db = this[cppdb];
      const controller = getController(db, this);
      const { apply } = Function.prototype;
      const properties = {
        default: { value: wrapTransaction(apply, fn, db, controller.default) },
        deferred: { value: wrapTransaction(apply, fn, db, controller.deferred) },
        immediate: { value: wrapTransaction(apply, fn, db, controller.immediate) },
        exclusive: { value: wrapTransaction(apply, fn, db, controller.exclusive) },
        database: { value: this, enumerable: true }
      };
      Object.defineProperties(properties.default.value, properties);
      Object.defineProperties(properties.deferred.value, properties);
      Object.defineProperties(properties.immediate.value, properties);
      Object.defineProperties(properties.exclusive.value, properties);
      return properties.default.value;
    };
    var getController = (db, self) => {
      let controller = controllers.get(db);
      if (!controller) {
        const shared = {
          commit: db.prepare("COMMIT", self, false),
          rollback: db.prepare("ROLLBACK", self, false),
          savepoint: db.prepare("SAVEPOINT `	_bs3.	`", self, false),
          release: db.prepare("RELEASE `	_bs3.	`", self, false),
          rollbackTo: db.prepare("ROLLBACK TO `	_bs3.	`", self, false)
        };
        controllers.set(db, controller = {
          default: Object.assign({ begin: db.prepare("BEGIN", self, false) }, shared),
          deferred: Object.assign({ begin: db.prepare("BEGIN DEFERRED", self, false) }, shared),
          immediate: Object.assign({ begin: db.prepare("BEGIN IMMEDIATE", self, false) }, shared),
          exclusive: Object.assign({ begin: db.prepare("BEGIN EXCLUSIVE", self, false) }, shared)
        });
      }
      return controller;
    };
    var wrapTransaction = (apply, fn, db, { begin, commit, rollback, savepoint, release, rollbackTo }) => function sqliteTransaction() {
      let before, after, undo;
      if (db.inTransaction) {
        before = savepoint;
        after = release;
        undo = rollbackTo;
      } else {
        before = begin;
        after = commit;
        undo = rollback;
      }
      before.run();
      try {
        const result = apply.call(fn, this, arguments);
        if (result && typeof result.then === "function") {
          throw new TypeError("Transaction function cannot return a promise");
        }
        after.run();
        return result;
      } catch (ex) {
        if (db.inTransaction) {
          undo.run();
          if (undo !== rollback) after.run();
        }
        throw ex;
      }
    };
  }
});

// node_modules/better-sqlite3/lib/methods/pragma.js
var require_pragma = __commonJS({
  "node_modules/better-sqlite3/lib/methods/pragma.js"(exports2, module2) {
    "use strict";
    var { getBooleanOption, cppdb } = require_util();
    module2.exports = function pragma(source, options) {
      if (options == null) options = {};
      if (typeof source !== "string") throw new TypeError("Expected first argument to be a string");
      if (typeof options !== "object") throw new TypeError("Expected second argument to be an options object");
      const simple = getBooleanOption(options, "simple");
      const stmt = this[cppdb].prepare(`PRAGMA ${source}`, this, true);
      return simple ? stmt.pluck().get() : stmt.all();
    };
  }
});

// node_modules/better-sqlite3/lib/methods/backup.js
var require_backup = __commonJS({
  "node_modules/better-sqlite3/lib/methods/backup.js"(exports2, module2) {
    "use strict";
    var fs6 = require("fs");
    var path6 = require("path");
    var { promisify } = require("util");
    var { cppdb } = require_util();
    var fsAccess = promisify(fs6.access);
    module2.exports = async function backup(filename, options) {
      if (options == null) options = {};
      if (typeof filename !== "string") throw new TypeError("Expected first argument to be a string");
      if (typeof options !== "object") throw new TypeError("Expected second argument to be an options object");
      filename = filename.trim();
      const attachedName = "attached" in options ? options.attached : "main";
      const handler = "progress" in options ? options.progress : null;
      if (!filename) throw new TypeError("Backup filename cannot be an empty string");
      if (filename === ":memory:") throw new TypeError('Invalid backup filename ":memory:"');
      if (typeof attachedName !== "string") throw new TypeError('Expected the "attached" option to be a string');
      if (!attachedName) throw new TypeError('The "attached" option cannot be an empty string');
      if (handler != null && typeof handler !== "function") throw new TypeError('Expected the "progress" option to be a function');
      await fsAccess(path6.dirname(filename)).catch(() => {
        throw new TypeError("Cannot save backup because the directory does not exist");
      });
      const isNewFile = await fsAccess(filename).then(() => false, () => true);
      return runBackup(this[cppdb].backup(this, attachedName, filename, isNewFile), handler || null);
    };
    var runBackup = (backup, handler) => {
      let rate = 0;
      let useDefault = true;
      return new Promise((resolve, reject) => {
        setImmediate(function step() {
          try {
            const progress = backup.transfer(rate);
            if (!progress.remainingPages) {
              backup.close();
              resolve(progress);
              return;
            }
            if (useDefault) {
              useDefault = false;
              rate = 100;
            }
            if (handler) {
              const ret = handler(progress);
              if (ret !== void 0) {
                if (typeof ret === "number" && ret === ret) rate = Math.max(0, Math.min(2147483647, Math.round(ret)));
                else throw new TypeError("Expected progress callback to return a number or undefined");
              }
            }
            setImmediate(step);
          } catch (err) {
            backup.close();
            reject(err);
          }
        });
      });
    };
  }
});

// node_modules/better-sqlite3/lib/methods/serialize.js
var require_serialize = __commonJS({
  "node_modules/better-sqlite3/lib/methods/serialize.js"(exports2, module2) {
    "use strict";
    var { cppdb } = require_util();
    module2.exports = function serialize(options) {
      if (options == null) options = {};
      if (typeof options !== "object") throw new TypeError("Expected first argument to be an options object");
      const attachedName = "attached" in options ? options.attached : "main";
      if (typeof attachedName !== "string") throw new TypeError('Expected the "attached" option to be a string');
      if (!attachedName) throw new TypeError('The "attached" option cannot be an empty string');
      return this[cppdb].serialize(attachedName);
    };
  }
});

// node_modules/better-sqlite3/lib/methods/function.js
var require_function = __commonJS({
  "node_modules/better-sqlite3/lib/methods/function.js"(exports2, module2) {
    "use strict";
    var { getBooleanOption, cppdb } = require_util();
    module2.exports = function defineFunction(name, options, fn) {
      if (options == null) options = {};
      if (typeof options === "function") {
        fn = options;
        options = {};
      }
      if (typeof name !== "string") throw new TypeError("Expected first argument to be a string");
      if (typeof fn !== "function") throw new TypeError("Expected last argument to be a function");
      if (typeof options !== "object") throw new TypeError("Expected second argument to be an options object");
      if (!name) throw new TypeError("User-defined function name cannot be an empty string");
      const safeIntegers = "safeIntegers" in options ? +getBooleanOption(options, "safeIntegers") : 2;
      const deterministic = getBooleanOption(options, "deterministic");
      const directOnly = getBooleanOption(options, "directOnly");
      const varargs = getBooleanOption(options, "varargs");
      let argCount = -1;
      if (!varargs) {
        argCount = fn.length;
        if (!Number.isInteger(argCount) || argCount < 0) throw new TypeError("Expected function.length to be a positive integer");
        if (argCount > 100) throw new RangeError("User-defined functions cannot have more than 100 arguments");
      }
      this[cppdb].function(fn, name, argCount, safeIntegers, deterministic, directOnly);
      return this;
    };
  }
});

// node_modules/better-sqlite3/lib/methods/aggregate.js
var require_aggregate = __commonJS({
  "node_modules/better-sqlite3/lib/methods/aggregate.js"(exports2, module2) {
    "use strict";
    var { getBooleanOption, cppdb } = require_util();
    module2.exports = function defineAggregate(name, options) {
      if (typeof name !== "string") throw new TypeError("Expected first argument to be a string");
      if (typeof options !== "object" || options === null) throw new TypeError("Expected second argument to be an options object");
      if (!name) throw new TypeError("User-defined function name cannot be an empty string");
      const start = "start" in options ? options.start : null;
      const step = getFunctionOption(options, "step", true);
      const inverse = getFunctionOption(options, "inverse", false);
      const result = getFunctionOption(options, "result", false);
      const safeIntegers = "safeIntegers" in options ? +getBooleanOption(options, "safeIntegers") : 2;
      const deterministic = getBooleanOption(options, "deterministic");
      const directOnly = getBooleanOption(options, "directOnly");
      const varargs = getBooleanOption(options, "varargs");
      let argCount = -1;
      if (!varargs) {
        argCount = Math.max(getLength(step), inverse ? getLength(inverse) : 0);
        if (argCount > 0) argCount -= 1;
        if (argCount > 100) throw new RangeError("User-defined functions cannot have more than 100 arguments");
      }
      this[cppdb].aggregate(start, step, inverse, result, name, argCount, safeIntegers, deterministic, directOnly);
      return this;
    };
    var getFunctionOption = (options, key, required) => {
      const value = key in options ? options[key] : null;
      if (typeof value === "function") return value;
      if (value != null) throw new TypeError(`Expected the "${key}" option to be a function`);
      if (required) throw new TypeError(`Missing required option "${key}"`);
      return null;
    };
    var getLength = ({ length }) => {
      if (Number.isInteger(length) && length >= 0) return length;
      throw new TypeError("Expected function.length to be a positive integer");
    };
  }
});

// node_modules/better-sqlite3/lib/methods/table.js
var require_table = __commonJS({
  "node_modules/better-sqlite3/lib/methods/table.js"(exports2, module2) {
    "use strict";
    var { cppdb } = require_util();
    module2.exports = function defineTable(name, factory) {
      if (typeof name !== "string") throw new TypeError("Expected first argument to be a string");
      if (!name) throw new TypeError("Virtual table module name cannot be an empty string");
      let eponymous = false;
      if (typeof factory === "object" && factory !== null) {
        eponymous = true;
        factory = defer(parseTableDefinition(factory, "used", name));
      } else {
        if (typeof factory !== "function") throw new TypeError("Expected second argument to be a function or a table definition object");
        factory = wrapFactory(factory);
      }
      this[cppdb].table(factory, name, eponymous);
      return this;
    };
    function wrapFactory(factory) {
      return function virtualTableFactory(moduleName, databaseName, tableName, ...args) {
        const thisObject = {
          module: moduleName,
          database: databaseName,
          table: tableName
        };
        const def = apply.call(factory, thisObject, args);
        if (typeof def !== "object" || def === null) {
          throw new TypeError(`Virtual table module "${moduleName}" did not return a table definition object`);
        }
        return parseTableDefinition(def, "returned", moduleName);
      };
    }
    function parseTableDefinition(def, verb, moduleName) {
      if (!hasOwnProperty.call(def, "rows")) {
        throw new TypeError(`Virtual table module "${moduleName}" ${verb} a table definition without a "rows" property`);
      }
      if (!hasOwnProperty.call(def, "columns")) {
        throw new TypeError(`Virtual table module "${moduleName}" ${verb} a table definition without a "columns" property`);
      }
      const rows = def.rows;
      if (typeof rows !== "function" || Object.getPrototypeOf(rows) !== GeneratorFunctionPrototype) {
        throw new TypeError(`Virtual table module "${moduleName}" ${verb} a table definition with an invalid "rows" property (should be a generator function)`);
      }
      let columns = def.columns;
      if (!Array.isArray(columns) || !(columns = [...columns]).every((x) => typeof x === "string")) {
        throw new TypeError(`Virtual table module "${moduleName}" ${verb} a table definition with an invalid "columns" property (should be an array of strings)`);
      }
      if (columns.length !== new Set(columns).size) {
        throw new TypeError(`Virtual table module "${moduleName}" ${verb} a table definition with duplicate column names`);
      }
      if (!columns.length) {
        throw new RangeError(`Virtual table module "${moduleName}" ${verb} a table definition with zero columns`);
      }
      let parameters;
      if (hasOwnProperty.call(def, "parameters")) {
        parameters = def.parameters;
        if (!Array.isArray(parameters) || !(parameters = [...parameters]).every((x) => typeof x === "string")) {
          throw new TypeError(`Virtual table module "${moduleName}" ${verb} a table definition with an invalid "parameters" property (should be an array of strings)`);
        }
      } else {
        parameters = inferParameters(rows);
      }
      if (parameters.length !== new Set(parameters).size) {
        throw new TypeError(`Virtual table module "${moduleName}" ${verb} a table definition with duplicate parameter names`);
      }
      if (parameters.length > 32) {
        throw new RangeError(`Virtual table module "${moduleName}" ${verb} a table definition with more than the maximum number of 32 parameters`);
      }
      for (const parameter of parameters) {
        if (columns.includes(parameter)) {
          throw new TypeError(`Virtual table module "${moduleName}" ${verb} a table definition with column "${parameter}" which was ambiguously defined as both a column and parameter`);
        }
      }
      let safeIntegers = 2;
      if (hasOwnProperty.call(def, "safeIntegers")) {
        const bool = def.safeIntegers;
        if (typeof bool !== "boolean") {
          throw new TypeError(`Virtual table module "${moduleName}" ${verb} a table definition with an invalid "safeIntegers" property (should be a boolean)`);
        }
        safeIntegers = +bool;
      }
      let directOnly = false;
      if (hasOwnProperty.call(def, "directOnly")) {
        directOnly = def.directOnly;
        if (typeof directOnly !== "boolean") {
          throw new TypeError(`Virtual table module "${moduleName}" ${verb} a table definition with an invalid "directOnly" property (should be a boolean)`);
        }
      }
      const columnDefinitions = [
        ...parameters.map(identifier).map((str) => `${str} HIDDEN`),
        ...columns.map(identifier)
      ];
      return [
        `CREATE TABLE x(${columnDefinitions.join(", ")});`,
        wrapGenerator(rows, new Map(columns.map((x, i) => [x, parameters.length + i])), moduleName),
        parameters,
        safeIntegers,
        directOnly
      ];
    }
    function wrapGenerator(generator, columnMap, moduleName) {
      return function* virtualTable(...args) {
        const output = args.map((x) => Buffer.isBuffer(x) ? Buffer.from(x) : x);
        for (let i = 0; i < columnMap.size; ++i) {
          output.push(null);
        }
        for (const row of generator(...args)) {
          if (Array.isArray(row)) {
            extractRowArray(row, output, columnMap.size, moduleName);
            yield output;
          } else if (typeof row === "object" && row !== null) {
            extractRowObject(row, output, columnMap, moduleName);
            yield output;
          } else {
            throw new TypeError(`Virtual table module "${moduleName}" yielded something that isn't a valid row object`);
          }
        }
      };
    }
    function extractRowArray(row, output, columnCount, moduleName) {
      if (row.length !== columnCount) {
        throw new TypeError(`Virtual table module "${moduleName}" yielded a row with an incorrect number of columns`);
      }
      const offset = output.length - columnCount;
      for (let i = 0; i < columnCount; ++i) {
        output[i + offset] = row[i];
      }
    }
    function extractRowObject(row, output, columnMap, moduleName) {
      let count = 0;
      for (const key of Object.keys(row)) {
        const index = columnMap.get(key);
        if (index === void 0) {
          throw new TypeError(`Virtual table module "${moduleName}" yielded a row with an undeclared column "${key}"`);
        }
        output[index] = row[key];
        count += 1;
      }
      if (count !== columnMap.size) {
        throw new TypeError(`Virtual table module "${moduleName}" yielded a row with missing columns`);
      }
    }
    function inferParameters({ length }) {
      if (!Number.isInteger(length) || length < 0) {
        throw new TypeError("Expected function.length to be a positive integer");
      }
      const params = [];
      for (let i = 0; i < length; ++i) {
        params.push(`$${i + 1}`);
      }
      return params;
    }
    var { hasOwnProperty } = Object.prototype;
    var { apply } = Function.prototype;
    var GeneratorFunctionPrototype = Object.getPrototypeOf(function* () {
    });
    var identifier = (str) => `"${str.replace(/"/g, '""')}"`;
    var defer = (x) => () => x;
  }
});

// node_modules/better-sqlite3/lib/methods/inspect.js
var require_inspect = __commonJS({
  "node_modules/better-sqlite3/lib/methods/inspect.js"(exports2, module2) {
    "use strict";
    var DatabaseInspection = function Database() {
    };
    module2.exports = function inspect(depth, opts) {
      return Object.assign(new DatabaseInspection(), this);
    };
  }
});

// node_modules/better-sqlite3/lib/database.js
var require_database = __commonJS({
  "node_modules/better-sqlite3/lib/database.js"(exports2, module2) {
    "use strict";
    var fs6 = require("fs");
    var path6 = require("path");
    var util2 = require_util();
    var SqliteError = require_sqlite_error();
    var DEFAULT_ADDON;
    function Database(filenameGiven, options) {
      if (new.target == null) {
        return new Database(filenameGiven, options);
      }
      let buffer;
      if (Buffer.isBuffer(filenameGiven)) {
        buffer = filenameGiven;
        filenameGiven = ":memory:";
      }
      if (filenameGiven == null) filenameGiven = "";
      if (options == null) options = {};
      if (typeof filenameGiven !== "string") throw new TypeError("Expected first argument to be a string");
      if (typeof options !== "object") throw new TypeError("Expected second argument to be an options object");
      if ("readOnly" in options) throw new TypeError('Misspelled option "readOnly" should be "readonly"');
      if ("memory" in options) throw new TypeError('Option "memory" was removed in v7.0.0 (use ":memory:" filename instead)');
      const filename = filenameGiven.trim();
      const anonymous = filename === "" || filename === ":memory:";
      const readonly = util2.getBooleanOption(options, "readonly");
      const fileMustExist = util2.getBooleanOption(options, "fileMustExist");
      const timeout = "timeout" in options ? options.timeout : 5e3;
      const verbose = "verbose" in options ? options.verbose : null;
      const nativeBinding = "nativeBinding" in options ? options.nativeBinding : null;
      if (readonly && anonymous && !buffer) throw new TypeError("In-memory/temporary databases cannot be readonly");
      if (!Number.isInteger(timeout) || timeout < 0) throw new TypeError('Expected the "timeout" option to be a positive integer');
      if (timeout > 2147483647) throw new RangeError('Option "timeout" cannot be greater than 2147483647');
      if (verbose != null && typeof verbose !== "function") throw new TypeError('Expected the "verbose" option to be a function');
      if (nativeBinding != null && typeof nativeBinding !== "string" && typeof nativeBinding !== "object") throw new TypeError('Expected the "nativeBinding" option to be a string or addon object');
      let addon;
      if (nativeBinding == null) {
        addon = DEFAULT_ADDON || (DEFAULT_ADDON = require_bindings()("better_sqlite3.node"));
      } else if (typeof nativeBinding === "string") {
        const requireFunc = typeof __non_webpack_require__ === "function" ? __non_webpack_require__ : require;
        addon = requireFunc(path6.resolve(nativeBinding).replace(/(\.node)?$/, ".node"));
      } else {
        addon = nativeBinding;
      }
      if (!addon.isInitialized) {
        addon.setErrorConstructor(SqliteError);
        addon.isInitialized = true;
      }
      if (!anonymous && !filename.startsWith("file:") && !fs6.existsSync(path6.dirname(filename))) {
        throw new TypeError("Cannot open database because the directory does not exist");
      }
      Object.defineProperties(this, {
        [util2.cppdb]: { value: new addon.Database(filename, filenameGiven, anonymous, readonly, fileMustExist, timeout, verbose || null, buffer || null) },
        ...wrappers.getters
      });
    }
    var wrappers = require_wrappers();
    Database.prototype.prepare = wrappers.prepare;
    Database.prototype.transaction = require_transaction();
    Database.prototype.pragma = require_pragma();
    Database.prototype.backup = require_backup();
    Database.prototype.serialize = require_serialize();
    Database.prototype.function = require_function();
    Database.prototype.aggregate = require_aggregate();
    Database.prototype.table = require_table();
    Database.prototype.loadExtension = wrappers.loadExtension;
    Database.prototype.exec = wrappers.exec;
    Database.prototype.close = wrappers.close;
    Database.prototype.defaultSafeIntegers = wrappers.defaultSafeIntegers;
    Database.prototype.unsafeMode = wrappers.unsafeMode;
    Database.prototype[util2.inspect] = require_inspect();
    module2.exports = Database;
  }
});

// node_modules/better-sqlite3/lib/index.js
var require_lib = __commonJS({
  "node_modules/better-sqlite3/lib/index.js"(exports2, module2) {
    "use strict";
    module2.exports = require_database();
    module2.exports.SqliteError = require_sqlite_error();
  }
});

// src/server/simulation/simulationWorker.ts
var import_worker_threads = require("worker_threads");

// src/server/game/workTagMatrixLoader.ts
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));
var cachedMatrix = null;
function setWorkTagMatrixDirect(data) {
  cachedMatrix = data;
}
function getWorkTagMatrix() {
  if (process.env.DISABLE_WORKTAG_MATRIX === "1") return null;
  if (cachedMatrix) return cachedMatrix;
  try {
    const p = import_path.default.join(process.cwd(), "data", "workTagMatrix.json");
    if (!import_fs.default.existsSync(p)) return null;
    const raw = JSON.parse(import_fs.default.readFileSync(p, "utf-8"));
    cachedMatrix = raw;
    return cachedMatrix;
  } catch (err) {
    console.error("[WorkTag] Matrix load failed:", err);
    return null;
  }
}
function getWorkTagsFromMatrix(workIds, options) {
  const matrix = getWorkTagMatrix();
  if (!matrix?.workTagMap) return [];
  const map = matrix.workTagMap;
  const filterTagKeys = options?.tagKeys?.length ? options.tagKeys : null;
  const n = workIds.length;
  const estimated = n * 14;
  const results = new Array(estimated);
  let idx = 0;
  for (let i = 0; i < n; i++) {
    const workId = workIds[i];
    const list = map[workId];
    if (!list) continue;
    for (let j = 0; j < list.length; j++) {
      const e = list[j];
      if (filterTagKeys && !filterTagKeys.includes(e.tagKey)) continue;
      results[idx++] = {
        workId,
        tagKey: e.tagKey,
        derivedConfidence: e.derivedConfidence ?? null
      };
    }
  }
  results.length = idx;
  return results;
}

// src/server/simulation/prismaStub.ts
var prisma = new Proxy({}, {
  get(_target, prop) {
    if (prop === "$connect" || prop === "$disconnect") {
      return () => Promise.resolve();
    }
    throw new Error(`[SimWorker] prisma.${String(prop)} called in worker - this should not happen. All data should be from in-memory cache.`);
  }
});

// src/server/game/tagCacheLoader.ts
var tagByKey = null;
var tagByDisplayName = null;
var loadPromise = null;
function setTagCacheDirect(tags) {
  tagByKey = /* @__PURE__ */ new Map();
  tagByDisplayName = /* @__PURE__ */ new Map();
  for (const t of tags) {
    tagByKey.set(t.tagKey, t);
    const dn = t.displayName;
    if (!tagByDisplayName.has(dn)) tagByDisplayName.set(dn, []);
    tagByDisplayName.get(dn).push(t);
  }
  loadPromise = Promise.resolve();
}
async function loadTagCache() {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const rows = await prisma.tag.findMany({
      select: { tagKey: true, displayName: true, tagType: true, questionText: true }
    });
    tagByKey = /* @__PURE__ */ new Map();
    tagByDisplayName = /* @__PURE__ */ new Map();
    for (const r of rows) {
      const t = {
        tagKey: r.tagKey,
        displayName: r.displayName ?? "",
        tagType: r.tagType,
        questionText: r.questionText
      };
      tagByKey.set(r.tagKey, t);
      const dn = t.displayName;
      if (!tagByDisplayName.has(dn)) tagByDisplayName.set(dn, []);
      tagByDisplayName.get(dn).push(t);
    }
  })();
  return loadPromise;
}
async function ensureTagCacheLoaded() {
  if (process.env.DISABLE_TAG_CACHE === "1") return;
  await loadTagCache();
}
function isTagCacheReady() {
  return tagByKey !== null && tagByDisplayName !== null && process.env.DISABLE_TAG_CACHE !== "1";
}
function getTagByKey(tagKey) {
  if (!tagByKey) return null;
  return tagByKey.get(tagKey) ?? null;
}
function getTagsByTagKeys(tagKeys, filter) {
  if (!tagByKey) return [];
  const results = [];
  for (const k of tagKeys) {
    const t = tagByKey.get(k);
    if (!t) continue;
    if (filter?.tagTypes?.length && (!t.tagType || !filter.tagTypes.includes(t.tagType))) continue;
    results.push(t);
  }
  return results;
}
function getTagsByDisplayNames(displayNames) {
  if (!tagByDisplayName) return [];
  const seen = /* @__PURE__ */ new Set();
  const results = [];
  for (const dn of displayNames) {
    const list = tagByDisplayName.get(dn) ?? [];
    for (const t of list) {
      if (!seen.has(t.tagKey)) {
        seen.add(t.tagKey);
        results.push(t);
      }
    }
  }
  return results;
}
function getTagKeysByType(tagType, options) {
  if (!tagByKey) return [];
  const results = [];
  for (const [k, t] of tagByKey) {
    if (t.tagType !== tagType) continue;
    if (options?.notIn?.has(k)) continue;
    results.push(k);
  }
  return results;
}

// src/server/algo/scoring.ts
function normalizeWeights(weights) {
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  if (totalWeight === 0) {
    return weights.map((w) => ({
      workId: w.workId,
      probability: 1 / weights.length
    }));
  }
  return weights.map((w) => ({
    workId: w.workId,
    probability: w.weight / totalWeight
  }));
}
function calculateConfidence(probabilities) {
  if (probabilities.length === 0) {
    return 0;
  }
  const sorted = [...probabilities].sort((a, b) => {
    if (a.probability !== b.probability) {
      return b.probability - a.probability;
    }
    return a.workId.localeCompare(b.workId);
  });
  return sorted[0].probability;
}
function calculateEffectiveCandidates(probabilities) {
  if (probabilities.length === 0) {
    return 0;
  }
  const sumSquared = probabilities.reduce(
    (sum, p) => sum + p.probability * p.probability,
    0
  );
  if (sumSquared === 0) {
    return 0;
  }
  return 1 / sumSquared;
}
function calculateEffectiveConfirmThreshold(totalWorks, min, max, divisor) {
  return Math.min(max, Math.max(min, Math.round(totalWorks / divisor)));
}

// src/server/algo/questionSelection.ts
function entropy(probs) {
  const sum = probs.reduce((a, b) => a + b, 0);
  if (sum <= 0) return 0;
  let h = 0;
  for (const p of probs) {
    const q = p / sum;
    if (q > 0) h -= q * Math.log2(q);
  }
  return h;
}
var L_YES_HAS = 0.9;
var L_NO_HAS = 0.1;
function filterTagsByPValueBandForIG(availableTags, probabilities, workHasTag, pValueBand) {
  if (availableTags.length === 0) return [];
  const filtered = [];
  for (const tag of availableTags) {
    let pYes = 0;
    for (const prob of probabilities) {
      const hasTag = workHasTag(prob.workId, tag.tagKey);
      const likeYes = hasTag ? L_YES_HAS : L_NO_HAS;
      pYes += prob.probability * likeYes;
    }
    if (pYes >= pValueBand.pValueMin && pYes <= pValueBand.pValueMax) {
      filtered.push(tag);
    }
  }
  return filtered;
}
function selectExploreTagByIG(availableTags, probabilities, workHasTag, pValueBand) {
  if (availableTags.length === 0) return null;
  const candidates = availableTags.map((tag) => {
    let pYes = 0;
    const postYes = [];
    const postNo = [];
    for (const prob of probabilities) {
      const hasTag = workHasTag(prob.workId, tag.tagKey);
      const likeYes = hasTag ? L_YES_HAS : L_NO_HAS;
      const likeNo = hasTag ? L_NO_HAS : L_YES_HAS;
      pYes += prob.probability * likeYes;
      postYes.push(prob.probability * likeYes);
      postNo.push(prob.probability * likeNo);
    }
    const pNo = 1 - pYes;
    const sumYes = postYes.reduce((a, b) => a + b, 0);
    const sumNo = postNo.reduce((a, b) => a + b, 0);
    const normYes = sumYes > 0 ? postYes.map((p2) => p2 / sumYes) : postYes;
    const normNo = sumNo > 0 ? postNo.map((p2) => p2 / sumNo) : postNo;
    const H_yes = entropy(normYes);
    const H_no = entropy(normNo);
    const expectedEntropy = pYes * H_yes + pNo * H_no;
    const p = pYes;
    return { tagKey: tag.tagKey, expectedEntropy, pYes: p, p };
  });
  let filtered = candidates;
  if (pValueBand != null) {
    filtered = candidates.filter(
      (c) => c.p >= pValueBand.pValueMin && c.p <= pValueBand.pValueMax
    );
    if (filtered.length === 0) return null;
  }
  filtered.sort((a, b) => {
    if (a.expectedEntropy !== b.expectedEntropy) return a.expectedEntropy - b.expectedEntropy;
    return a.tagKey.localeCompare(b.tagKey);
  });
  const selected = filtered[0];
  return selected.tagKey;
}
function selectExploreTag(availableTags, probabilities, workHasTag, confidence = 0, topWorkId = null, pValueBand, preferHighP = false) {
  if (availableTags.length === 0) {
    return null;
  }
  const candidates = availableTags.map((tag) => {
    const p = probabilities.filter((prob) => workHasTag(prob.workId, tag.tagKey)).reduce((sum, prob) => sum + prob.probability, 0);
    return {
      tagKey: tag.tagKey,
      coverage: p,
      distanceFromHalf: Math.abs(p - 0.5)
    };
  });
  let filtered = candidates;
  if (pValueBand != null) {
    filtered = candidates.filter(
      (c) => c.coverage >= pValueBand.pValueMin && c.coverage <= pValueBand.pValueMax
    );
    if (filtered.length === 0) return null;
  }
  filtered.sort((a, b) => {
    if (preferHighP) {
      if (a.coverage !== b.coverage) return b.coverage - a.coverage;
    } else {
      if (a.distanceFromHalf !== b.distanceFromHalf) {
        return a.distanceFromHalf - b.distanceFromHalf;
      }
    }
    return a.tagKey.localeCompare(b.tagKey);
  });
  const selected = filtered[0];
  return selected.tagKey;
}
function shouldInsertConfirm(qIndex, confidence, effectiveCandidates, config) {
  if (config.qForcedIndices.includes(qIndex)) {
    return true;
  }
  const [bandMin, bandMax] = config.confidenceConfirmBand;
  if (confidence >= bandMin && confidence <= bandMax) {
    return true;
  }
  if (effectiveCandidates <= config.effectiveConfirmThreshold) {
    return true;
  }
  return false;
}
function selectConfirmType(confidence, hasSoftConfirmData, config) {
  if (confidence >= config.hardConfidenceMin) {
    return "HARD_CONFIRM";
  }
  if (confidence >= config.softConfidenceMin && hasSoftConfirmData) {
    return "SOFT_CONFIRM";
  }
  return "HARD_CONFIRM";
}

// src/server/algo/coverage.ts
function calculateCoverage(tagWorkCount, totalWorks) {
  if (totalWorks === 0) {
    return 0;
  }
  return tagWorkCount / totalWorks;
}
function passesCoverageGate(tagWorkCount, totalWorks, mode, minCoverageRatio, minCoverageWorks, maxCoverageRatio = null) {
  const coverage = calculateCoverage(tagWorkCount, totalWorks);
  if (maxCoverageRatio !== null && coverage > maxCoverageRatio) {
    return false;
  }
  if (mode === "RATIO") {
    if (minCoverageRatio === null) {
      return false;
    }
    return coverage >= minCoverageRatio;
  }
  if (mode === "WORKS") {
    if (minCoverageWorks === null) {
      return false;
    }
    return tagWorkCount >= minCoverageWorks;
  }
  if (minCoverageRatio === null || minCoverageWorks === null) {
    return false;
  }
  const clampedMinWorks = Math.min(minCoverageWorks, totalWorks);
  const minRatio = Math.max(
    minCoverageRatio,
    clampedMinWorks / Math.max(totalWorks, 1)
    // Avoid division-by-zero
  );
  return coverage >= minRatio;
}

// src/server/algo/weightUpdate.ts
function hasDerivedFeature(derivedConfidence, threshold) {
  if (derivedConfidence === null || derivedConfidence === void 0) {
    return false;
  }
  return derivedConfidence >= threshold;
}
function getLikelihood(workHasFeature, answerChoice, epsilon) {
  const ep = Math.max(0, Math.min(0.5, epsilon));
  const high = 1 - ep;
  const low = ep;
  switch (answerChoice) {
    case "YES":
      return workHasFeature ? high : low;
    case "NO":
      return workHasFeature ? low : high;
    case "PROBABLY_YES": {
      const v = workHasFeature ? 0.7 : 0.3;
      return Math.max(low, Math.min(high, v));
    }
    case "PROBABLY_NO": {
      const v = workHasFeature ? 0.3 : 0.7;
      return Math.max(low, Math.min(high, v));
    }
    case "UNKNOWN": {
      const v = workHasFeature ? 0.1 : 0.9;
      return Math.max(low, Math.min(high, v));
    }
    case "DONT_CARE":
    default:
      return 1;
  }
}
function updateWeightsForTagQuestionBayesian(weights, workHasFeature, answerChoice, epsilon = 0.02) {
  return weights.map((w) => ({
    workId: w.workId,
    weight: w.weight * getLikelihood(workHasFeature(w.workId), answerChoice, epsilon)
  }));
}
var EXP_CLAMP = 700;
function updateWeightsForTagQuestion(weights, workHasFeature, answerStrength, beta) {
  return weights.map((w) => {
    const hasFeature = workHasFeature(w.workId);
    const arg = Math.max(-EXP_CLAMP, Math.min(EXP_CLAMP, hasFeature ? beta * answerStrength : -beta * answerStrength));
    const mult = Math.exp(arg);
    return {
      workId: w.workId,
      weight: w.weight * mult
    };
  });
}
function getLikelihoodSoft(pYes, answerChoice, epsilon) {
  const p = Math.max(epsilon, Math.min(1 - epsilon, pYes));
  const ep = Math.max(0.01, Math.min(0.2, epsilon));
  switch (answerChoice) {
    case "YES":
      return Math.max(ep, Math.min(1 - ep, p));
    case "NO":
      return Math.max(ep, Math.min(1 - ep, 1 - p));
    case "PROBABLY_YES":
      return Math.max(ep, Math.min(1 - ep, 0.7 * p + 0.3 * (1 - p)));
    case "PROBABLY_NO":
      return Math.max(ep, Math.min(1 - ep, 0.3 * p + 0.7 * (1 - p)));
    case "UNKNOWN":
      return Math.max(ep, Math.min(1 - ep, 0.1 * p + 0.9 * (1 - p)));
    case "DONT_CARE":
    default:
      return 1;
  }
}
function sigmoid(x) {
  const clamped = Math.max(-EXP_CLAMP, Math.min(EXP_CLAMP, x));
  return 1 / (1 + Math.exp(-clamped));
}
function updateWeightsForPopularitySoft(weights, workPopularity, threshold, answerChoice, k = 0.15, epsilon = 0.02) {
  return weights.map((w) => {
    const pop = workPopularity(w.workId);
    const pYes = sigmoid(k * (pop - threshold));
    const likelihood = getLikelihoodSoft(pYes, answerChoice, epsilon);
    return {
      workId: w.workId,
      weight: w.weight * likelihood
    };
  });
}

// src/server/utils/normalizeTitle.ts
var TITLE_INITIAL_LENGTH = 3;
function normalizeTitleForInitial(title) {
  if (title == null || typeof title !== "string") return "?";
  let normalized = title.normalize("NFKC");
  const bracketPatterns = [
    /^【[^】]*】/,
    /^\([^)]*\)/,
    /^\[[^\]]*\]/,
    /^\{[^}]*\}/,
    /^＜[^＞]*＞/,
    /^<[^>]*>/,
    /^「[^」]*」/,
    /^『[^』]*』/,
    /^（[^）]*）/,
    /^［[^］]*］/,
    /^｛[^｝]*｝/
  ];
  for (let i = 0; i < 3; i++) {
    let changed = false;
    for (const pattern of bracketPatterns) {
      if (pattern.test(normalized)) {
        normalized = normalized.replace(pattern, "");
        changed = true;
        break;
      }
    }
    if (!changed) break;
    normalized = normalized.replace(/^[\s\u3000\t]+/, "");
  }
  const symbolPatterns = [
    // ASCII記号
    /^[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/,
    // 全角記号
    /^[！＂＃＄％＆＇（）＊＋，－．／：；＜＝＞？＠［＼］＾＿｀｛｜｝～]/,
    // その他代表記号
    /^[★☆◆◇■□・…〜ー—–]/
  ];
  for (let i = 0; i < 10; i++) {
    let changed = false;
    for (const pattern of symbolPatterns) {
      if (pattern.test(normalized)) {
        normalized = normalized.replace(pattern, "");
        changed = true;
        break;
      }
    }
    if (!changed) break;
    normalized = normalized.replace(/^[\s\u3000\t]+/, "");
  }
  const trimmed = normalized.trim();
  if (!trimmed.length) return "?";
  return trimmed.slice(0, TITLE_INITIAL_LENGTH);
}

// src/server/utils/titleReadingInitial.ts
function getTitleReadingInitials(raw) {
  if (!raw || typeof raw !== "string") return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

// src/server/algo/types.ts
var SERIES_TAG_KEYS = ["off_e1f6b6c9ce", "off_ad42c1ba79"];

// src/server/utils/titleCharType.ts
var BRACKET_PATTERNS = [
  /^【[^】]*】/,
  /^\([^)]*\)/,
  /^\[[^\]]*\]/,
  /^\{[^}]*\}/,
  /^＜[^＞]*＞/,
  /^<[^>]*>/,
  /^「[^」]*」/,
  /^『[^』]*』/,
  /^（[^）]*）/,
  /^［[^］]*］/,
  /^｛[^｝]*｝/
];
var SYMBOL_PATTERNS = [
  /^[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/,
  /^[！＂＃＄％＆＇（）＊＋，－．／：；＜＝＞？＠［＼］＾＿｀｛｜｝～]/,
  /^[★☆◆◇■□・…〜ー—–]/
];
function getFirstMeaningfulChar(title) {
  if (title == null || typeof title !== "string") return "";
  let normalized = title.normalize("NFKC");
  for (let i = 0; i < 3; i++) {
    let changed = false;
    for (const pattern of BRACKET_PATTERNS) {
      if (pattern.test(normalized)) {
        normalized = normalized.replace(pattern, "");
        changed = true;
        break;
      }
    }
    if (!changed) break;
    normalized = normalized.replace(/^[\s\u3000\t]+/, "");
  }
  for (let i = 0; i < 10; i++) {
    let changed = false;
    for (const pattern of SYMBOL_PATTERNS) {
      if (pattern.test(normalized)) {
        normalized = normalized.replace(pattern, "");
        changed = true;
        break;
      }
    }
    if (!changed) break;
    normalized = normalized.replace(/^[\s\u3000\t]+/, "");
  }
  const trimmed = normalized.trim();
  if (!trimmed.length) return "";
  return trimmed[0] ?? "";
}
function getTitleCharType(title) {
  const c = getFirstMeaningfulChar(title);
  if (!c) return "OTHER";
  if (/[\u4e00-\u9faf\u3400-\u4dbf]/.test(c)) return "KANJI";
  if (/[ァ-ヶー]/.test(c)) return "KATAKANA";
  if (/[ぁ-んー]/.test(c)) return "HIRAGANA";
  return "OTHER";
}
function hiraganaToKatakana(c) {
  const code = c.codePointAt(0) ?? 0;
  if (code >= 12353 && code <= 12438) {
    return String.fromCodePoint(code + 96);
  }
  if (c === "\u30FC" || code === 12540) return "\u30FC";
  return c;
}
function getTitleReadingInitialFromTitle(title) {
  const c = getFirstMeaningfulChar(title);
  if (!c) return null;
  if (/[ァ-ヶー]/.test(c)) return c;
  if (/[ぁ-んー]/.test(c)) return hiraganaToKatakana(c);
  return null;
}

// src/server/utils/authorCharType.ts
function getFirstMeaningfulChar2(name) {
  if (name == null || typeof name !== "string") return "";
  const trimmed = name.trim();
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i] ?? "";
    if (/[\s\u3000\t]/.test(c)) continue;
    if (/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(c)) continue;
    return c;
  }
  return "";
}
function getAuthorCharType(authorName) {
  const c = getFirstMeaningfulChar2(authorName);
  if (!c) return "OTHER";
  if (/[ぁ-んー]/.test(c)) return "HIRAGANA";
  if (/[ァ-ヶー]/.test(c)) return "KATAKANA";
  if (/[\u4e00-\u9faf\u3400-\u4dbf]/.test(c)) return "KANJI";
  if (/[a-zA-Z]/.test(c)) return "ALPHA";
  return "OTHER";
}

// src/server/config/specialQuestionsLoader.ts
var import_fs2 = __toESM(require("fs"));
var import_path2 = __toESM(require("path"));
var cache = null;
var cacheTime = 0;
var CACHE_TTL = 5e3;
function normalizeConfig(raw) {
  const base = raw.specialQuestions ?? raw;
  const tsl = base.TITLE_SYLLABLE;
  const ranges = Array.isArray(tsl) ? tsl : tsl && typeof tsl === "object" && Array.isArray(tsl.ranges) ? tsl.ranges : [];
  return {
    SERIES: base.SERIES,
    TITLE_CHAR_TYPE: base.TITLE_CHAR_TYPE,
    POPULARITY: base.POPULARITY,
    TITLE_SYLLABLE: { ranges },
    TITLE_SYLLABLE_2: base.TITLE_SYLLABLE_2,
    AUTHOR_CHAR_TYPE: base.AUTHOR_CHAR_TYPE
  };
}
function loadSpecialQuestionsConfig() {
  return loadSpecialQuestions();
}
function loadSpecialQuestions() {
  const now = Date.now();
  if (cache && now - cacheTime < CACHE_TTL) {
    return cache;
  }
  try {
    const filePath = import_path2.default.join(process.cwd(), "config", "specialQuestions.json");
    const content = import_fs2.default.readFileSync(filePath, "utf-8");
    const raw = JSON.parse(content);
    cache = normalizeConfig(raw);
    cacheTime = now;
    return cache ?? {};
  } catch {
    cache = {};
    cacheTime = now;
    return {};
  }
}
function getTitleSyllableRanges() {
  const tsl = loadSpecialQuestions().TITLE_SYLLABLE;
  if (Array.isArray(tsl)) return tsl;
  return tsl?.ranges ?? [];
}
function getTitleSyllable2Branches() {
  return loadSpecialQuestions().TITLE_SYLLABLE_2?.branches ?? {};
}
function getAuthorCharTypeQuestionText(charType) {
  const text = loadSpecialQuestions().AUTHOR_CHAR_TYPE?.[charType];
  if (text) return text;
  const defaults = {
    HIRAGANA_OR_KATAKANA: "\u4F5C\u8005\u540D\u306F\u3010\u3072\u3089\u304C\u306A or \u30AB\u30BF\u30AB\u30CA\u3011\u3067\u59CB\u307E\u308B\uFF1F",
    KANJI_OR_ALPHA: "\u4F5C\u8005\u540D\u306F\u3010\u6F22\u5B57 or \u30A2\u30EB\u30D5\u30A1\u30D9\u30C3\u30C8\u3011\u3067\u59CB\u307E\u308B\uFF1F"
  };
  return defaults[charType] ?? "";
}

// src/server/algo/specialQuestionSelection.ts
function informationGain(pYes) {
  const p = Math.max(1e-3, Math.min(0.999, pYes));
  return Math.min(p, 1 - p);
}
function workHasSeriesTag(workId, workTagMap) {
  const tags = workTagMap.get(workId);
  if (!tags) return false;
  return SERIES_TAG_KEYS.some((tk) => tags.has(tk));
}
var SLOT_A_POOL = ["SERIES", "POPULARITY"];
var SLOT_B_EXTRA = "TITLE_CHAR_TYPE";
function getRangeIdFromSyllableChars(chars) {
  const ranges = getTitleSyllableRanges();
  const charSet = new Set(chars);
  for (const r of ranges) {
    const rSet = new Set(r.chars ?? []);
    if (rSet.size > 0 && rSet.size === charSet.size && [...rSet].every((c) => charSet.has(c))) {
      return r.id ?? null;
    }
  }
  return null;
}
async function selectSpecialQuestion(probabilities, usedSpecialTypes, workIds, slotIndex, _titleCharTypeAnsweredUnknown, questionHistory) {
  const config = loadSpecialQuestionsConfig();
  let allowedTypes = null;
  if (slotIndex === 3) {
    allowedTypes = SLOT_A_POOL.filter((t) => !usedSpecialTypes.has(t));
  } else if (slotIndex === 5) {
    const fromA = SLOT_A_POOL.filter((t) => !usedSpecialTypes.has(t));
    const hasChar = !usedSpecialTypes.has(SLOT_B_EXTRA);
    allowedTypes = [...fromA, ...hasChar ? [SLOT_B_EXTRA] : []];
  } else if (slotIndex === 9 || slotIndex === 16 || slotIndex === 11) {
    const all = ["SERIES", "TITLE_CHAR_TYPE", "POPULARITY", "TITLE_SYLLABLE"];
    allowedTypes = all.filter((t) => !usedSpecialTypes.has(t));
  } else if (slotIndex === 20 || slotIndex === 24) {
    const rescueCandidates = [];
    if (!usedSpecialTypes.has("AUTHOR_CHAR_TYPE")) rescueCandidates.push("AUTHOR_CHAR_TYPE");
    const lastSyllable = (questionHistory ?? []).filter((q) => q.kind === "SPECIAL_QUESTION" && q.specialQuestionType === "TITLE_SYLLABLE").pop();
    const syllableAnsweredOk = lastSyllable && lastSyllable.answer && (lastSyllable.answer === "YES" || lastSyllable.answer === "NO") && lastSyllable.syllableChars?.length;
    if (!usedSpecialTypes.has("TITLE_SYLLABLE_2") && syllableAnsweredOk) {
      rescueCandidates.push("TITLE_SYLLABLE_2");
    }
    allowedTypes = rescueCandidates.length > 0 ? rescueCandidates : null;
  }
  const candidates = [];
  if ((!allowedTypes || allowedTypes.includes("SERIES")) && !usedSpecialTypes.has("SERIES")) {
    const matrix = getWorkTagMatrix();
    const workTagMap = /* @__PURE__ */ new Map();
    if (matrix) {
      const workTags = getWorkTagsFromMatrix(workIds, { tagKeys: [...SERIES_TAG_KEYS] });
      for (const wt of workTags) {
        if (!workTagMap.has(wt.workId)) workTagMap.set(wt.workId, /* @__PURE__ */ new Set());
        workTagMap.get(wt.workId).add(wt.tagKey);
      }
    } else {
      const workTags = await prisma.workTag.findMany({
        where: {
          workId: { in: workIds },
          tagKey: { in: [...SERIES_TAG_KEYS] }
        },
        select: { workId: true, tagKey: true }
      });
      for (const wt of workTags) {
        if (!workTagMap.has(wt.workId)) workTagMap.set(wt.workId, /* @__PURE__ */ new Set());
        workTagMap.get(wt.workId).add(wt.tagKey);
      }
    }
    let pYes = 0;
    for (const p of probabilities) {
      if (workHasSeriesTag(p.workId, workTagMap)) {
        pYes += p.probability;
      }
    }
    const questionText = config.SERIES?.questionText ?? "\u305D\u306E\u4F5C\u54C1\u306F\u3001\u30B7\u30EA\u30FC\u30BA\u3082\u306E\u3084\u7DCF\u96C6\u7DE8\uFF1F";
    candidates.push({
      type: "SERIES",
      pYes,
      result: {
        specialQuestionType: "SERIES",
        displayText: questionText,
        seriesTagKeys: [...SERIES_TAG_KEYS]
      }
    });
  }
  if ((!allowedTypes || allowedTypes.includes("TITLE_CHAR_TYPE")) && !usedSpecialTypes.has("TITLE_CHAR_TYPE")) {
    const _swd = getSimWorkDataMap();
    const works = _swd ? workIds.map((id) => _swd.get(id)).filter((w) => w != null) : await prisma.work.findMany({
      where: { workId: { in: workIds } },
      select: { workId: true, title: true }
    });
    const workCharTypeMap = /* @__PURE__ */ new Map();
    for (const w of works) {
      workCharTypeMap.set(w.workId, getTitleCharType(w.title ?? ""));
    }
    const charTypes = ["KANJI", "HIRAGANA_OR_KATAKANA"];
    const ctDisplay = config.TITLE_CHAR_TYPE ?? {};
    const chosen = charTypes[Math.floor(Math.random() * charTypes.length)];
    let pYes = 0;
    for (const p of probabilities) {
      const ct = workCharTypeMap.get(p.workId);
      const matches = chosen === "KANJI" ? ct === "KANJI" : ct === "HIRAGANA" || ct === "KATAKANA";
      if (matches) pYes += p.probability;
    }
    const questionText = chosen === "KANJI" ? ctDisplay.KANJI ?? "\u30BF\u30A4\u30C8\u30EB\u306F\u3010\u6F22\u5B57\u3011\u3067\u59CB\u307E\u308B\uFF1F" : ctDisplay.HIRAGANA_OR_KATAKANA ?? "\u30BF\u30A4\u30C8\u30EB\u306F\u3010\u3072\u3089\u304C\u306A or \u30AB\u30BF\u30AB\u30CA\u3011\u3067\u59CB\u307E\u308B\uFF1F";
    candidates.push({
      type: "TITLE_CHAR_TYPE",
      pYes,
      result: {
        specialQuestionType: "TITLE_CHAR_TYPE",
        displayText: questionText,
        titleCharType: chosen
      }
    });
  }
  if ((!allowedTypes || allowedTypes.includes("POPULARITY")) && !usedSpecialTypes.has("POPULARITY")) {
    const threshold = config.POPULARITY?.popularityThreshold ?? 30;
    const _swd2 = getSimWorkDataMap();
    const works = _swd2 ? workIds.map((id) => _swd2.get(id)).filter((w) => w != null) : await prisma.work.findMany({
      where: { workId: { in: workIds } },
      select: { workId: true, popularityBase: true, popularityPlayBonus: true }
    });
    const workPopularityMap = /* @__PURE__ */ new Map();
    for (const w of works) {
      const total = (w.popularityBase ?? 0) + (w.popularityPlayBonus ?? 0);
      workPopularityMap.set(w.workId, total);
    }
    let pYes = 0;
    for (const p of probabilities) {
      const pop = workPopularityMap.get(p.workId) ?? 0;
      if (pop >= threshold) {
        pYes += p.probability;
      }
    }
    const questionText = config.POPULARITY?.questionText ?? "\u305D\u306E\u4F5C\u54C1\u306F\u3001\u304B\u306A\u308A\u6709\u540D\uFF1F";
    candidates.push({
      type: "POPULARITY",
      pYes,
      result: {
        specialQuestionType: "POPULARITY",
        displayText: questionText,
        popularityThreshold: threshold
      }
    });
  }
  if ((!allowedTypes || allowedTypes.includes("TITLE_SYLLABLE")) && !usedSpecialTypes.has("TITLE_SYLLABLE")) {
    const syllableOptions = config.TITLE_SYLLABLE && "ranges" in config.TITLE_SYLLABLE ? config.TITLE_SYLLABLE.ranges ?? [] : Array.isArray(config.TITLE_SYLLABLE) ? config.TITLE_SYLLABLE : [];
    if (syllableOptions.length > 0) {
      const _swd3 = getSimWorkDataMap();
      const works = _swd3 ? workIds.map((id) => _swd3.get(id)).filter((w) => w != null) : await prisma.work.findMany({
        where: { workId: { in: workIds } },
        select: { workId: true, titleReadingInitial: true }
      });
      const workInitialMap = /* @__PURE__ */ new Map();
      for (const w of works) {
        workInitialMap.set(w.workId, w.titleReadingInitial ?? null);
      }
      for (const opt of syllableOptions) {
        const charSet = new Set(opt.chars ?? []);
        if (charSet.size === 0) continue;
        let pYes = 0;
        for (const p of probabilities) {
          const raw = workInitialMap.get(p.workId);
          const initials = getTitleReadingInitials(raw);
          if (initials.some((c) => charSet.has(c))) {
            pYes += p.probability;
          }
        }
        const questionText = opt.questionText ?? `\u305D\u306E\u4F5C\u54C1\u306E\u30BF\u30A4\u30C8\u30EB\u306F\u3001${opt.label}\u3067\u59CB\u307E\u308A\u307E\u3059\u304B\uFF1F`;
        candidates.push({
          type: "TITLE_SYLLABLE",
          pYes,
          result: {
            specialQuestionType: "TITLE_SYLLABLE",
            displayText: questionText,
            syllableChars: [...opt.chars],
            titleSyllableRangeId: opt.id
          }
        });
      }
    }
  }
  if ((!allowedTypes || allowedTypes.includes("TITLE_SYLLABLE_2")) && !usedSpecialTypes.has("TITLE_SYLLABLE_2")) {
    const lastSyllable = (questionHistory ?? []).filter((q) => q.kind === "SPECIAL_QUESTION" && q.specialQuestionType === "TITLE_SYLLABLE").pop();
    if (lastSyllable?.syllableChars && lastSyllable.answer && (lastSyllable.answer === "YES" || lastSyllable.answer === "NO")) {
      const rangeId = getRangeIdFromSyllableChars(lastSyllable.syllableChars);
      const branches = getTitleSyllable2Branches();
      const branch = rangeId ? branches[rangeId] : null;
      const subBranch = lastSyllable.answer === "YES" ? branch?.yesBranch : branch?.noBranch;
      if (subBranch?.chars?.length) {
        const _swd4 = getSimWorkDataMap();
        const works = _swd4 ? workIds.map((id) => _swd4.get(id)).filter((w) => w != null) : await prisma.work.findMany({
          where: { workId: { in: workIds } },
          select: { workId: true, titleReadingInitial: true }
        });
        const workInitialMap = /* @__PURE__ */ new Map();
        for (const w of works) {
          workInitialMap.set(w.workId, w.titleReadingInitial ?? null);
        }
        const charSet = new Set(subBranch.chars);
        let pYes = 0;
        for (const p of probabilities) {
          const raw = workInitialMap.get(p.workId);
          const initials = getTitleReadingInitials(raw);
          if (initials.some((c) => charSet.has(c))) pYes += p.probability;
        }
        const questionText = subBranch.questionText ?? `\u305D\u306E\u4F5C\u54C1\u306E\u30BF\u30A4\u30C8\u30EB\u306F\u3001${subBranch.label}\u3067\u59CB\u307E\u308A\u307E\u3059\u304B\uFF1F`;
        candidates.push({
          type: "TITLE_SYLLABLE_2",
          pYes,
          result: {
            specialQuestionType: "TITLE_SYLLABLE_2",
            displayText: questionText,
            syllableChars: [...subBranch.chars],
            titleSyllable2RangeId: rangeId ?? void 0,
            titleSyllable2Branch: lastSyllable.answer === "YES" ? "yesBranch" : "noBranch"
          }
        });
      }
    }
  }
  if ((!allowedTypes || allowedTypes.includes("AUTHOR_CHAR_TYPE")) && !usedSpecialTypes.has("AUTHOR_CHAR_TYPE")) {
    const _swd5 = getSimWorkDataMap();
    const works = _swd5 ? workIds.map((id) => _swd5.get(id)).filter((w) => w != null) : await prisma.work.findMany({
      where: { workId: { in: workIds } },
      select: { workId: true, authorName: true }
    });
    const workAuthorCharMap = /* @__PURE__ */ new Map();
    for (const w of works) {
      workAuthorCharMap.set(w.workId, getAuthorCharType(w.authorName ?? ""));
    }
    const charTypes = ["HIRAGANA_OR_KATAKANA", "KANJI_OR_ALPHA"];
    const chosen = charTypes[Math.floor(Math.random() * charTypes.length)];
    let pYes = 0;
    for (const p of probabilities) {
      const ct = workAuthorCharMap.get(p.workId);
      const matches = chosen === "HIRAGANA_OR_KATAKANA" ? ct === "HIRAGANA" || ct === "KATAKANA" : ct === "KANJI" || ct === "ALPHA";
      if (matches) pYes += p.probability;
    }
    const questionText = getAuthorCharTypeQuestionText(chosen);
    candidates.push({
      type: "AUTHOR_CHAR_TYPE",
      pYes,
      result: {
        specialQuestionType: "AUTHOR_CHAR_TYPE",
        displayText: questionText,
        authorCharType: chosen
      }
    });
  }
  if (candidates.length === 0) return null;
  if (slotIndex === 3 || slotIndex === 5 || slotIndex === 9 || slotIndex === 11 || slotIndex === 16 || slotIndex === 20 || slotIndex === 24) {
    candidates.sort((a, b) => informationGain(b.pYes) - informationGain(a.pYes));
    const topN = Math.min(3, candidates.length);
    const chosen = candidates[Math.floor(Math.random() * topN)];
    return chosen.result;
  }
  candidates.sort((a, b) => informationGain(b.pYes) - informationGain(a.pYes));
  const best = candidates[0];
  return best.result;
}

// src/server/config/tagIncludeUnify.ts
var import_fs3 = __toESM(require("fs"));
var import_path3 = __toESM(require("path"));
var cache2 = null;
var cacheTime2 = 0;
var CACHE_TTL2 = 6e4;
function loadConfig() {
  const filePath = import_path3.default.join(process.cwd(), "config", "tagIncludeUnify.json");
  try {
    const content = import_fs3.default.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);
    return {
      include: data.include ?? {},
      unify: data.unify ?? []
    };
  } catch {
    return { include: {}, unify: [] };
  }
}
function mergeOverlapping(groups) {
  let current = groups.map((g) => new Set(g));
  for (; ; ) {
    let changed = false;
    const next = [];
    for (const g of current) {
      let merged = false;
      for (const r of next) {
        for (const x of g) {
          if (r.has(x)) {
            for (const y of g) r.add(y);
            merged = true;
            changed = true;
            break;
          }
        }
        if (merged) break;
      }
      if (!merged) next.push(new Set(g));
    }
    if (!changed) return next;
    current = next;
  }
}
function buildDisplayNameToGroup() {
  const now = Date.now();
  if (cache2 && now - cacheTime2 < CACHE_TTL2) {
    return cache2;
  }
  const config = loadConfig();
  const groups = [];
  for (const [rep, included] of Object.entries(config.include ?? {})) {
    groups.push(/* @__PURE__ */ new Set([rep, ...included]));
  }
  for (const arr of config.unify ?? []) {
    groups.push(new Set(arr));
  }
  const merged = mergeOverlapping(groups);
  const displayNameToGroup = /* @__PURE__ */ new Map();
  for (const g of merged) {
    const list = Array.from(g);
    for (const d of list) {
      displayNameToGroup.set(d, list);
    }
  }
  cache2 = displayNameToGroup;
  cacheTime2 = now;
  return displayNameToGroup;
}
function getGroupDisplayNames(displayName) {
  const map = buildDisplayNameToGroup();
  return map.get(displayName) ?? [displayName];
}

// src/server/config/flowUtils.ts
function getRevealThresholdForQuestion(questionCount, baseThreshold) {
  const q = questionCount + 1;
  if (q <= 15) return Math.max(baseThreshold, 0.7);
  if (q <= 20) return 0.6;
  if (q <= 25) return 0.5;
  return 0.4;
}
var MAX_QUESTIONS_CAP = 40;
function getEffectiveMaxQuestions(baseMaxQuestions, _confidence, options) {
  const { questionHistory = [], effectiveCandidates = Infinity, questionCount = 0 } = options ?? {};
  const unknownCount = questionHistory.filter((q) => q.answer === "UNKNOWN").length;
  const recoveryBonus = questionCount >= 30 && effectiveCandidates < 50 ? 5 : 0;
  const total = baseMaxQuestions + unknownCount + recoveryBonus;
  return Math.min(MAX_QUESTIONS_CAP, total);
}

// src/server/admin/bannedTags.ts
var fs4 = __toESM(require("fs"));
var path4 = __toESM(require("path"));
var BANNED_TAGS_PATH = path4.join(process.cwd(), "config", "bannedTags.json");
var cachedConfig = null;
function loadBannedTagsConfig() {
  if (cachedConfig) return cachedConfig;
  try {
    const content = fs4.readFileSync(BANNED_TAGS_PATH, "utf-8");
    cachedConfig = JSON.parse(content);
    return cachedConfig;
  } catch {
    cachedConfig = { version: "1.0", description: "\u53D6\u5F97\u7981\u6B62\u30BF\u30B0\u30EA\u30B9\u30C8", bannedTags: [] };
    return cachedConfig;
  }
}
function isTagBanned(tagName, bannedTags) {
  const list = bannedTags ?? loadBannedTagsConfig().bannedTags;
  for (const banned of list) {
    switch (banned.type) {
      case "exact":
        if (tagName === banned.pattern) return true;
        break;
      case "startsWith":
        if (tagName.startsWith(banned.pattern)) return true;
        break;
      case "contains":
        if (tagName.includes(banned.pattern)) return true;
        break;
      case "regex":
        try {
          if (new RegExp(banned.pattern).test(tagName)) return true;
        } catch {
        }
        break;
    }
  }
  return false;
}

// src/server/simulationPerf.ts
var import_async_hooks = require("async_hooks");
var accumulatorStorage = new import_async_hooks.AsyncLocalStorage();
function shouldCollect() {
  return !!accumulatorStorage.getStore() || process.env.SIMULATION_PERF === "1";
}
function perfStart(_label) {
  return shouldCollect() ? Date.now() : null;
}
function perfEnd(label, start) {
  const currentAccumulator = accumulatorStorage.getStore();
  if (start !== null && currentAccumulator) {
    const ms = Date.now() - start;
    if (label === "runSimulation") {
      currentAccumulator.runSimulation = ms;
    } else {
      const key = label;
      if (key in currentAccumulator) {
        currentAccumulator[key] += ms;
      }
    }
  }
}
function createPerfAccumulator(includePerf) {
  if (includePerf || process.env.SIMULATION_PERF === "1") {
    return {
      runSimulation: 0,
      fetchWorkTags: 0,
      selectNextQuestion: 0,
      processAnswer: 0,
      tagCoverage: 0,
      other: 0,
      buildUsedTagKeysFromHistory: 0,
      selectUnifiedExploreOrSummary: 0,
      selectExploreQuestion: 0,
      selectNextQuestion_confirm: 0,
      tryGetHardConfirmQuestion: 0,
      tryEmergencyExploreFallback: 0
    };
  }
  return null;
}
function toPerfSummary(acc) {
  if (!acc) return void 0;
  return {
    runSimulation: acc.runSimulation,
    selectNextQuestion: acc.selectNextQuestion,
    processAnswer: acc.processAnswer,
    fetchWorkTags: acc.fetchWorkTags,
    tagCoverage: acc.tagCoverage,
    other: acc.other,
    buildUsedTagKeysFromHistory: acc.buildUsedTagKeysFromHistory,
    selectUnifiedExploreOrSummary: acc.selectUnifiedExploreOrSummary,
    selectExploreQuestion: acc.selectExploreQuestion,
    selectNextQuestion_confirm: acc.selectNextQuestion_confirm,
    tryGetHardConfirmQuestion: acc.tryGetHardConfirmQuestion,
    tryEmergencyExploreFallback: acc.tryEmergencyExploreFallback
  };
}
function runWithPerfAccumulator(acc, fn) {
  if (acc) {
    return accumulatorStorage.run(acc, fn);
  }
  return fn();
}

// src/server/game/engine.ts
var import_fs4 = __toESM(require("fs"));
var import_path4 = __toESM(require("path"));
var CACHE_TTL3 = 5e3;
var _simWorkDataMap = null;
function setSimWorkDataMap(map) {
  _simWorkDataMap = map;
}
function getSimWorkDataMap() {
  return _simWorkDataMap;
}
var DEFAULT_QUESTION_PATTERN = (displayName) => `${displayName}\u304C\u95A2\u4FC2\u3057\u3066\u3044\u308B\uFF1F`;
var CHARACTER_QUESTION_PATTERN = (displayName) => `${displayName}\u3068\u3044\u3046\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC\u304C\u767B\u5834\u3059\u308B\uFF1F`;
var summaryQuestionsCache = null;
var summaryQuestionsCacheTime = 0;
function loadSummaryQuestions() {
  const now = Date.now();
  if (summaryQuestionsCache && now - summaryQuestionsCacheTime < CACHE_TTL3) {
    return summaryQuestionsCache;
  }
  try {
    const filePath = import_path4.default.join(process.cwd(), "config", "summaryQuestions.json");
    const content = import_fs4.default.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);
    summaryQuestionsCache = data.summaryQuestions ?? [];
    summaryQuestionsCacheTime = now;
    return summaryQuestionsCache;
  } catch {
    return [];
  }
}
var abstractDisplayNamesCache = null;
var abstractDisplayNamesCacheTime = 0;
function loadAbstractDisplayNames() {
  const now = Date.now();
  if (abstractDisplayNamesCache && now - abstractDisplayNamesCacheTime < CACHE_TTL3) {
    return abstractDisplayNamesCache;
  }
  try {
    const filePath = import_path4.default.join(process.cwd(), "config", "vagueTags.json");
    const content = import_fs4.default.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);
    abstractDisplayNamesCache = new Set(data.displayNames ?? []);
    abstractDisplayNamesCacheTime = now;
    return abstractDisplayNamesCache;
  } catch {
    return /* @__PURE__ */ new Set();
  }
}
var eroticDisplayNamesCache = null;
var eroticDisplayNamesCacheTime = 0;
function loadEroticDisplayNames() {
  const now = Date.now();
  if (eroticDisplayNamesCache && now - eroticDisplayNamesCacheTime < CACHE_TTL3) {
    return eroticDisplayNamesCache;
  }
  try {
    const filePath = import_path4.default.join(process.cwd(), "config", "eroticTags.json");
    const content = import_fs4.default.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);
    eroticDisplayNamesCache = new Set(data.displayNames ?? []);
    eroticDisplayNamesCacheTime = now;
    return eroticDisplayNamesCache;
  } catch {
    return /* @__PURE__ */ new Set();
  }
}
async function fetchWorkTags(workIds, options) {
  if (workIds.length === 0) return [];
  const t = perfStart("fetchWorkTags");
  const matrix = getWorkTagMatrix();
  if (matrix) {
    const out = getWorkTagsFromMatrix(workIds, options);
    perfEnd("fetchWorkTags", t);
    return out;
  }
  const result = await prisma.workTag.findMany({
    where: {
      workId: { in: workIds },
      ...options?.tagKeys?.length ? { tagKey: { in: options.tagKeys } } : {}
    },
    select: { workId: true, tagKey: true, derivedConfidence: true }
  });
  perfEnd("fetchWorkTags", t);
  return result.map((r) => ({
    workId: r.workId,
    tagKey: r.tagKey,
    derivedConfidence: r.derivedConfidence ?? null
  }));
}
function getTagQuestionText(displayName, tagType, dbQuestionText) {
  if (dbQuestionText && dbQuestionText.trim()) {
    return dbQuestionText.trim();
  }
  if (tagType === "STRUCTURAL") {
    return CHARACTER_QUESTION_PATTERN(displayName);
  }
  return DEFAULT_QUESTION_PATTERN(displayName);
}
function filterWorksByAiGate(works, aiGateChoice) {
  if (aiGateChoice === "YES") {
    return works.filter((w) => w.isAi === "AI").map((w) => w.workId);
  }
  if (aiGateChoice === "NO") {
    return works.filter((w) => w.isAi === "HAND").map((w) => w.workId);
  }
  return works.map((w) => w.workId);
}
async function selectNextQuestion(weights, probabilities, questionCount, questionHistory, config, options) {
  const t = perfStart("selectNextQuestion");
  try {
    await ensureTagCacheLoaded();
    const questionIndex = questionCount + 1;
    const usedSummaryIds = new Set(
      questionHistory.filter((q) => !!q.summaryQuestionId).map((q) => q.summaryQuestionId)
    );
    const tUsed = perfStart("buildUsedTagKeysFromHistory");
    const usedTagKeys = await buildUsedTagKeysFromHistory(questionHistory);
    perfEnd("buildUsedTagKeysFromHistory", tUsed);
    if (questionCount === 0) {
      const summaries = loadSummaryQuestions();
      const unused = summaries.filter((s) => !usedSummaryIds.has(s.id) && !s.erotic);
      if (unused.length > 0) {
        const workIds = weights.map((w) => w.workId);
        const workTagsAll = await fetchWorkTags(workIds);
        const workTagMap = /* @__PURE__ */ new Map();
        for (const wt of workTagsAll) {
          if (!workTagMap.has(wt.workId)) workTagMap.set(wt.workId, /* @__PURE__ */ new Set());
          workTagMap.get(wt.workId).add(wt.tagKey);
        }
        const probMap = new Map(probabilities.map((p) => [p.workId, p.probability]));
        const scored = [];
        for (const summary of unused) {
          const tags = isTagCacheReady() ? getTagsByDisplayNames(summary.displayNames) : await prisma.tag.findMany({
            where: { displayName: { in: summary.displayNames } },
            select: { tagKey: true, displayName: true }
          });
          const validTag = tags.find((t2) => !isTagBanned(t2.displayName));
          if (!validTag) continue;
          const tagKeys = tags.map((t2) => t2.tagKey);
          let p = 0;
          for (const wid of workIds) {
            const workTags = workTagMap.get(wid);
            if (workTags && tagKeys.some((tk) => workTags.has(tk))) {
              p += probMap.get(wid) ?? 0;
            }
          }
          scored.push({ summary, distanceFromHalf: Math.abs(p - 0.5) });
        }
        if (scored.length > 0) {
          scored.sort((a, b) => a.distanceFromHalf - b.distanceFromHalf);
          const top3 = scored.slice(0, 3);
          const chosen = top3[Math.floor(Math.random() * top3.length)].summary;
          const tags = isTagCacheReady() ? getTagsByDisplayNames(chosen.displayNames) : await prisma.tag.findMany({
            where: { displayName: { in: chosen.displayNames } },
            select: { tagKey: true, displayName: true }
          });
          const validTag = tags.find((t2) => !isTagBanned(t2.displayName));
          if (validTag) {
            return {
              kind: "EXPLORE_TAG",
              displayText: chosen.questionText,
              tagKey: validTag.tagKey,
              isSummaryQuestion: true,
              summaryQuestionId: chosen.id,
              summaryDisplayNames: chosen.displayNames,
              exploreTagKind: "summary"
            };
          }
        }
        console.warn(
          `[selectNextQuestion] Q1: \u307E\u3068\u3081\u306E displayNames \u306B\u975E\u7981\u6B62\u30BF\u30B0\u304C0\u4EF6\u3067\u3057\u305F\u3002\u30D5\u30A9\u30FC\u30EB\u30D0\u30C3\u30AF\u3057\u307E\u3059\u3002`
        );
      } else {
        console.warn("[selectNextQuestion] Q1: \u975E\u30A8\u30ED\u306E\u672A\u4F7F\u7528\u307E\u3068\u3081\u304C0\u4EF6\u3067\u3059\u3002");
      }
      const q1Fallback = await selectExploreQuestion(weights, probabilities, questionHistory, config, buildExploreOptions(1), usedTagKeys);
      if (q1Fallback) {
        return q1Fallback;
      }
      console.warn("[selectNextQuestion] Q1: \u30D5\u30A9\u30FC\u30EB\u30D0\u30C3\u30AF\u5F8C\u3082\u5019\u88DC\u304C\u7121\u304F\u3001null \u3092\u8FD4\u3057\u307E\u3059\u3002");
      return null;
    }
    const confidence = calculateConfidence(probabilities);
    const effectiveCandidates = calculateEffectiveCandidates(probabilities);
    const effectiveConfirmThreshold = calculateEffectiveConfirmThreshold(
      weights.length,
      config.flow.effectiveConfirmThresholdParams.min,
      config.flow.effectiveConfirmThresholdParams.max,
      config.flow.effectiveConfirmThresholdParams.divisor
    );
    const qIndex = questionIndex;
    if (options?.afterRevealWrong) {
      const hardAfterReveal = await tryGetHardConfirmQuestion(weights, probabilities, questionHistory, config, questionCount);
      if (hardAfterReveal) {
        return hardAfterReveal;
      }
    }
    const baseSpecialSlots = config.flow.specialQuestionSlotIndices ?? [3, 5, 9, 16];
    const hasSpecialAnsweredUnknown = questionHistory.some(
      (q) => q.kind === "SPECIAL_QUESTION" && q.answer === "UNKNOWN"
    );
    let specialSlotIndices = hasSpecialAnsweredUnknown && !baseSpecialSlots.includes(11) ? [...baseSpecialSlots, 11] : [...baseSpecialSlots];
    const rescue = config.flow.rescueSpecialCondition;
    if (rescue && rescue.slotIndices.includes(qIndex)) {
      const meetsRescue = effectiveCandidates > rescue.effectiveCandidatesMin || confidence < rescue.confidenceMax;
      if (meetsRescue) {
        specialSlotIndices = [...specialSlotIndices, qIndex];
      }
    }
    if (specialSlotIndices.includes(qIndex)) {
      const usedSpecialTypes = new Set(
        questionHistory.filter(
          (q) => q.kind === "SPECIAL_QUESTION" && !!q.specialQuestionType
        ).map((q) => q.specialQuestionType)
      );
      const titleCharTypeAnsweredUnknown = questionHistory.some(
        (q) => q.kind === "SPECIAL_QUESTION" && q.specialQuestionType === "TITLE_CHAR_TYPE" && q.answer === "UNKNOWN"
      );
      const workIds = weights.map((w) => w.workId);
      const historyForRescue = questionHistory.map((q) => ({
        kind: q.kind,
        specialQuestionType: q.specialQuestionType,
        syllableChars: q.syllableChars,
        answer: q.answer
      }));
      const specialResult = await selectSpecialQuestion(
        probabilities,
        usedSpecialTypes,
        workIds,
        qIndex,
        titleCharTypeAnsweredUnknown,
        historyForRescue
      );
      if (specialResult) {
        return {
          kind: "SPECIAL_QUESTION",
          displayText: specialResult.displayText,
          specialQuestionType: specialResult.specialQuestionType,
          seriesTagKeys: specialResult.seriesTagKeys,
          titleCharType: specialResult.titleCharType,
          popularityThreshold: specialResult.popularityThreshold,
          syllableChars: specialResult.syllableChars,
          authorCharType: specialResult.authorCharType,
          titleSyllableRangeId: specialResult.titleSyllableRangeId,
          titleSyllable2RangeId: specialResult.titleSyllable2RangeId,
          titleSyllable2Branch: specialResult.titleSyllable2Branch
        };
      }
    }
    const shouldConfirm = shouldInsertConfirm(
      qIndex,
      confidence,
      effectiveCandidates,
      {
        qForcedIndices: config.confirm.qForcedIndices,
        confidenceConfirmBand: config.confirm.confidenceConfirmBand,
        effectiveConfirmThreshold
      }
    );
    if (shouldConfirm) {
      const tConfirm = perfStart("selectNextQuestion_confirm");
      try {
        const usedHardTypes = questionHistory.filter((q) => q.kind === "HARD_CONFIRM").map((q) => q.hardConfirmType).filter((t2) => !!t2);
        const probsForConfirm = normalizeWeights(weights);
        const sortedByProb = [...probsForConfirm].sort((a, b) => b.probability - a.probability);
        const top1WorkId = sortedByProb[0]?.workId ?? null;
        const workIds = weights.map((w) => w.workId);
        const threshold = config.algo.derivedConfidenceThreshold;
        const matrix = getWorkTagMatrix();
        let derivedTags;
        if (top1WorkId != null) {
          if (matrix) {
            const allDerivedTagKeys = getTagKeysByType("DERIVED", { notIn: usedTagKeys });
            const top1WorkTags = getWorkTagsFromMatrix([top1WorkId], { tagKeys: allDerivedTagKeys });
            const top1TagKeys = [...new Set(
              top1WorkTags.filter((wt) => hasDerivedFeature(wt.derivedConfidence, threshold)).map((wt) => wt.tagKey)
            )];
            if (top1TagKeys.length > 0) {
              const tagsFromDb = isTagCacheReady() ? getTagsByTagKeys(top1TagKeys) : await prisma.tag.findMany({
                where: { tagKey: { in: top1TagKeys } },
                select: { tagKey: true, displayName: true, questionText: true }
              });
              const workTagsRaw = getWorkTagsFromMatrix(workIds, { tagKeys: top1TagKeys });
              const workTagsFiltered = workTagsRaw.filter((wt) => hasDerivedFeature(wt.derivedConfidence, threshold));
              const tagToWorkIds = /* @__PURE__ */ new Map();
              for (const wt of workTagsFiltered) {
                if (!tagToWorkIds.has(wt.tagKey)) tagToWorkIds.set(wt.tagKey, []);
                tagToWorkIds.get(wt.tagKey).push({ workId: wt.workId });
              }
              derivedTags = tagsFromDb.map((t2) => ({
                tagKey: t2.tagKey,
                displayName: t2.displayName,
                questionText: t2.questionText,
                workTags: tagToWorkIds.get(t2.tagKey) ?? []
              }));
            } else {
              derivedTags = [];
            }
          } else {
            const top1WorkTags = await prisma.workTag.findMany({
              where: {
                workId: top1WorkId,
                derivedConfidence: { gte: threshold },
                tag: { tagType: "DERIVED", tagKey: { notIn: Array.from(usedTagKeys) } }
              },
              include: { tag: { select: { tagKey: true, displayName: true, questionText: true } } }
            });
            const top1TagKeys = top1WorkTags.map((wt) => wt.tag.tagKey);
            if (top1TagKeys.length > 0) {
              derivedTags = await prisma.tag.findMany({
                where: { tagKey: { in: top1TagKeys } },
                select: {
                  tagKey: true,
                  displayName: true,
                  questionText: true,
                  workTags: {
                    where: {
                      workId: { in: workIds },
                      derivedConfidence: { gte: threshold }
                    },
                    select: { workId: true }
                  }
                }
              });
            } else {
              derivedTags = [];
            }
          }
        } else {
          derivedTags = [];
        }
        if (derivedTags.length === 0 && !matrix) {
          try {
            const sqlite3 = require_lib();
            const path6 = require("path");
            const dbPath = path6.join(process.cwd(), "prisma", "dev.db");
            const db = sqlite3(dbPath, { readonly: true });
            const workIds2 = weights.map((w) => w.workId);
            const placeholders = workIds2.map(() => "?").join(",");
            const directTags = db.prepare(`
          SELECT 
            t.tagKey,
            t.displayName,
            t.questionText
          FROM Tag t
          WHERE t.tagType = 'DERIVED'
            AND t.tagKey NOT IN (${Array.from(usedTagKeys).map(() => "?").join(",")})
        `).all(...Array.from(usedTagKeys));
            derivedTags = directTags.map((tag) => {
              const workTags = db.prepare(`
            SELECT workId
            FROM WorkTag
            WHERE tagKey = ?
              AND workId IN (${placeholders})
              AND derivedConfidence >= ?
          `).all(tag.tagKey, ...workIds2, config.algo.derivedConfidenceThreshold);
              return {
                tagKey: tag.tagKey,
                displayName: tag.displayName,
                questionText: tag.questionText ?? null,
                workTags
              };
            });
            db.close();
          } catch (directError) {
            console.error("[selectNextQuestion] Error in direct SQLite fallback:", directError);
          }
        }
        derivedTags = derivedTags.filter((t2) => !isTagBanned(t2.displayName));
        const hasSoftConfirmData = derivedTags.some((tag) => tag.workTags.length > 0);
        const confirmType = selectConfirmType(confidence, hasSoftConfirmData, {
          softConfidenceMin: config.confirm.softConfidenceMin,
          hardConfidenceMin: config.confirm.hardConfidenceMin
        });
        if (confirmType === "SOFT_CONFIRM" && derivedTags.length > 0) {
          const probMap = new Map(probsForConfirm.map((p) => [p.workId, p.probability]));
          const pMin = config.algo.explorePValueMin ?? 0.05;
          const pMax = config.algo.explorePValueMax ?? 0.95;
          const abstractForConfirm = loadAbstractDisplayNames();
          const derivedTagsFiltered = abstractForConfirm.size > 0 ? derivedTags.filter((tag) => !getGroupDisplayNames(tag.displayName).some((dn) => abstractForConfirm.has(dn))) : derivedTags;
          const tagScores = derivedTagsFiltered.filter((tag) => tag.workTags.length > 0).map((tag) => {
            const p = tag.workTags.reduce((sum, wt) => {
              return sum + (probMap.get(wt.workId) || 0);
            }, 0);
            return {
              tag,
              p,
              distanceFromHalf: Math.abs(p - 0.5),
              top1Has: top1WorkId != null && tag.workTags.some((wt) => wt.workId === top1WorkId)
            };
          });
          const top1TagsInBand = tagScores.filter((t2) => t2.top1Has && t2.p >= pMin && t2.p <= pMax);
          const usableTags = top1TagsInBand.length > 0 ? top1TagsInBand : tagScores.filter((t2) => t2.p >= pMin && t2.p <= pMax);
          if (usableTags.length > 0) {
            usableTags.sort((a, b) => {
              if (a.distanceFromHalf !== b.distanceFromHalf) {
                return a.distanceFromHalf - b.distanceFromHalf;
              }
              return a.tag.tagKey.localeCompare(b.tag.tagKey);
            });
            const selectedTag = usableTags[0];
            const displayText = getTagQuestionText(
              selectedTag.tag.displayName,
              "DERIVED",
              selectedTag.tag.questionText
            );
            return {
              kind: "SOFT_CONFIRM",
              displayText,
              tagKey: selectedTag.tag.tagKey
            };
          } else {
            const fallback = await selectUnifiedExploreOrSummary(qIndex, weights, probabilities, questionHistory, config, usedSummaryIds, usedTagKeys);
            if (fallback) return fallback;
            return await selectExploreQuestion(weights, probabilities, questionHistory, config, buildExploreOptions(qIndex), usedTagKeys);
          }
        }
        if (confirmType === "HARD_CONFIRM" || derivedTags.length === 0) {
          const lastQuestion = questionHistory[questionHistory.length - 1];
          if (lastQuestion?.kind === "HARD_CONFIRM") {
            return await selectExploreQuestion(weights, probabilities, questionHistory, config, void 0, usedTagKeys);
          }
          const usedTitleInitials = new Set(
            questionHistory.filter((q) => q.kind === "HARD_CONFIRM" && q.hardConfirmType === "TITLE_INITIAL").map((q) => q.hardConfirmValue).filter((v) => v)
          );
          const usedAuthors = new Set(
            questionHistory.filter((q) => q.kind === "HARD_CONFIRM" && q.hardConfirmType === "AUTHOR").map((q) => q.hardConfirmValue).filter((v) => v)
          );
          const usedCharacterTagKeys = new Set(
            questionHistory.filter((q) => q.kind === "HARD_CONFIRM" && q.hardConfirmType === "CHARACTER").map((q) => q.hardConfirmValue).filter((v) => v)
          );
          const probsForTop1 = normalizeWeights(weights);
          const sortedByProb2 = [...probsForTop1].sort((a, b) => b.probability - a.probability);
          const topN = config.flow.titleInitialTopN ?? 1;
          const topWorkIds = sortedByProb2.slice(0, topN).map((p) => p.workId).filter(Boolean);
          if (topWorkIds.length === 0) {
            return await selectExploreQuestion(weights, probsForTop1, questionHistory, config, void 0, usedTagKeys);
          }
          const topWorks = _simWorkDataMap ? topWorkIds.map((id) => _simWorkDataMap.get(id)).filter((w) => w != null) : await prisma.work.findMany({
            where: { workId: { in: topWorkIds } },
            select: { workId: true, title: true, authorName: true }
          });
          const orderedWorks = topWorkIds.map((id) => topWorks.find((w) => w.workId === id)).filter((w) => w != null);
          if (orderedWorks.length === 0) {
            return await selectExploreQuestion(weights, probsForTop1, questionHistory, config, void 0, usedTagKeys);
          }
          const useRandomSelection = qIndex >= 21;
          const titleInitialCandidates = [];
          const authorCandidates = [];
          for (const w of orderedWorks) {
            const initial = normalizeTitleForInitial(w.title ?? "");
            if (!usedTitleInitials.has(initial)) titleInitialCandidates.push({ initial });
            const author = w.authorName ?? "(\u4E0D\u660E)";
            if (!usedAuthors.has(author)) authorCandidates.push({ author });
          }
          let characterCandidates = [];
          if (useRandomSelection) {
            const characterTags = isTagCacheReady() ? getTagsByTagKeys(getTagKeysByType("STRUCTURAL"), { tagTypes: ["STRUCTURAL"] }) : await prisma.tag.findMany({
              where: {
                tagType: "STRUCTURAL",
                category: { in: ["CHARACTER", "\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC"] }
              },
              select: { tagKey: true, displayName: true }
            });
            const characterTagKeys = new Set(characterTags.map((t2) => t2.tagKey));
            const topWorkTags = await fetchWorkTags(topWorkIds, {
              tagKeys: characterTagKeys.size > 0 ? [...characterTagKeys] : void 0
            });
            const charTagKeyToDisplay = new Map(characterTags.map((t2) => [t2.tagKey, t2.displayName ?? t2.tagKey]));
            const usedCharKeys = /* @__PURE__ */ new Set();
            for (const wt of topWorkTags) {
              if (characterTagKeys.has(wt.tagKey) && !usedCharacterTagKeys.has(wt.tagKey) && !usedCharKeys.has(wt.tagKey)) {
                usedCharKeys.add(wt.tagKey);
                characterCandidates.push({
                  tagKey: wt.tagKey,
                  displayName: charTagKeyToDisplay.get(wt.tagKey) ?? wt.tagKey
                });
              }
            }
          }
          if (useRandomSelection && (titleInitialCandidates.length > 0 || authorCandidates.length > 0 || characterCandidates.length > 0)) {
            const allCandidates = [];
            for (const c of titleInitialCandidates) allCandidates.push({ type: "TITLE_INITIAL", data: c });
            for (const c of authorCandidates) allCandidates.push({ type: "AUTHOR", data: c });
            for (const c of characterCandidates) allCandidates.push({ type: "CHARACTER", data: c });
            if (allCandidates.length > 0) {
              const chosen = allCandidates[Math.floor(Math.random() * allCandidates.length)];
              if (chosen.type === "TITLE_INITIAL") {
                const { initial } = chosen.data;
                return {
                  kind: "HARD_CONFIRM",
                  displayText: `\u30BF\u30A4\u30C8\u30EB\u304C\u300C${initial}\u300D\u304B\u3089\u59CB\u307E\u308B\uFF1F`,
                  hardConfirmType: "TITLE_INITIAL",
                  hardConfirmValue: initial
                };
              }
              if (chosen.type === "AUTHOR") {
                const { author } = chosen.data;
                return {
                  kind: "HARD_CONFIRM",
                  displayText: `\u2026\u2026\u3053\u306E\u4F5C\u54C1\u306E\u4F5C\u8005\uFF08\u30B5\u30FC\u30AF\u30EB\uFF09\u3001\u300C${author}\u300D\u304B\u3057\u3089\uFF1F`,
                  hardConfirmType: "AUTHOR",
                  hardConfirmValue: author
                };
              }
              if (chosen.type === "CHARACTER") {
                const { tagKey, displayName } = chosen.data;
                return {
                  kind: "HARD_CONFIRM",
                  displayText: CHARACTER_QUESTION_PATTERN(displayName),
                  hardConfirmType: "CHARACTER",
                  hardConfirmValue: tagKey
                };
              }
            }
          }
          for (const w of orderedWorks) {
            const initial = normalizeTitleForInitial(w.title ?? "");
            if (!usedTitleInitials.has(initial)) {
              return {
                kind: "HARD_CONFIRM",
                displayText: `\u30BF\u30A4\u30C8\u30EB\u304C\u300C${initial}\u300D\u304B\u3089\u59CB\u307E\u308B\uFF1F`,
                hardConfirmType: "TITLE_INITIAL",
                hardConfirmValue: initial
              };
            }
          }
          for (const w of orderedWorks) {
            const author = w.authorName ?? "(\u4E0D\u660E)";
            if (!usedAuthors.has(author)) {
              return {
                kind: "HARD_CONFIRM",
                displayText: `\u2026\u2026\u3053\u306E\u4F5C\u54C1\u306E\u4F5C\u8005\uFF08\u30B5\u30FC\u30AF\u30EB\uFF09\u3001\u300C${author}\u300D\u304B\u3057\u3089\uFF1F`,
                hardConfirmType: "AUTHOR",
                hardConfirmValue: author
              };
            }
          }
          const fallback = await selectUnifiedExploreOrSummary(qIndex, weights, probsForTop1, questionHistory, config, usedSummaryIds, usedTagKeys);
          if (fallback) return fallback;
          return await selectExploreQuestion(weights, probsForTop1, questionHistory, config, buildExploreOptions(qIndex), usedTagKeys);
        }
      } finally {
        perfEnd("selectNextQuestion_confirm", tConfirm);
      }
    }
    const hardConfirmInjectionRatio = config.flow.hardConfirmInjectionRatio ?? 0.25;
    if (qIndex >= 21 && typeof hardConfirmInjectionRatio === "number" && hardConfirmInjectionRatio > 0 && Math.random() < hardConfirmInjectionRatio) {
      const hardInjected = await tryGetHardConfirmQuestion(weights, probabilities, questionHistory, config, questionCount);
      if (hardInjected) return hardInjected;
    }
    const unified = await selectUnifiedExploreOrSummary(qIndex, weights, probabilities, questionHistory, config, usedSummaryIds, usedTagKeys);
    if (unified) return unified;
    const fallbackEnabled = config.algo.explorePValueFallbackEnabled !== false && getExplorePValueBand(config) != null;
    if (fallbackEnabled) {
      const hardFallback = await tryGetHardConfirmQuestion(weights, probabilities, questionHistory, config, questionCount);
      if (hardFallback) {
        return hardFallback;
      }
    }
    if (qIndex >= 4) {
      const exploreResult = await selectExploreQuestion(weights, probabilities, questionHistory, config, buildExploreOptions(qIndex), usedTagKeys);
      if (exploreResult) return exploreResult;
      if (fallbackEnabled) {
        const hardFallback = await tryGetHardConfirmQuestion(weights, probabilities, questionHistory, config, questionCount);
        if (hardFallback) return hardFallback;
      }
    }
    const emergency = await tryEmergencyExploreFallback(weights, questionHistory, usedTagKeys);
    if (emergency) return emergency;
    return null;
  } finally {
    perfEnd("selectNextQuestion", t);
  }
}
function buildExploreOptions(questionIndex) {
  return {
    questionIndex,
    abstractDisplayNames: loadAbstractDisplayNames(),
    eroticDisplayNames: loadEroticDisplayNames()
  };
}
function getExplorePValueBand(config) {
  const min = config.algo.explorePValueMin;
  const max = config.algo.explorePValueMax;
  if (min != null && max != null) return { pValueMin: min, pValueMax: max };
  return void 0;
}
async function tryGetHardConfirmQuestion(weights, probabilities, questionHistory, config, qIndex) {
  const t = perfStart("tryGetHardConfirmQuestion");
  try {
    const usedTitleInitials = new Set(
      questionHistory.filter((q) => q.kind === "HARD_CONFIRM" && q.hardConfirmType === "TITLE_INITIAL").map((q) => q.hardConfirmValue).filter((v) => v)
    );
    const usedAuthors = new Set(
      questionHistory.filter((q) => q.kind === "HARD_CONFIRM" && q.hardConfirmType === "AUTHOR").map((q) => q.hardConfirmValue).filter((v) => v)
    );
    const usedCharacterTagKeys = new Set(
      questionHistory.filter((q) => q.kind === "HARD_CONFIRM" && q.hardConfirmType === "CHARACTER").map((q) => q.hardConfirmValue).filter((v) => v)
    );
    const sorted = [...probabilities].sort((a, b) => b.probability - a.probability);
    const topN = config.flow.titleInitialTopN ?? 1;
    const effectiveTopN = qIndex >= 20 ? Math.max(topN, 10) : topN;
    const topWorkIds = sorted.slice(0, effectiveTopN).map((p) => p.workId).filter(Boolean);
    if (topWorkIds.length === 0) return null;
    const topWorks = _simWorkDataMap ? topWorkIds.map((id) => _simWorkDataMap.get(id)).filter((w) => w != null) : await prisma.work.findMany({
      where: { workId: { in: topWorkIds } },
      select: { workId: true, title: true, authorName: true }
    });
    const orderedWorks = topWorkIds.map((id) => topWorks.find((w) => w.workId === id)).filter((w) => w != null);
    const useRandomSelection = qIndex >= 20;
    const titleInitialCandidates = [];
    const authorCandidates = [];
    for (const w of orderedWorks) {
      const initial = normalizeTitleForInitial(w.title ?? "");
      if (!usedTitleInitials.has(initial)) titleInitialCandidates.push({ initial });
      const author = w.authorName ?? "(\u4E0D\u660E)";
      if (!usedAuthors.has(author)) authorCandidates.push({ author });
    }
    let characterCandidates = [];
    if (useRandomSelection) {
      const characterTags = isTagCacheReady() ? getTagsByTagKeys(getTagKeysByType("STRUCTURAL"), { tagTypes: ["STRUCTURAL"] }) : await prisma.tag.findMany({
        where: {
          tagType: "STRUCTURAL",
          category: { in: ["CHARACTER", "\u30AD\u30E3\u30E9\u30AF\u30BF\u30FC"] }
        },
        select: { tagKey: true, displayName: true }
      });
      const characterTagKeys = new Set(characterTags.map((t2) => t2.tagKey));
      const topWorkTags = await fetchWorkTags(topWorkIds, {
        tagKeys: characterTagKeys.size > 0 ? [...characterTagKeys] : void 0
      });
      const charTagKeyToDisplay = new Map(characterTags.map((t2) => [t2.tagKey, t2.displayName ?? t2.tagKey]));
      const usedCharKeys = /* @__PURE__ */ new Set();
      for (const wt of topWorkTags) {
        if (characterTagKeys.has(wt.tagKey) && !usedCharacterTagKeys.has(wt.tagKey) && !usedCharKeys.has(wt.tagKey)) {
          usedCharKeys.add(wt.tagKey);
          characterCandidates.push({
            tagKey: wt.tagKey,
            displayName: charTagKeyToDisplay.get(wt.tagKey) ?? wt.tagKey
          });
        }
      }
    }
    if (useRandomSelection && (titleInitialCandidates.length > 0 || authorCandidates.length > 0 || characterCandidates.length > 0)) {
      const allCandidates = [];
      for (const c of titleInitialCandidates) allCandidates.push({ type: "TITLE_INITIAL", data: c });
      for (const c of authorCandidates) allCandidates.push({ type: "AUTHOR", data: c });
      for (const c of characterCandidates) allCandidates.push({ type: "CHARACTER", data: c });
      if (allCandidates.length > 0) {
        const chosen = allCandidates[Math.floor(Math.random() * allCandidates.length)];
        if (chosen.type === "TITLE_INITIAL") {
          const { initial } = chosen.data;
          return {
            kind: "HARD_CONFIRM",
            displayText: `\u30BF\u30A4\u30C8\u30EB\u304C\u300C${initial}\u300D\u304B\u3089\u59CB\u307E\u308B\uFF1F`,
            hardConfirmType: "TITLE_INITIAL",
            hardConfirmValue: initial
          };
        }
        if (chosen.type === "AUTHOR") {
          const { author } = chosen.data;
          return {
            kind: "HARD_CONFIRM",
            displayText: `\u2026\u2026\u3053\u306E\u4F5C\u54C1\u306E\u4F5C\u8005\uFF08\u30B5\u30FC\u30AF\u30EB\uFF09\u3001\u300C${author}\u300D\u304B\u3057\u3089\uFF1F`,
            hardConfirmType: "AUTHOR",
            hardConfirmValue: author
          };
        }
        if (chosen.type === "CHARACTER") {
          const { tagKey, displayName } = chosen.data;
          return {
            kind: "HARD_CONFIRM",
            displayText: CHARACTER_QUESTION_PATTERN(displayName),
            hardConfirmType: "CHARACTER",
            hardConfirmValue: tagKey
          };
        }
      }
    }
    for (const w of orderedWorks) {
      const initial = normalizeTitleForInitial(w.title ?? "");
      if (!usedTitleInitials.has(initial)) {
        return {
          kind: "HARD_CONFIRM",
          displayText: `\u30BF\u30A4\u30C8\u30EB\u304C\u300C${initial}\u300D\u304B\u3089\u59CB\u307E\u308B\uFF1F`,
          hardConfirmType: "TITLE_INITIAL",
          hardConfirmValue: initial
        };
      }
    }
    for (const w of orderedWorks) {
      const author = w.authorName ?? "(\u4E0D\u660E)";
      if (!usedAuthors.has(author)) {
        return {
          kind: "HARD_CONFIRM",
          displayText: `\u2026\u2026\u3053\u306E\u4F5C\u54C1\u306E\u4F5C\u8005\uFF08\u30B5\u30FC\u30AF\u30EB\uFF09\u3001\u300C${author}\u300D\u304B\u3057\u3089\uFF1F`,
          hardConfirmType: "AUTHOR",
          hardConfirmValue: author
        };
      }
    }
    return null;
  } finally {
    perfEnd("tryGetHardConfirmQuestion", t);
  }
}
async function tryEmergencyExploreFallback(weights, questionHistory, usedTagKeys) {
  const t = perfStart("tryEmergencyExploreFallback");
  try {
    const workIds = weights.map((w) => w.workId);
    if (workIds.length === 0) return null;
    const workTags = await fetchWorkTags(workIds);
    const tagKeysFromWorks = new Set(workTags.map((wt) => wt.tagKey));
    let candidateTagKeys = Array.from(tagKeysFromWorks).filter((tk) => !usedTagKeys.has(tk));
    if (candidateTagKeys.length === 0) return null;
    const abstractSet = loadAbstractDisplayNames();
    if (abstractSet.size > 0) {
      const tagsForFilter = isTagCacheReady() ? candidateTagKeys.map((k) => getTagByKey(k)).filter((t2) => t2 != null) : await prisma.tag.findMany({
        where: { tagKey: { in: candidateTagKeys } },
        select: { tagKey: true, displayName: true }
      });
      const excludedKeys = new Set(
        tagsForFilter.filter((t2) => getGroupDisplayNames(t2.displayName).some((dn) => abstractSet.has(dn))).map((t2) => t2.tagKey)
      );
      candidateTagKeys = candidateTagKeys.filter((tk) => !excludedKeys.has(tk));
    }
    if (candidateTagKeys.length === 0) return null;
    const tagKey = candidateTagKeys[0];
    const tag = isTagCacheReady() ? getTagByKey(tagKey) : await prisma.tag.findUnique({
      where: { tagKey },
      select: { displayName: true, tagType: true, questionText: true }
    });
    if (!tag) return null;
    const eroticDisplayNames = loadEroticDisplayNames();
    const displayText = getTagQuestionText(
      tag.displayName,
      tag.tagType ?? void 0,
      tag.questionText
    );
    const exploreTagKind = eroticDisplayNames.has(tag.displayName) ? "erotic" : abstractSet.has(tag.displayName) ? "abstract" : "normal";
    return {
      kind: "EXPLORE_TAG",
      displayText,
      tagKey,
      exploreTagKind
    };
  } finally {
    perfEnd("tryEmergencyExploreFallback", t);
  }
}
async function buildUsedTagKeysFromHistory(questionHistory) {
  const displayNamesToMark = /* @__PURE__ */ new Set();
  const nonSummaryTagKeys = [];
  for (const q of questionHistory) {
    if (q.summaryDisplayNames?.length && q.answer === "NO") {
      for (const d of q.summaryDisplayNames) displayNamesToMark.add(d);
    } else if (q.tagKey) {
      nonSummaryTagKeys.push(q.tagKey);
    }
  }
  if (nonSummaryTagKeys.length > 0) {
    const tags2 = isTagCacheReady() ? getTagsByTagKeys([...new Set(nonSummaryTagKeys)]) : await prisma.tag.findMany({
      where: { tagKey: { in: [...new Set(nonSummaryTagKeys)] } },
      select: { displayName: true }
    });
    for (const tag of tags2) {
      if (tag.displayName) {
        const group = getGroupDisplayNames(tag.displayName);
        for (const d of group) displayNamesToMark.add(d);
      }
    }
  }
  if (displayNamesToMark.size === 0) return /* @__PURE__ */ new Set();
  const tags = isTagCacheReady() ? getTagsByDisplayNames(Array.from(displayNamesToMark)) : await prisma.tag.findMany({
    where: { displayName: { in: Array.from(displayNamesToMark) } },
    select: { tagKey: true }
  });
  return new Set(tags.map((t) => t.tagKey));
}
async function selectUnifiedExploreOrSummary(questionIndex, weights, probabilities, questionHistory, config, usedSummaryIds, usedTagKeys) {
  const t = perfStart("selectUnifiedExploreOrSummary");
  try {
    const workIds = weights.map((w) => w.workId);
    const totalWorks = weights.length;
    const abstractDisplayNames = loadAbstractDisplayNames();
    const eroticDisplayNames = loadEroticDisplayNames();
    const summaries = loadSummaryQuestions();
    let summaryCandidates = [];
    if (questionIndex >= 2 && questionIndex <= 3) {
      summaryCandidates = summaries.filter((s) => !usedSummaryIds.has(s.id) && !s.erotic);
    } else if (questionIndex >= 4 && questionIndex <= 5) {
      summaryCandidates = summaries.filter((s) => !usedSummaryIds.has(s.id));
    } else if (questionIndex >= 6) {
      summaryCandidates = summaries.filter((s) => !usedSummaryIds.has(s.id));
    }
    const allSummaryDisplayNames = /* @__PURE__ */ new Set();
    for (const s of summaryCandidates) for (const d of s.displayNames) allSummaryDisplayNames.add(d);
    const summaryDisplayNameToTagKeys = /* @__PURE__ */ new Map();
    if (allSummaryDisplayNames.size > 0) {
      const tagsInSummaries = isTagCacheReady() ? getTagsByDisplayNames(Array.from(allSummaryDisplayNames)) : await prisma.tag.findMany({
        where: { displayName: { in: Array.from(allSummaryDisplayNames) } },
        select: { tagKey: true, displayName: true }
      });
      for (const t2 of tagsInSummaries) {
        if (!summaryDisplayNameToTagKeys.has(t2.displayName)) {
          summaryDisplayNameToTagKeys.set(t2.displayName, []);
        }
        summaryDisplayNameToTagKeys.get(t2.displayName).push(t2.tagKey);
      }
    }
    const summaryTagKeysMap = /* @__PURE__ */ new Map();
    const allSummaryTagKeys = /* @__PURE__ */ new Set();
    for (const s of summaryCandidates) {
      const tagKeys = [];
      for (const dn of s.displayNames) {
        const keys = summaryDisplayNameToTagKeys.get(dn) ?? [];
        for (const k of keys) {
          tagKeys.push(k);
          allSummaryTagKeys.add(k);
        }
      }
      if (tagKeys.length > 0) summaryTagKeysMap.set(s.id, tagKeys);
    }
    const workTagsAll = await fetchWorkTags(workIds);
    const tagWorkCountMap = /* @__PURE__ */ new Map();
    for (const wt of workTagsAll) {
      tagWorkCountMap.set(wt.tagKey, (tagWorkCountMap.get(wt.tagKey) || 0) + 1);
    }
    let passingTagKeys = [];
    for (const [tagKey, workCount] of tagWorkCountMap.entries()) {
      if (SERIES_TAG_KEYS.includes(tagKey)) continue;
      if (usedTagKeys.has(tagKey)) continue;
      if (!passesCoverageGate(workCount, totalWorks, config.dataQuality.minCoverageMode, config.dataQuality.minCoverageRatio, config.dataQuality.minCoverageWorks, config.dataQuality.maxCoverageRatio ?? null)) continue;
      passingTagKeys.push(tagKey);
    }
    if (passingTagKeys.length > 0) {
      const tagsForFilter = isTagCacheReady() ? getTagsByTagKeys(passingTagKeys) : await prisma.tag.findMany({
        where: { tagKey: { in: passingTagKeys } },
        select: { tagKey: true, displayName: true }
      });
      passingTagKeys = passingTagKeys.filter((tagKey) => {
        const tag = tagsForFilter.find((t2) => t2.tagKey === tagKey);
        if (!tag) return true;
        const group = getGroupDisplayNames(tag.displayName);
        if (group.some((dn) => abstractDisplayNames.has(dn))) return false;
        if (questionIndex < 4 && eroticDisplayNames.has(tag.displayName)) return false;
        return true;
      });
    }
    const allTagKeysForWork = /* @__PURE__ */ new Set([...allSummaryTagKeys, ...passingTagKeys]);
    const workTagMap = /* @__PURE__ */ new Map();
    for (const wt of workTagsAll) {
      if (!allTagKeysForWork.has(wt.tagKey)) continue;
      if (!workTagMap.has(wt.workId)) workTagMap.set(wt.workId, /* @__PURE__ */ new Set());
      workTagMap.get(wt.workId).add(wt.tagKey);
    }
    const workHasTag = (workId, key) => {
      if (key.startsWith("summary:")) {
        const id = key.slice(8);
        const sTagKeys = summaryTagKeysMap.get(id);
        if (!sTagKeys?.length) return false;
        const workSet = workTagMap.get(workId);
        if (!workSet) return false;
        return sTagKeys.some((tk) => workSet.has(tk));
      }
      return workTagMap.get(workId)?.has(key) ?? false;
    };
    const availableTags = [];
    for (const s of summaryCandidates) {
      if (!summaryTagKeysMap.has(s.id)) continue;
      let workCount = 0;
      for (const wid of workIds) {
        if (workHasTag(wid, "summary:" + s.id)) workCount++;
      }
      availableTags.push({
        tagKey: "summary:" + s.id,
        displayName: s.label,
        tagType: "OFFICIAL",
        workCount
      });
    }
    if (questionIndex >= 6 && passingTagKeys.length > 0) {
      const allTags = isTagCacheReady() ? getTagsByTagKeys(passingTagKeys) : await prisma.tag.findMany({
        where: { tagKey: { in: passingTagKeys } },
        select: { tagKey: true, displayName: true, tagType: true }
      });
      for (const tag of allTags) {
        const workCount = tagWorkCountMap.get(tag.tagKey) || 0;
        availableTags.push({
          tagKey: tag.tagKey,
          displayName: tag.displayName,
          tagType: tag.tagType || "DERIVED",
          workCount
        });
      }
    }
    if (availableTags.length === 0) return null;
    let tagsForSelection = availableTags;
    const summaryPreferRatio = config.flow.summaryPreferRatio ?? 0;
    if (summaryPreferRatio > 0 && Math.random() < summaryPreferRatio) {
      const summaryOnly = availableTags.filter((t2) => t2.tagKey.startsWith("summary:"));
      if (summaryOnly.length > 0) {
        tagsForSelection = summaryOnly;
      }
    }
    let consecutiveNoCount = 0;
    for (let i = questionHistory.length - 1; i >= 0; i--) {
      const ans = questionHistory[i].answer;
      if (ans === "NO") consecutiveNoCount++;
      else break;
    }
    const consecutiveNoForAtari = config.flow.consecutiveNoForAtari ?? 3;
    const preferHighP = consecutiveNoCount >= consecutiveNoForAtari;
    const useIG = config.algo.useIGForExploreSelection !== false;
    const pValueBand = getExplorePValueBand(config);
    let selectedKey;
    const effectiveCandidates = calculateEffectiveCandidates(probabilities);
    const topNIGThreshold = 100;
    const topNForIG = 20;
    const probsForIG = effectiveCandidates < topNIGThreshold && effectiveCandidates > 0 ? (() => {
      const sorted = [...probabilities].sort((a, b) => b.probability - a.probability);
      const topN = sorted.slice(0, Math.min(topNForIG, sorted.length));
      const sum = topN.reduce((s, p) => s + p.probability, 0);
      return sum > 0 ? topN.map((p) => ({ workId: p.workId, probability: p.probability / sum })) : probabilities;
    })() : probabilities;
    if (useIG && !preferHighP) {
      const tagsForIG = pValueBand ? filterTagsByPValueBandForIG(tagsForSelection, probsForIG, workHasTag, pValueBand) : tagsForSelection;
      selectedKey = selectExploreTagByIG(tagsForIG, probsForIG, workHasTag, pValueBand);
    } else {
      selectedKey = selectExploreTag(
        tagsForSelection,
        probabilities,
        workHasTag,
        0,
        null,
        pValueBand,
        preferHighP
      );
    }
    if (!selectedKey && pValueBand) {
      if (useIG && !preferHighP) {
        selectedKey = selectExploreTagByIG(tagsForSelection, probsForIG, workHasTag, void 0);
      } else {
        selectedKey = selectExploreTag(
          tagsForSelection,
          probabilities,
          workHasTag,
          0,
          null,
          void 0,
          preferHighP
        );
      }
    }
    if (!selectedKey) return null;
    if (selectedKey.startsWith("summary:")) {
      const id = selectedKey.slice(8);
      const summary = summaryCandidates.find((s) => s.id === id);
      if (!summary) return null;
      const tags = isTagCacheReady() ? getTagsByDisplayNames(summary.displayNames) : await prisma.tag.findMany({
        where: { displayName: { in: summary.displayNames } },
        select: { tagKey: true },
        take: 1
      });
      const tagKey = tags[0]?.tagKey ?? null;
      if (!tagKey) return null;
      return {
        kind: "EXPLORE_TAG",
        displayText: summary.questionText,
        tagKey,
        isSummaryQuestion: true,
        summaryQuestionId: summary.id,
        summaryDisplayNames: summary.displayNames,
        exploreTagKind: "summary"
      };
    }
    const selectedTag = isTagCacheReady() ? getTagByKey(selectedKey) : await prisma.tag.findUnique({
      where: { tagKey: selectedKey },
      select: { displayName: true, tagType: true, questionText: true }
    });
    if (!selectedTag) return null;
    const displayText = getTagQuestionText(
      selectedTag.displayName,
      selectedTag.tagType ?? void 0,
      selectedTag.questionText
    );
    const exploreTagKind = eroticDisplayNames.has(selectedTag.displayName) ? "erotic" : abstractDisplayNames.has(selectedTag.displayName) ? "abstract" : "normal";
    return {
      kind: "EXPLORE_TAG",
      displayText,
      tagKey: selectedKey,
      exploreTagKind
    };
  } finally {
    perfEnd("selectUnifiedExploreOrSummary", t);
  }
}
async function selectExploreQuestion(weights, probabilities, questionHistory, config, options, usedTagKeys) {
  const t = perfStart("selectExploreQuestion");
  try {
    const opts = options ?? buildExploreOptions(questionHistory.length + 1);
    const { summaryOnlyTagKeys, questionIndex = opts.questionIndex ?? 0, abstractDisplayNames = /* @__PURE__ */ new Set(), eroticDisplayNames = /* @__PURE__ */ new Set() } = opts;
    const abstractSet = abstractDisplayNames.size > 0 ? abstractDisplayNames : loadAbstractDisplayNames();
    const eroticSet = eroticDisplayNames.size > 0 ? eroticDisplayNames : loadEroticDisplayNames();
    const resolvedUsedTagKeys = usedTagKeys ?? await buildUsedTagKeysFromHistory(questionHistory);
    const workIds = weights.map((w) => w.workId);
    const totalWorks = weights.length;
    const workTags = await fetchWorkTags(workIds);
    const tagWorkCountMap = /* @__PURE__ */ new Map();
    for (const wt of workTags) {
      tagWorkCountMap.set(wt.tagKey, (tagWorkCountMap.get(wt.tagKey) || 0) + 1);
    }
    let passingTagKeys = [];
    for (const [tagKey, workCount] of tagWorkCountMap.entries()) {
      if (SERIES_TAG_KEYS.includes(tagKey)) continue;
      if (!resolvedUsedTagKeys.has(tagKey) && passesCoverageGate(
        workCount,
        totalWorks,
        config.dataQuality.minCoverageMode,
        config.dataQuality.minCoverageRatio,
        config.dataQuality.minCoverageWorks,
        config.dataQuality.maxCoverageRatio ?? null
        // 上限（未設定の場合はチェックなし）
      )) {
        passingTagKeys.push(tagKey);
      }
    }
    if (summaryOnlyTagKeys && summaryOnlyTagKeys.size > 0) {
      passingTagKeys = passingTagKeys.filter((k) => summaryOnlyTagKeys.has(k));
    }
    if (passingTagKeys.length === 0) return null;
    const allTagsRaw = isTagCacheReady() ? getTagsByTagKeys(passingTagKeys, { tagTypes: ["OFFICIAL", "DERIVED"] }) : await prisma.tag.findMany({
      where: {
        tagKey: { in: passingTagKeys },
        tagType: { in: ["OFFICIAL", "DERIVED"] }
      },
      select: {
        tagKey: true,
        displayName: true,
        tagType: true,
        questionText: true
      }
    });
    let allTags = allTagsRaw.map((t2) => ({
      tagKey: t2.tagKey,
      displayName: t2.displayName,
      tagType: t2.tagType ?? "DERIVED",
      questionText: t2.questionText
    }));
    if (allTags.length === 0 && passingTagKeys.length > 0 && !isTagCacheReady()) {
      try {
        const sqlite3 = require_lib();
        const path6 = require("path");
        const dbPath = path6.join(process.cwd(), "prisma", "dev.db");
        const db = sqlite3(dbPath, { readonly: true });
        const placeholders = passingTagKeys.map(() => "?").join(",");
        allTags = db.prepare(`
        SELECT tagKey, displayName, tagType, questionText
        FROM Tag
        WHERE tagKey IN (${placeholders})
          AND tagType IN ('OFFICIAL', 'DERIVED')
      `).all(...passingTagKeys);
        db.close();
      } catch (directError) {
        console.error("[selectExploreQuestion] Error in direct SQLite fallback:", directError);
      }
    }
    const availableTags = [];
    for (const tag of allTags) {
      if (resolvedUsedTagKeys.has(tag.tagKey)) continue;
      if (isTagBanned(tag.displayName)) continue;
      if (getGroupDisplayNames(tag.displayName).some((dn) => abstractSet.has(dn))) continue;
      if (questionIndex < 4 && eroticSet.has(tag.displayName)) {
        continue;
      }
      const workCount = tagWorkCountMap.get(tag.tagKey) || 0;
      availableTags.push({
        tagKey: tag.tagKey,
        displayName: tag.displayName,
        tagType: tag.tagType,
        workCount
      });
    }
    if (availableTags.length === 0) return null;
    const passingTagKeysSet = new Set(passingTagKeys);
    const workTagMap = /* @__PURE__ */ new Map();
    for (const wt of workTags) {
      if (passingTagKeysSet.has(wt.tagKey)) {
        if (!workTagMap.has(wt.workId)) {
          workTagMap.set(wt.workId, /* @__PURE__ */ new Set());
        }
        workTagMap.get(wt.workId).add(wt.tagKey);
      }
    }
    const workHasTag = (workId, tagKey) => {
      const tags = workTagMap.get(workId);
      if (!tags) return false;
      return tags.has(tagKey);
    };
    const sorted = [...probabilities].sort((a, b) => {
      if (a.probability !== b.probability) {
        return b.probability - a.probability;
      }
      return a.workId.localeCompare(b.workId);
    });
    const confidence = sorted[0]?.probability ?? 0;
    const topWorkId = sorted[0]?.workId ?? null;
    const pValueBand = getExplorePValueBand(config);
    const useIG = config.algo.useIGForExploreSelection !== false;
    const effectiveCandidates = calculateEffectiveCandidates(probabilities);
    const topNIGThreshold = 100;
    const topNForIG = 20;
    const probsForIG = useIG && effectiveCandidates < topNIGThreshold && effectiveCandidates > 0 ? (() => {
      const sorted2 = [...probabilities].sort((a, b) => b.probability - a.probability);
      const topN = sorted2.slice(0, Math.min(topNForIG, sorted2.length));
      const sum = topN.reduce((s, p) => s + p.probability, 0);
      return sum > 0 ? topN.map((p) => ({ workId: p.workId, probability: p.probability / sum })) : probabilities;
    })() : probabilities;
    const tagsForIG = useIG && pValueBand ? filterTagsByPValueBandForIG(availableTags, probsForIG, workHasTag, pValueBand) : availableTags;
    const selectedTagKey = useIG ? selectExploreTagByIG(tagsForIG, probsForIG, workHasTag, pValueBand) : selectExploreTag(
      availableTags,
      probabilities,
      workHasTag,
      confidence,
      topWorkId,
      pValueBand
    );
    if (!selectedTagKey) {
      return null;
    }
    const selectedTag = allTags.find((t2) => t2.tagKey === selectedTagKey);
    if (!selectedTag) {
      return null;
    }
    const displayText = getTagQuestionText(
      selectedTag.displayName,
      selectedTag.tagType,
      selectedTag.questionText
    );
    const exploreTagKind = eroticSet.has(selectedTag.displayName) ? "erotic" : abstractSet.has(selectedTag.displayName) ? "abstract" : "normal";
    return {
      kind: "EXPLORE_TAG",
      displayText,
      tagKey: selectedTagKey,
      exploreTagKind
    };
  } finally {
    perfEnd("selectExploreQuestion", t);
  }
}
function getBayesianEpsilon(effectiveCandidates, config) {
  const phases = config.algo.bayesianEpsilonPhases;
  if (phases) {
    if (effectiveCandidates > 200) return phases.early;
    if (effectiveCandidates > 20) return phases.mid;
    return phases.late;
  }
  return config.algo.bayesianEpsilon ?? 0.02;
}
async function processAnswer(weights, question, answerChoice, config, options) {
  const t = perfStart("processAnswer");
  try {
    await ensureTagCacheLoaded();
    const probabilities = normalizeWeights(weights);
    const effectiveCandidates = calculateEffectiveCandidates(probabilities);
    const epsilon = getBayesianEpsilon(effectiveCandidates, config);
    const strengthMap = {
      YES: 1,
      PROBABLY_YES: 0.6,
      UNKNOWN: 0,
      PROBABLY_NO: -0.6,
      NO: -1,
      DONT_CARE: 0
    };
    let strength = strengthMap[answerChoice] ?? 0;
    const isSummaryQuestion = !!question.isSummaryQuestion;
    if (isSummaryQuestion) {
      const scale = config.algo.summaryQuestionStrengthScale ?? 0.6;
      strength = (strength > 0 ? 1 : strength < 0 ? -1 : 0) * scale;
    } else if (question.kind === "EXPLORE_TAG") {
      strength *= config.algo.exploreTagStrengthScale ?? 1;
    } else if (question.kind === "SOFT_CONFIRM") {
      strength *= config.algo.softConfirmStrengthScale ?? 1;
    }
    if (question.kind === "SPECIAL_QUESTION" && question.specialQuestionType === "SERIES") {
      const seriesTagKeys = question.seriesTagKeys ?? ["off_e1f6b6c9ce", "off_ad42c1ba79"];
      const workIds = weights.map((w) => w.workId);
      const workTags = await fetchWorkTags(workIds, { tagKeys: seriesTagKeys });
      const workTagMap = /* @__PURE__ */ new Map();
      for (const wt of workTags) {
        if (!workTagMap.has(wt.workId)) workTagMap.set(wt.workId, /* @__PURE__ */ new Set());
        workTagMap.get(wt.workId).add(wt.tagKey);
      }
      const workHasFeature = (workId) => {
        const tags = workTagMap.get(workId);
        return !!tags && seriesTagKeys.some((tk) => tags.has(tk));
      };
      const useBayesian = config.algo.useBayesianUpdate !== false;
      if (useBayesian) {
        return updateWeightsForTagQuestionBayesian(weights, workHasFeature, answerChoice, epsilon);
      }
      return updateWeightsForTagQuestion(
        weights,
        workHasFeature,
        strength,
        config.algo.beta
      );
    }
    if (question.kind === "SPECIAL_QUESTION" && question.specialQuestionType === "TITLE_CHAR_TYPE") {
      const expectedCharType = question.titleCharType;
      const workIds = weights.map((w) => w.workId);
      let workMap;
      if (options?.workInfoMap) {
        workMap = options.workInfoMap;
      } else {
        const works = await prisma.work.findMany({
          where: { workId: { in: workIds } },
          select: { workId: true, title: true, authorName: true }
        });
        workMap = new Map(works.map((w) => [w.workId, w]));
      }
      const workHasFeature = (workId) => {
        const work = workMap.get(workId);
        if (!work) return false;
        const charType = getTitleCharType(work.title ?? "");
        if (expectedCharType === "HIRAGANA_OR_KATAKANA") {
          return charType === "HIRAGANA" || charType === "KATAKANA";
        }
        return charType === expectedCharType;
      };
      const useBayesian = config.algo.useBayesianUpdate !== false;
      if (useBayesian) {
        return updateWeightsForTagQuestionBayesian(weights, workHasFeature, answerChoice, epsilon);
      }
      return updateWeightsForTagQuestion(
        weights,
        workHasFeature,
        strength,
        config.algo.beta
      );
    }
    if (question.kind === "SPECIAL_QUESTION" && question.specialQuestionType === "POPULARITY") {
      const threshold = question.popularityThreshold ?? 40;
      const workIds = weights.map((w) => w.workId);
      const works = _simWorkDataMap ? workIds.map((id) => _simWorkDataMap.get(id)).filter((w) => w != null) : await prisma.work.findMany({
        where: { workId: { in: workIds } },
        select: { workId: true, popularityBase: true, popularityPlayBonus: true }
      });
      const worksMap = new Map(works.map((w) => [w.workId, w]));
      const workPopularity = (workId) => {
        const w = worksMap.get(workId);
        if (!w) return 0;
        return (w.popularityBase ?? 0) + (w.popularityPlayBonus ?? 0);
      };
      return updateWeightsForPopularitySoft(weights, workPopularity, threshold, answerChoice, 0.15, epsilon);
    }
    if (question.kind === "SPECIAL_QUESTION" && question.specialQuestionType === "TITLE_SYLLABLE") {
      const syllableChars = question.syllableChars ?? [];
      const charSet = new Set(syllableChars);
      const workIds = weights.map((w) => w.workId);
      const works = _simWorkDataMap ? workIds.map((id) => _simWorkDataMap.get(id)).filter((w) => w != null) : await prisma.work.findMany({
        where: { workId: { in: workIds } },
        select: { workId: true, titleReadingInitial: true }
      });
      const worksMap = new Map(works.map((w) => [w.workId, w]));
      const workHasFeature = (workId) => {
        const w = worksMap.get(workId);
        const initials = getTitleReadingInitials(w?.titleReadingInitial);
        if (initials.length === 0) return false;
        return initials.some((c) => charSet.has(c));
      };
      const useBayesian = config.algo.useBayesianUpdate !== false;
      if (useBayesian) {
        return updateWeightsForTagQuestionBayesian(weights, workHasFeature, answerChoice, epsilon);
      }
      return updateWeightsForTagQuestion(
        weights,
        workHasFeature,
        strength,
        config.algo.beta
      );
    }
    if (question.kind === "SPECIAL_QUESTION" && question.specialQuestionType === "TITLE_SYLLABLE_2") {
      const syllableChars = question.syllableChars ?? [];
      const charSet = new Set(syllableChars);
      const workIds = weights.map((w) => w.workId);
      const works = _simWorkDataMap ? workIds.map((id) => _simWorkDataMap.get(id)).filter((w) => w != null) : await prisma.work.findMany({
        where: { workId: { in: workIds } },
        select: { workId: true, titleReadingInitial: true }
      });
      const worksMap = new Map(works.map((w) => [w.workId, w]));
      const workHasFeature = (workId) => {
        const w = worksMap.get(workId);
        const initials = getTitleReadingInitials(w?.titleReadingInitial);
        if (initials.length === 0) return false;
        return initials.some((c) => charSet.has(c));
      };
      const useBayesian = config.algo.useBayesianUpdate !== false;
      if (useBayesian) {
        return updateWeightsForTagQuestionBayesian(weights, workHasFeature, answerChoice, epsilon);
      }
      return updateWeightsForTagQuestion(
        weights,
        workHasFeature,
        strength,
        config.algo.beta
      );
    }
    if (question.kind === "SPECIAL_QUESTION" && question.specialQuestionType === "AUTHOR_CHAR_TYPE") {
      const expectedCharType = question.authorCharType;
      const workIds = weights.map((w) => w.workId);
      let workMap;
      if (options?.workInfoMap) {
        workMap = options.workInfoMap;
      } else {
        const works = await prisma.work.findMany({
          where: { workId: { in: workIds } },
          select: { workId: true, title: true, authorName: true }
        });
        workMap = new Map(works.map((w) => [w.workId, w]));
      }
      const workHasFeature = (workId) => {
        const work = workMap.get(workId);
        if (!work) return false;
        const ct = getAuthorCharType(work.authorName ?? "");
        if (expectedCharType === "HIRAGANA_OR_KATAKANA") {
          return ct === "HIRAGANA" || ct === "KATAKANA";
        }
        return ct === "KANJI" || ct === "ALPHA";
      };
      const useBayesian = config.algo.useBayesianUpdate !== false;
      if (useBayesian) {
        return updateWeightsForTagQuestionBayesian(weights, workHasFeature, answerChoice, epsilon);
      }
      return updateWeightsForTagQuestion(
        weights,
        workHasFeature,
        strength,
        config.algo.beta
      );
    }
    if (question.kind === "EXPLORE_TAG" || question.kind === "SOFT_CONFIRM") {
      const tagKey = question.tagKey;
      const workIds = weights.map((w) => w.workId);
      const summaryDisplayNames = question.summaryDisplayNames;
      let groupDisplayNames;
      if (summaryDisplayNames?.length) {
        groupDisplayNames = summaryDisplayNames;
      } else {
        const askedTag = isTagCacheReady() ? getTagByKey(tagKey) : await prisma.tag.findUnique({
          where: { tagKey },
          select: { displayName: true }
        });
        const displayName = askedTag?.displayName ?? tagKey;
        groupDisplayNames = getGroupDisplayNames(displayName);
      }
      const groupTags = isTagCacheReady() ? getTagsByDisplayNames(groupDisplayNames) : await prisma.tag.findMany({
        where: { displayName: { in: groupDisplayNames } },
        select: { tagKey: true }
      });
      const groupTagKeys = groupTags.map((t2) => t2.tagKey);
      const workTags = await fetchWorkTags(workIds, {
        tagKeys: groupTagKeys.length > 0 ? groupTagKeys : [tagKey]
      });
      const workTagMap = /* @__PURE__ */ new Map();
      for (const wt of workTags) {
        if (!workTagMap.has(wt.workId)) workTagMap.set(wt.workId, []);
        workTagMap.get(wt.workId).push(wt.derivedConfidence);
      }
      const workHasFeature = (workId) => {
        const confs = workTagMap.get(workId);
        if (!confs || confs.length === 0) return false;
        const anyPass = confs.some((derivedConf) => {
          if (question.kind === "SOFT_CONFIRM") {
            return hasDerivedFeature(derivedConf, config.algo.derivedConfidenceThreshold);
          }
          if (derivedConf === void 0) return false;
          if (derivedConf === null) return true;
          return hasDerivedFeature(derivedConf, config.algo.derivedConfidenceThreshold);
        });
        return anyPass;
      };
      const useBayesian = config.algo.useBayesianUpdate !== false;
      if (useBayesian) {
        return updateWeightsForTagQuestionBayesian(weights, workHasFeature, answerChoice, epsilon);
      }
      return updateWeightsForTagQuestion(
        weights,
        workHasFeature,
        strength,
        config.algo.beta
      );
    } else {
      const expectedValue = question.hardConfirmValue;
      const hardConfirmType = question.hardConfirmType;
      const workIds = weights.map((w) => w.workId);
      let workMap;
      if (options?.workInfoMap) {
        workMap = options.workInfoMap;
      } else {
        const works = await prisma.work.findMany({
          where: { workId: { in: workIds } },
          select: { workId: true, title: true, authorName: true }
        });
        workMap = new Map(works.map((w) => [w.workId, w]));
      }
      let workHasFeature;
      if (hardConfirmType === "TITLE_INITIAL") {
        workHasFeature = (workId) => {
          const work = workMap.get(workId);
          if (!work) return false;
          const initial = normalizeTitleForInitial(work.title ?? "");
          return initial === expectedValue;
        };
      } else if (hardConfirmType === "AUTHOR") {
        workHasFeature = (workId) => {
          const work = workMap.get(workId);
          if (!work) return false;
          return (work.authorName ?? "") === expectedValue;
        };
      } else {
        let tagKeyMap;
        if (options?.workTagMap) {
          tagKeyMap = options.workTagMap;
        } else {
          const workTags = await fetchWorkTags(workIds, { tagKeys: [expectedValue] });
          tagKeyMap = /* @__PURE__ */ new Map();
          for (const wt of workTags) {
            if (!tagKeyMap.has(wt.workId)) tagKeyMap.set(wt.workId, /* @__PURE__ */ new Set());
            tagKeyMap.get(wt.workId).add(wt.tagKey);
          }
        }
        workHasFeature = (workId) => {
          const tags = tagKeyMap.get(workId);
          return !!tags?.has(expectedValue);
        };
      }
      const useBayesian = config.algo.useBayesianUpdate !== false;
      if (useBayesian) {
        return updateWeightsForTagQuestionBayesian(weights, workHasFeature, answerChoice, epsilon);
      }
      return updateWeightsForTagQuestion(
        weights,
        workHasFeature,
        strength,
        config.algo.beta
      );
    }
  } finally {
    perfEnd("processAnswer", t);
  }
}

// src/server/config/loader.ts
var import_fs5 = require("fs");
var import_path5 = require("path");

// node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType
});

// node_modules/zod/v3/helpers/util.js
var util;
(function(util2) {
  util2.assertEqual = (_) => {
  };
  function assertIs(_arg) {
  }
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};

// node_modules/zod/v3/ZodError.js
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};
var ZodError = class _ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof _ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        const firstEl = sub.path[0];
        fieldErrors[firstEl] = fieldErrors[firstEl] || [];
        fieldErrors[firstEl].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
};
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};

// node_modules/zod/v3/locales/en.js
var errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "bigint")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
var en_default = errorMap;

// node_modules/zod/v3/errors.js
var overrideErrorMap = en_default;
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}

// node_modules/zod/v3/helpers/parseUtil.js
var makeIssue = (params) => {
  const { data, path: path6, errorMaps, issueData } = params;
  const fullPath = [...path6, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
var ParseStatus = class _ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return _ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
};
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = (value) => ({ status: "dirty", value });
var OK = (value) => ({ status: "valid", value });
var isAborted = (x) => x.status === "aborted";
var isDirty = (x) => x.status === "dirty";
var isValid = (x) => x.status === "valid";
var isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;

// node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
})(errorUtil || (errorUtil = {}));

// node_modules/zod/v3/types.js
var ParseInputLazyPath = class {
  constructor(parent, value, path6, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path6;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (Array.isArray(this._key)) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
};
var handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
var ZodType = class {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    const ctx = {
      common: {
        issues: [],
        async: params?.async ?? false,
        contextualErrorMap: params?.errorMap
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err) {
        if (err?.message?.toLowerCase()?.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params?.errorMap,
        async: true
      },
      path: params?.path || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
var ZodString = class _ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      offset: options?.offset ?? false,
      local: options?.local ?? false,
      ...errorUtil.errToObj(options?.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof options?.precision === "undefined" ? null : options?.precision,
      ...errorUtil.errToObj(options?.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options?.position,
      ...errorUtil.errToObj(options?.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodString.create = (params) => {
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
var ZodNumber = class _ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null;
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
};
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodBigInt = class _ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
ZodBigInt.create = (params) => {
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: params?.coerce ?? false,
    ...processCreateParams(params)
  });
};
var ZodBoolean = class extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: params?.coerce || false,
    ...processCreateParams(params)
  });
};
var ZodDate = class _ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (Number.isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new _ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
};
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: params?.coerce || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
var ZodSymbol = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
var ZodUndefined = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
var ZodNull = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
var ZodAny = class extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
var ZodUnknown = class extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
var ZodNever = class extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
};
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
var ZodVoid = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
var ZodArray = class _ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new _ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new _ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new _ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
var ZodObject = class _ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    this._cached = { shape, keys };
    return this._cached;
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") {
      } else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue, ctx) => {
          const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: errorUtil.errToObj(message).message ?? defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new _ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new _ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new _ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    for (const key of util.objectKeys(mask)) {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    for (const key of util.objectKeys(this.shape)) {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    }
    return new _ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
};
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
var ZodUnion = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
};
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = (type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [void 0];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
};
var ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new _ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
};
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
var ZodIntersection = class extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
};
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
var ZodTuple = class _ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new _ZodTuple({
      ...this._def,
      rest
    });
  }
};
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
var ZodRecord = class _ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new _ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new _ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
};
var ZodMap = class extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
};
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
var ZodSet = class _ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new _ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new _ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
var ZodFunction = class _ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new _ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new _ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new _ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
};
var ZodLazy = class extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
};
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
var ZodLiteral = class extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
};
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
var ZodEnum = class _ZodEnum extends ZodType {
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(this._def.values);
    }
    if (!this._cache.has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return _ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
};
ZodEnum.create = createZodEnum;
var ZodNativeEnum = class extends ZodType {
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!this._cache) {
      this._cache = new Set(util.getValidEnumValues(this._def.values));
    }
    if (!this._cache.has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
};
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
var ZodPromise = class extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
};
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
var ZodEffects = class extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return INVALID;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return INVALID;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
            status: status.value,
            value: result
          }));
        });
      }
    }
    util.assertNever(effect);
  }
};
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
var ZodOptional = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
var ZodNullable = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
var ZodDefault = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
var ZodCatch = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
var ZodNaN = class extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
};
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = /* @__PURE__ */ Symbol("zod_brand");
var ZodBranded = class extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
};
var ZodPipeline = class _ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new _ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
};
var ZodReadonly = class extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params);
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = () => stringType().optional();
var onumber = () => numberType().optional();
var oboolean = () => booleanType().optional();
var coerce = {
  string: ((arg) => ZodString.create({ ...arg, coerce: true })),
  number: ((arg) => ZodNumber.create({ ...arg, coerce: true })),
  boolean: ((arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  })),
  bigint: ((arg) => ZodBigInt.create({ ...arg, coerce: true })),
  date: ((arg) => ZodDate.create({ ...arg, coerce: true }))
};
var NEVER = INVALID;

// src/server/config/schema.ts
var ConfirmSchema = external_exports.object({
  revealThreshold: external_exports.number().min(0).max(1),
  confidenceConfirmBand: external_exports.tuple([external_exports.number().min(0).max(1), external_exports.number().min(0).max(1)]).refine(
    (val) => val[0] <= val[1],
    { message: "confidenceConfirmBand[0] must be <= confidenceConfirmBand[1]" }
  ),
  qForcedIndices: external_exports.array(external_exports.number().int().positive()),
  softConfidenceMin: external_exports.number().min(0).max(1),
  hardConfidenceMin: external_exports.number().min(0).max(1)
}).strict();
var AlgoSchema = external_exports.object({
  beta: external_exports.number().positive(),
  alpha: external_exports.number().min(0).max(1),
  derivedConfidenceThreshold: external_exports.number().min(0).max(1),
  revealPenalty: external_exports.number().positive().max(1),
  /** EXPLORE_TAGでp値がこの範囲外のタグは出題しない。未設定時はフィルタなし */
  explorePValueMin: external_exports.number().min(0).max(1).optional(),
  explorePValueMax: external_exports.number().min(0).max(1).optional(),
  /** p値が範囲内のタグが無いときHARD_CONFIRM/REVEALにフォールバックする */
  explorePValueFallbackEnabled: external_exports.boolean().optional(),
  /** まとめ質問の回答強度のスケール。1.0=通常タグと同程度、0.6=控えめ。未設定時0.6 */
  summaryQuestionStrengthScale: external_exports.number().positive().optional(),
  /** EXPLORE_TAG（まとめ以外）の回答強度のスケール。1.0=変更なし。未設定時1.0 */
  exploreTagStrengthScale: external_exports.number().positive().optional(),
  /** SOFT_CONFIRMの回答強度のスケール。1.0=変更なし。未設定時1.0 */
  softConfirmStrengthScale: external_exports.number().positive().optional(),
  /**
   * EXPLORE_TAGの質問選択を情報利得(IG)で行う。false なら従来の p≈0.5 に近いタグを選ぶ。
   * ロールバック時は false にすると従来挙動に戻る。未設定時は true（IGを使用）。
   */
  useIGForExploreSelection: external_exports.boolean().optional(),
  /**
   * タグ質問・HARD_CONFIRMの重み更新をベイズ（事後確率）で行う。false なら従来の強度×beta。
   * ロールバック時は false にすると従来挙動に戻る。未設定時は true（ベイズを使用）。
   */
  useBayesianUpdate: external_exports.boolean().optional(),
  /**
   * ベイズ更新時の尤度の下限（確率0で殺さない）。0.02 なら尤度は [0.02, 0.98]。未設定時 0.02。
   * bayesianEpsilonPhases が設定されている場合はフェーズ別に上書き。
   */
  bayesianEpsilon: external_exports.number().min(0).max(0.5).optional(),
  /**
   * P4: フェーズ別イプシロン。EC（effectiveCandidates）に応じて epsilon を変える。
   * 前半 EC>200 → early, 中盤 20<EC<=200 → mid, 後半 EC<=20 → late。
   * 未設定時は bayesianEpsilon を全フェーズで使用。
   */
  bayesianEpsilonPhases: external_exports.object({
    early: external_exports.number().min(0).max(0.5),
    mid: external_exports.number().min(0).max(0.5),
    late: external_exports.number().min(0).max(0.5)
  }).strict().optional()
}).strict();
var FlowSchema = external_exports.object({
  maxQuestions: external_exports.number().int().positive(),
  maxRevealMisses: external_exports.number().int().positive(),
  failListN: external_exports.number().int().positive(),
  effectiveConfirmThresholdFormula: external_exports.enum(["A"]),
  effectiveConfirmThresholdParams: external_exports.object({
    min: external_exports.number().int().positive(),
    max: external_exports.number().int().positive(),
    divisor: external_exports.number().int().positive()
  }).strict().refine(
    (val) => val.max >= val.min,
    { message: "effectiveConfirmThresholdParams.max must be >= min" }
  ),
  /** 連続NOがこの数以上なら次の1問は「当たり」狙い（p高めのタグを選ぶ）。未設定時は3 */
  consecutiveNoForAtari: external_exports.number().int().min(1).optional(),
  /** まとめ質問を優先して選ぶ確率。0〜1。未設定時は0（優先なし） */
  summaryPreferRatio: external_exports.number().min(0).max(1).optional(),
  /**
   * HARD_CONFIRMでタイトル頭文字・作者を選ぶとき、確度順の上位何件の作品から選ぶか。
   * - 1: 確度1位のみ（従来どおり）。正解が1位になればその頭文字を聞ける。
   * - 2以上: 1位〜N位から未使用の頭文字・作者を順に選ぶ。バリエーションは増えるが、
   *   正解がtop-Nに入らないと正解の頭文字を聞けずMAX_QUESTIONSで終わるリスクあり。
   * 推奨: 2か3で試す。未設定時は1。
   */
  titleInitialTopN: external_exports.number().int().min(1).optional(),
  /**
   * 21問目以降、unified の前に HARD_CONFIRM（タイトル頭文字・作者・キャラ）を試す確率。0〜1。0で無効。未設定時は 0.25。
   */
  hardConfirmInjectionRatio: external_exports.number().min(0).max(1).optional(),
  /**
   * Special Question を挿入する質問番号（1-based）。例: [3, 5, 9, 16] で Q3, Q5, Q9, Q16。
   * 未設定時は [3, 5, 9, 16]。
   */
  specialQuestionSlotIndices: external_exports.array(external_exports.number().int().positive()).optional(),
  /**
   * 救済特別質問（Q20, Q24）: 絞り込めていない場合のみ TITLE_SYLLABLE_2 / AUTHOR_CHAR_TYPE を挿入。
   * 未設定時は無効。
   */
  rescueSpecialCondition: external_exports.object({
    slotIndices: external_exports.array(external_exports.number().int().positive()),
    effectiveCandidatesMin: external_exports.number().positive(),
    confidenceMax: external_exports.number().min(0).max(1)
  }).strict().optional()
}).strict();
var DataQualitySchema = external_exports.object({
  minCoverageMode: external_exports.enum(["RATIO", "WORKS", "AUTO"]),
  minCoverageRatio: external_exports.number().min(0).max(1).nullable(),
  minCoverageWorks: external_exports.number().int().nonnegative().nullable(),
  maxCoverageRatio: external_exports.number().min(0).max(1).nullable().optional()
  // 上限（全員持っているタグを除外）
}).strict();
var PopularitySchema = external_exports.object({
  playBonusOnSuccess: external_exports.number().nonnegative()
}).strict();
var ThinkingSchema = external_exports.object({
  /** 複数文言の表示方法: random=ランダム, sequential=順番 */
  displayMode: external_exports.enum(["random", "sequential"]),
  early: external_exports.array(external_exports.string()).min(1).max(5),
  mid: external_exports.array(external_exports.string()).min(1).max(5),
  late: external_exports.array(external_exports.string()).min(1).max(5),
  closing: external_exports.array(external_exports.string()).min(1).max(5)
}).strict();
var MvpConfigSchema = external_exports.object({
  version: external_exports.literal("v1.5"),
  thinking: ThinkingSchema.optional(),
  confirm: ConfirmSchema,
  algo: AlgoSchema,
  flow: FlowSchema,
  dataQuality: DataQualitySchema,
  popularity: PopularitySchema
}).strict();

// src/server/config/loader.ts
function loadMvpConfig() {
  const configPath = (0, import_path5.join)(process.cwd(), "config", "mvpConfig.json");
  try {
    const fileContent = (0, import_fs5.readFileSync)(configPath, "utf-8");
    const rawConfig = JSON.parse(fileContent);
    const result = MvpConfigSchema.safeParse(rawConfig);
    if (!result.success) {
      const errors = result.error.errors.map(
        (e) => `${e.path.join(".")}: ${e.message}`
      ).join("\n");
      throw new Error(
        `Config validation failed (\u30B9\u30AD\u30FC\u30DE\u5916\u30AD\u30FC\u307E\u305F\u306F\u578B\u4E0D\u4E00\u81F4):
${errors}`
      );
    }
    return result.data;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load config from ${configPath}: ${error.message}`);
    }
    throw error;
  }
}
var configInstance = null;
function getMvpConfig() {
  if (!configInstance) {
    configInstance = loadMvpConfig();
  }
  return configInstance;
}

// src/server/simulation/simulationRunner.ts
function getCorrectAnswer(question, targetWork, targetTags, targetWorkTags) {
  if (question.kind === "SPECIAL_QUESTION" && question.specialQuestionType === "SERIES") {
    const seriesTagKeys = question.seriesTagKeys ?? ["off_e1f6b6c9ce", "off_ad42c1ba79"];
    return seriesTagKeys.some((tk) => targetTags.has(tk)) ? "YES" : "NO";
  }
  if (question.kind === "SPECIAL_QUESTION" && question.specialQuestionType === "TITLE_CHAR_TYPE") {
    const targetCharType = getTitleCharType(targetWork.title ?? "");
    const expectedCharType = question.titleCharType ?? "KANJI";
    if (expectedCharType === "HIRAGANA_OR_KATAKANA") {
      return targetCharType === "HIRAGANA" || targetCharType === "KATAKANA" ? "YES" : "NO";
    }
    return targetCharType === expectedCharType ? "YES" : "NO";
  }
  if (question.kind === "SPECIAL_QUESTION" && question.specialQuestionType === "POPULARITY") {
    const threshold = question.popularityThreshold ?? 30;
    const pop = (targetWork.popularityBase ?? 0) + (targetWork.popularityPlayBonus ?? 0);
    return pop >= threshold ? "YES" : "NO";
  }
  if (question.kind === "SPECIAL_QUESTION" && question.specialQuestionType === "TITLE_SYLLABLE") {
    const syllableChars = question.syllableChars ?? [];
    const initials = getTitleReadingInitials(targetWork.titleReadingInitial);
    const fallback = getTitleReadingInitialFromTitle(targetWork.title ?? "");
    const toCheck = initials.length > 0 ? initials : fallback ? [fallback] : [];
    return toCheck.some((c) => syllableChars.includes(c)) ? "YES" : "NO";
  }
  if (question.kind === "SPECIAL_QUESTION" && question.specialQuestionType === "TITLE_SYLLABLE_2") {
    const syllableChars = question.syllableChars ?? [];
    const initials = getTitleReadingInitials(targetWork.titleReadingInitial);
    const fallback = getTitleReadingInitialFromTitle(targetWork.title ?? "");
    const toCheck = initials.length > 0 ? initials : fallback ? [fallback] : [];
    return toCheck.some((c) => syllableChars.includes(c)) ? "YES" : "NO";
  }
  if (question.kind === "SPECIAL_QUESTION" && question.specialQuestionType === "AUTHOR_CHAR_TYPE") {
    const ct = getAuthorCharType(targetWork.authorName ?? "");
    const expectedCharType = question.authorCharType ?? "HIRAGANA_OR_KATAKANA";
    if (expectedCharType === "HIRAGANA_OR_KATAKANA") {
      return ct === "HIRAGANA" || ct === "KATAKANA" ? "YES" : "NO";
    }
    return ct === "KANJI" || ct === "ALPHA" ? "YES" : "NO";
  }
  if (question.kind === "EXPLORE_TAG" || question.kind === "SOFT_CONFIRM") {
    const summaryDisplayNames = question.summaryDisplayNames;
    const isSummaryQuestion = !!question.isSummaryQuestion || (summaryDisplayNames?.length ?? 0) > 0;
    let hasTag;
    if (isSummaryQuestion && summaryDisplayNames?.length) {
      const targetDisplayNames = new Set(targetWorkTags.map((t) => t.displayName));
      hasTag = summaryDisplayNames.some((d) => targetDisplayNames.has(d));
    } else {
      hasTag = targetTags.has(question.tagKey);
    }
    return hasTag ? "YES" : "NO";
  }
  if (question.kind === "HARD_CONFIRM") {
    if (question.hardConfirmType === "TITLE_INITIAL") {
      const targetInitial = normalizeTitleForInitial(targetWork.title ?? "");
      const questionInitial = question.hardConfirmValue ?? "";
      return targetInitial === questionInitial ? "YES" : "NO";
    }
    if (question.hardConfirmType === "CHARACTER") {
      const tagKey = question.hardConfirmValue ?? "";
      return targetTags.has(tagKey) ? "YES" : "NO";
    }
    return (targetWork.authorName ?? "") === question.hardConfirmValue ? "YES" : "NO";
  }
  return "DONT_CARE";
}
function pickAnswerFromAmbiguity(correctAnswer, ambiguityLevel, questionKind) {
  const L = Math.max(1, Math.min(10, Math.round(ambiguityLevel)));
  if (L === 1) return correctAnswer;
  const wrongRate = 0.0133 * (L - 1);
  const correctRate = L <= 9 ? 1 - 0.1 * (L - 1) : 0.08;
  const vagueRate = 1 - correctRate - wrongRate;
  const isSoft = questionKind === "SOFT_CONFIRM";
  const w = isSoft ? 0.5 : 1;
  const wrong = wrongRate * w;
  const vague = vagueRate * w;
  const correct = 1 - wrong - vague;
  const r = Math.random();
  if (r < correct) return correctAnswer;
  if (r < correct + wrong) return correctAnswer === "YES" ? "NO" : "YES";
  const v = r - correct - wrong;
  if (v < vague * 0.75) return correctAnswer === "YES" ? "PROBABLY_YES" : "PROBABLY_NO";
  if (v < vague * 0.9) return correctAnswer === "YES" ? "PROBABLY_NO" : "PROBABLY_YES";
  return "UNKNOWN";
}
async function runSimulation(targetWorkId, ambiguityLevel, aiGateChoice, config, sharedContext, includePerf = false) {
  try {
    const targetWorkBase = sharedContext.workDetailMap.get(targetWorkId);
    const targetWorkTagsRaw = sharedContext.workTagMap.get(targetWorkId);
    if (!targetWorkBase) return null;
    const targetWork = {
      ...targetWorkBase,
      title: targetWorkBase.title ?? "(\u4E0D\u660E)",
      workTags: (targetWorkTagsRaw ?? []).map((t) => ({
        tagKey: t.tagKey,
        derivedConfidence: t.derivedConfidence,
        tag: { displayName: t.displayName, tagType: t.tagType }
      }))
    };
    const targetTags = new Set(targetWork.workTags.map((wt) => wt.tagKey));
    const targetWorkTagsForAnswer = targetWork.workTags.map((wt) => ({ displayName: wt.tag.displayName }));
    const workDetails = {
      workId: targetWork.workId,
      title: targetWork.title,
      authorName: targetWork.authorName,
      isAi: targetWork.isAi,
      popularityBase: targetWork.popularityBase,
      reviewCount: targetWork.reviewCount,
      reviewAverage: targetWork.reviewAverage,
      commentText: targetWork.commentText,
      tags: targetWork.workTags.map((wt) => ({
        tagKey: wt.tagKey,
        displayName: wt.tag.displayName,
        tagType: wt.tag.tagType,
        derivedConfidence: wt.derivedConfidence
      }))
    };
    const allWorks = sharedContext.allWorks;
    const workTitleMap = sharedContext.workTitleMap;
    const workInfoMap = new Map(
      allWorks.map((w) => [w.workId, { title: w.title, authorName: w.authorName }])
    );
    const filteredWorks = filterWorksByAiGate(
      allWorks.map((w) => ({
        workId: w.workId,
        isAi: w.isAi
      })),
      aiGateChoice
    );
    const workMap = new Map(allWorks.map((w) => [w.workId, w]));
    let weights = filteredWorks.filter((workId) => workMap.has(workId)).map((workId) => {
      const work = workMap.get(workId);
      return { workId, weight: (work.popularityBase ?? 1) + (work.popularityPlayBonus ?? 0) };
    });
    const steps = [];
    const questionHistory = [];
    let questionCount = 0;
    let outcome = "MAX_QUESTIONS";
    let finalWorkId = null;
    let revealMissCount = 0;
    let endedBy = "OTHER";
    const revealedWrongWorkIds = /* @__PURE__ */ new Set();
    const perfAcc = createPerfAccumulator(includePerf);
    await runWithPerfAccumulator(perfAcc, async () => {
      const simT = perfStart("runSimulation");
      while (true) {
        const probabilities = normalizeWeights(weights);
        const sorted = [...probabilities].sort((a, b) => {
          if (a.probability !== b.probability) return b.probability - a.probability;
          return a.workId.localeCompare(b.workId);
        });
        const confidence = sorted[0]?.probability ?? 0;
        const topWorkId = sorted[0]?.workId ?? "";
        const effectiveCandidates = calculateEffectiveCandidates(probabilities);
        if (questionCount >= getEffectiveMaxQuestions(config.flow.maxQuestions, confidence, {
          questionHistory,
          effectiveCandidates,
          questionCount
        })) break;
        const question = await selectNextQuestion(weights, probabilities, questionCount, questionHistory, config);
        if (!question) {
          endedBy = "NO_MORE_QUESTIONS";
          const forceRevealWorkId = sorted[0]?.workId;
          if (forceRevealWorkId) {
            const revealWorkTitle = workTitleMap.get(forceRevealWorkId) ?? "(\u4E0D\u660E)";
            const isCorrect = forceRevealWorkId === targetWorkId;
            steps.push({
              qIndex: questionCount,
              question: { kind: "REVEAL", displayText: `(\u5F37\u5236) \u3053\u306E\u4F5C\u54C1\u306F\u300C${revealWorkTitle}\u300D\u3067\u3059\u304B\uFF1F`, specialQuestionType: void 0, hardConfirmType: void 0 },
              answer: isCorrect ? "CORRECT" : "WRONG",
              wasNoisy: false,
              confidenceBefore: confidence,
              confidenceAfter: confidence,
              top1WorkId: forceRevealWorkId,
              top1Probability: confidence,
              revealWorkId: forceRevealWorkId,
              revealWorkTitle,
              revealResult: isCorrect ? "SUCCESS" : "MISS"
            });
            outcome = isCorrect ? "SUCCESS" : "FAIL_LIST";
            finalWorkId = forceRevealWorkId;
          } else {
            outcome = "FAIL_LIST";
          }
          break;
        }
        questionCount++;
        const qIndex = questionCount;
        const correctAnswer = getCorrectAnswer(
          question,
          targetWork,
          targetTags,
          targetWorkTagsForAnswer
        );
        const baseAnswer = correctAnswer;
        const actualAnswer = question.kind === "HARD_CONFIRM" ? baseAnswer : pickAnswerFromAmbiguity(baseAnswer, ambiguityLevel, question.kind);
        const wasNoisy = actualAnswer !== baseAnswer;
        let consecutiveNoCountBatch = 0;
        for (let i = questionHistory.length - 1; i >= 0; i--) {
          if (questionHistory[i]?.answer === "NO") consecutiveNoCountBatch++;
          else break;
        }
        const consecutiveNoForAtariBatch = config.flow.consecutiveNoForAtari ?? 5;
        const preferHighPBatch = consecutiveNoCountBatch >= consecutiveNoForAtariBatch;
        questionHistory.push({
          qIndex,
          kind: question.kind,
          tagKey: question.tagKey,
          hardConfirmType: question.hardConfirmType,
          hardConfirmValue: question.hardConfirmValue,
          isSummaryQuestion: question.isSummaryQuestion,
          summaryQuestionId: question.summaryQuestionId,
          summaryDisplayNames: question.summaryDisplayNames,
          answer: actualAnswer,
          exploreTagKind: question.exploreTagKind,
          specialQuestionType: question.specialQuestionType,
          seriesTagKeys: question.seriesTagKeys,
          titleCharType: question.titleCharType,
          popularityThreshold: question.popularityThreshold,
          syllableChars: question.syllableChars,
          authorCharType: question.authorCharType
        });
        let tagCoverage;
        if (question.tagKey) {
          const tagCovT = perfStart("tagCoverage");
          const workIds = weights.map((w) => w.workId);
          const tagWorkIds = new Set(getWorkTagsFromMatrix(workIds, { tagKeys: [question.tagKey] }).map((wt) => wt.workId));
          tagCoverage = probabilities.filter((p) => tagWorkIds.has(p.workId)).reduce((sum, p) => sum + p.probability, 0);
          perfEnd("tagCoverage", tagCovT);
        }
        weights = await processAnswer(weights, question, actualAnswer, config, { workInfoMap });
        const newProbabilities = normalizeWeights(weights);
        const newSorted = [...newProbabilities].sort((a, b) => {
          if (a.probability !== b.probability) return b.probability - a.probability;
          return a.workId.localeCompare(b.workId);
        });
        const newConfidence = newSorted[0]?.probability ?? 0;
        const q = question;
        const syllableChars = q.kind === "SPECIAL_QUESTION" ? q.syllableChars : void 0;
        const rangeId = q.kind === "SPECIAL_QUESTION" && q.titleSyllableRangeId ? q.titleSyllableRangeId : syllableChars?.length ? (() => {
          const ranges = getTitleSyllableRanges();
          const charSet = new Set(syllableChars);
          for (const r of ranges) {
            const rSet = new Set(r.chars ?? []);
            if (rSet.size > 0 && rSet.size === charSet.size && [...rSet].every((c) => charSet.has(c))) {
              return r.id ?? void 0;
            }
          }
          return void 0;
        })() : void 0;
        steps.push({
          qIndex,
          question: {
            kind: q.kind,
            displayText: q.displayText,
            tagKey: q.tagKey,
            hardConfirmType: q.hardConfirmType,
            hardConfirmValue: q.hardConfirmValue,
            exploreTagKind: q.kind === "EXPLORE_TAG" ? q.exploreTagKind : void 0,
            specialQuestionType: q.kind === "SPECIAL_QUESTION" ? q.specialQuestionType : void 0,
            titleCharType: q.kind === "SPECIAL_QUESTION" ? q.titleCharType : void 0,
            authorCharType: q.kind === "SPECIAL_QUESTION" ? q.authorCharType : void 0,
            titleSyllableRangeId: rangeId,
            titleSyllable2RangeId: q.kind === "SPECIAL_QUESTION" ? q.titleSyllable2RangeId : void 0,
            titleSyllable2Branch: q.kind === "SPECIAL_QUESTION" ? q.titleSyllable2Branch : void 0
          },
          answer: actualAnswer,
          wasNoisy,
          confidenceBefore: confidence,
          confidenceAfter: newConfidence,
          top1WorkId: topWorkId,
          top1Probability: confidence,
          tagCoverage,
          effectiveCandidates: calculateEffectiveCandidates(probabilities),
          preferHighP: question.kind === "EXPLORE_TAG" ? preferHighPBatch : void 0
        });
        const revealThreshold = getRevealThresholdForQuestion(questionCount - 1, config.confirm.revealThreshold);
        if (newConfidence >= revealThreshold) {
          const revealWorkId = newSorted.find((p) => !revealedWrongWorkIds.has(p.workId))?.workId ?? null;
          if (revealWorkId) {
            const revealWorkTitle = workTitleMap.get(revealWorkId) ?? "(\u4E0D\u660E)";
            const isCorrect = revealWorkId === targetWorkId;
            steps.push({
              qIndex: questionCount,
              question: {
                kind: "REVEAL",
                displayText: `\u65AD\u5B9A: \u3053\u306E\u4F5C\u54C1\u306F\u300C${revealWorkTitle}\u300D\u3067\u3059\u304B\uFF1F`,
                specialQuestionType: void 0,
                hardConfirmType: void 0
              },
              answer: isCorrect ? "CORRECT" : "WRONG",
              wasNoisy: false,
              confidenceBefore: newConfidence,
              confidenceAfter: newConfidence,
              top1WorkId: revealWorkId,
              top1Probability: newConfidence,
              revealWorkId,
              revealWorkTitle,
              revealResult: isCorrect ? "SUCCESS" : "MISS",
              effectiveCandidates: calculateEffectiveCandidates(newProbabilities)
            });
            if (isCorrect) {
              endedBy = "REVEAL";
              outcome = "SUCCESS";
              finalWorkId = revealWorkId;
              break;
            } else {
              revealedWrongWorkIds.add(revealWorkId);
              revealMissCount++;
              if (revealMissCount >= config.flow.maxRevealMisses) {
                endedBy = "REVEAL";
                outcome = "FAIL_LIST";
                finalWorkId = revealWorkId;
                break;
              }
              weights = weights.map((w) => ({
                workId: w.workId,
                weight: w.workId === revealWorkId ? w.weight * config.algo.revealPenalty : w.weight
              }));
            }
          }
        }
      }
      perfEnd("runSimulation", simT);
    });
    if (outcome === "MAX_QUESTIONS" && questionCount >= config.flow.maxQuestions) {
      endedBy = "MAX_QUESTIONS";
      const finalProbs = normalizeWeights(weights);
      const finalSorted = [...finalProbs].sort((a, b) => {
        if (a.probability !== b.probability) return b.probability - a.probability;
        return a.workId.localeCompare(b.workId);
      });
      const forceRevealId = finalSorted.find((p) => !revealedWrongWorkIds.has(p.workId))?.workId ?? finalSorted[0]?.workId;
      const forceRevealConf = finalSorted.find((p) => p.workId === forceRevealId)?.probability ?? finalSorted[0]?.probability ?? 0;
      if (forceRevealId) {
        const revealWorkTitle = workTitleMap.get(forceRevealId) ?? "(\u4E0D\u660E)";
        const isCorrect = forceRevealId === targetWorkId;
        steps.push({
          qIndex: questionCount,
          question: { kind: "REVEAL", displayText: `(maxQuestions\u5F37\u5236) \u3053\u306E\u4F5C\u54C1\u306F\u300C${revealWorkTitle}\u300D\u3067\u3059\u304B\uFF1F`, specialQuestionType: void 0, hardConfirmType: void 0 },
          answer: isCorrect ? "CORRECT" : "WRONG",
          wasNoisy: false,
          confidenceBefore: forceRevealConf,
          confidenceAfter: forceRevealConf,
          top1WorkId: forceRevealId,
          top1Probability: forceRevealConf,
          revealWorkId: forceRevealId,
          revealWorkTitle,
          revealResult: isCorrect ? "SUCCESS" : "MISS",
          effectiveCandidates: calculateEffectiveCandidates(finalProbs)
        });
        outcome = isCorrect ? "SUCCESS" : "MAX_QUESTIONS";
        finalWorkId = forceRevealId;
      }
    }
    const finalProbsDiag = normalizeWeights(weights);
    const sortedDiag = [...finalProbsDiag].sort((a, b) => {
      if (a.probability !== b.probability) return b.probability - a.probability;
      return a.workId.localeCompare(b.workId);
    });
    const correctRankIdx = sortedDiag.findIndex((p) => p.workId === targetWorkId);
    const diagnostic = {
      endedBy,
      correctRank: correctRankIdx === -1 ? -1 : correctRankIdx + 1,
      correctStillInCandidates: weights.some((w) => w.workId === targetWorkId),
      top1Confidence: sortedDiag[0]?.probability ?? 0,
      candidatesCount: weights.length
    };
    let finalWorkTitle = null;
    if (finalWorkId) {
      finalWorkTitle = workTitleMap.get(finalWorkId) ?? null;
    }
    const noisySteps = steps.filter((s) => s.wasNoisy);
    const firstNoisyIdx = noisySteps.length > 0 ? steps.findIndex((s) => s.wasNoisy) : -1;
    const analysisData = {
      wasNoisyCount: noisySteps.length,
      firstNoisyStepIndex: firstNoisyIdx,
      noisyStepIndices: steps.filter((s) => s.wasNoisy).map((s) => s.qIndex),
      correctRank: diagnostic.correctRank,
      top1Confidence: diagnostic.top1Confidence,
      totalQuestions: questionCount,
      noisyRatio: questionCount > 0 ? noisySteps.length / questionCount : 0
    };
    const perfSummary = toPerfSummary(perfAcc);
    return {
      success: outcome === "SUCCESS",
      targetWorkId,
      targetWorkTitle: targetWork.title,
      finalWorkId,
      finalWorkTitle,
      questionCount,
      steps,
      outcome,
      diagnostic,
      analysisData,
      workDetails,
      ...perfSummary && { perfSummary }
    };
  } catch (error) {
    console.error("Error in runSimulation:", error);
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      targetWorkId,
      targetWorkTitle: "(\u5B9F\u884C\u30A8\u30E9\u30FC)",
      finalWorkId: null,
      finalWorkTitle: null,
      questionCount: 0,
      steps: [],
      outcome: "ERROR",
      errorMessage: message
    };
  }
}

// src/server/simulation/simulationWorker.ts
async function main() {
  const input = import_worker_threads.workerData;
  const bytes = new Uint8Array(input.sharedBuffer);
  const jsonStr = new TextDecoder().decode(bytes);
  const shared = JSON.parse(jsonStr);
  if (shared.workTagMatrixData) {
    setWorkTagMatrixDirect(shared.workTagMatrixData);
  }
  if (shared.tagCacheData.length > 0) {
    setTagCacheDirect(shared.tagCacheData);
  }
  setSimWorkDataMap(new Map(shared.simWorkDataEntries));
  const sharedContext = {
    allWorks: shared.sharedContextSerialized.allWorks,
    workTitleMap: new Map(shared.sharedContextSerialized.workTitleEntries),
    workDetailMap: new Map(shared.sharedContextSerialized.workDetailEntries),
    workTagMap: new Map(shared.sharedContextSerialized.workTagEntries)
  };
  const config = getMvpConfig();
  const { tasks, level, aiGateChoice, includePerf, taskIndexBuffer } = input;
  const taskIndexView = new Int32Array(taskIndexBuffer);
  const results = [];
  while (true) {
    const index = Atomics.add(taskIndexView, 0, 1);
    if (index >= tasks.length) break;
    const { targetWorkId } = tasks[index];
    try {
      const simResult = await runSimulation(targetWorkId, level, aiGateChoice, config, sharedContext, includePerf);
      if (simResult) {
        results.push({
          workId: simResult.targetWorkId,
          title: simResult.targetWorkTitle,
          success: simResult.success,
          questionCount: simResult.questionCount,
          outcome: simResult.outcome,
          steps: simResult.steps,
          workDetails: simResult.workDetails,
          diagnostic: simResult.diagnostic,
          analysisData: simResult.analysisData,
          errorMessage: simResult.errorMessage,
          perfSummary: simResult.perfSummary
        });
      }
    } catch {
      results.push({
        workId: targetWorkId,
        title: "",
        success: false,
        questionCount: 0,
        outcome: "ERROR",
        errorMessage: "Worker simulation error"
      });
    }
    import_worker_threads.parentPort?.postMessage({ type: "progress", done: index + 1, total: tasks.length });
  }
  import_worker_threads.parentPort?.postMessage({ type: "done", results, totalWorksInDb: sharedContext.allWorks.length });
}
main().catch((err) => {
  import_worker_threads.parentPort?.postMessage({ type: "error", message: err instanceof Error ? err.message : String(err) });
});
