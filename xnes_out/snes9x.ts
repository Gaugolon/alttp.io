const printErr = undefined;

const warnOnce = {
  shown: ''
};

var Module = (function () {
  var _scriptDir = undefined;
  // var _scriptDir = typeof document !== 'undefined' && document.currentScript ?
  //   document.currentScript.src :
  //   undefined;
  return (
    function (Module) {
      Module = Module || {};
      var Module = typeof Module !== "undefined" ? Module : {};
      var moduleOverrides = {};
      var key;
      for (key in Module) {
        if (Module.hasOwnProperty(key)) {
          moduleOverrides[key] = Module[key]
        }
      }
      Module["arguments"] = [];
      Module["thisProgram"] = "./this.program";
      Module["quit"] = function (status, toThrow) {
        throw toThrow
      };
      Module["preRun"] = [];
      Module["postRun"] = [];
      var ENVIRONMENT_IS_WEB = false;
      var ENVIRONMENT_IS_WORKER = false;
      var ENVIRONMENT_IS_NODE = true;
      var scriptDirectory = "";

      function locateFile(path) {
        if (Module["locateFile"]) {
          return Module["locateFile"](path, scriptDirectory)
        } else {
          return scriptDirectory + path
        }
      }
      if (ENVIRONMENT_IS_NODE) {
        scriptDirectory = __dirname + "/";
        var nodeFS;
        var nodePath;
        Module["read"] = function shell_read(filename, binary) {
          var ret;
          if (!nodeFS) nodeFS = require("fs");
          if (!nodePath) nodePath = require("path");
          filename = nodePath["normalize"](filename);
          ret = nodeFS["readFileSync"](filename);
          return binary ? ret : ret.toString()
        };
        Module["readBinary"] = function readBinary(filename) {
          var ret = Module["read"](filename, true);
          if (!ret.buffer) {
            ret = new Uint8Array(ret)
          }
          assert(ret.buffer);
          return ret
        };
        if (process["argv"].length > 1) {
          Module["thisProgram"] = process["argv"][1].replace(/\\/g, "/")
        }
        Module["arguments"] = process["argv"].slice(2);
        process["on"]("uncaughtException", function (ex) {
          if (!(ex instanceof ExitStatus)) {
            throw ex
          }
        });
        process["on"]("unhandledRejection", abort);
        Module["quit"] = function (status) {
          process["exit"](status)
        };
        Module["inspect"] = function () {
          return "[Emscripten Module object]"
        }
      } else { }
      var out = Module["print"] || (typeof console !== "undefined" ? console.log.bind(console) : typeof print !== "undefined" ? print : null);
      var err = Module["printErr"] || (typeof printErr !== "undefined" ? printErr : typeof console !== "undefined" && console.warn.bind(console) || out);
      for (key in moduleOverrides) {
        if (moduleOverrides.hasOwnProperty(key)) {
          Module[key] = moduleOverrides[key]
        }
      }
      moduleOverrides = undefined;

      function dynamicAlloc(size) {
        var ret = HEAP32[DYNAMICTOP_PTR >> 2];
        var end = ret + size + 15 & -16;
        if (end <= _emscripten_get_heap_size()) {
          HEAP32[DYNAMICTOP_PTR >> 2] = end
        } else {
          var success = _emscripten_resize_heap(end);
          if (!success) return 0
        }
        return ret
      }

      function getNativeTypeSize(type) {
        switch (type) {
          case "i1":
          case "i8":
            return 1;
          case "i16":
            return 2;
          case "i32":
            return 4;
          case "i64":
            return 8;
          case "float":
            return 4;
          case "double":
            return 8;
          default:
            {
              if (type[type.length - 1] === "*") {
                return 4
              } else if (type[0] === "i") {
                var bits = parseInt(type.substr(1));
                assert(bits % 8 === 0, "getNativeTypeSize invalid bits " + bits + ", type " + type);
                return bits / 8
              } else {
                return 0
              }
            }
        }
      }

      const warnOnce = (text): void => err(text);

      var asm2wasmImports = {
        "f64-rem": function (x, y) {
          return x % y
        },
        "debugger": function () {
          debugger
        }
      };
      var functionPointers = new Array(0);
      if (typeof WebAssembly !== "object") {
        err("no native wasm support detected")
      }
      var wasmMemory;
      var wasmTable;
      var ABORT = false;
      var EXITSTATUS = 0;

      function assert(condition, text?) {
        if (!condition) {
          abort("Assertion failed: " + text)
        }
      }

      function getCFunc(ident) {
        var func = Module["_" + ident];
        assert(func, "Cannot call unknown function " + ident + ", make sure it is exported");
        return func
      }

      function ccall(ident, returnType, argTypes, args, opts) {
        var toC = {
          "string": function (str) {
            var ret = 0;
            if (str !== null && str !== undefined && str !== 0) {
              var len = (str.length << 2) + 1;
              ret = stackAlloc(len);
              stringToUTF8(str, ret, len)
            }
            return ret
          },
          "array": function (arr) {
            var ret = stackAlloc(arr.length);
            writeArrayToMemory(arr, ret);
            return ret
          }
        };

        function convertReturnValue(ret) {
          if (returnType === "string") return UTF8ToString(ret);
          if (returnType === "boolean") return Boolean(ret);
          return ret
        }
        var func = getCFunc(ident);
        var cArgs = [];
        var stack = 0;
        if (args) {
          for (var i = 0; i < args.length; i++) {
            var converter = toC[argTypes[i]];
            if (converter) {
              if (stack === 0) stack = stackSave();
              cArgs[i] = converter(args[i])
            } else {
              cArgs[i] = args[i]
            }
          }
        }
        var ret = func.apply(null, cArgs);
        ret = convertReturnValue(ret);
        if (stack !== 0) stackRestore(stack);
        return ret
      }

      function cwrap(ident, returnType, argTypes, opts) {
        argTypes = argTypes || [];
        var numericArgs = argTypes.every(function (type) {
          return type === "number"
        });
        var numericRet = returnType !== "string";
        if (numericRet && numericArgs && !opts) {
          return getCFunc(ident)
        }
        return function () {
          return ccall(ident, returnType, argTypes, arguments, opts)
        }
      }

      function setValue(ptr, value, type, noSafe) {
        type = type || "i8";
        if (type.charAt(type.length - 1) === "*") type = "i32";
        switch (type) {
          case "i1":
            HEAP8[ptr >> 0] = value;
            break;
          case "i8":
            HEAP8[ptr >> 0] = value;
            break;
          case "i16":
            HEAP16[ptr >> 1] = value;
            break;
          case "i32":
            HEAP32[ptr >> 2] = value;
            break;
          case "i64":
            tempI64 = [value >>> 0, (tempDouble = value, +Math_abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)], HEAP32[ptr >> 2] = tempI64[0], HEAP32[ptr + 4 >> 2] = tempI64[1];
            break;
          case "float":
            HEAPF32[ptr >> 2] = value;
            break;
          case "double":
            HEAPF64[ptr >> 3] = value;
            break;
          default:
            abort("invalid type for setValue: " + type)
        }
      }
      var ALLOC_NORMAL = 0;
      var ALLOC_NONE = 3;

      function allocate(slab, types, allocator, ptr) {
        var zeroinit, size;
        if (typeof slab === "number") {
          zeroinit = true;
          size = slab
        } else {
          zeroinit = false;
          size = slab.length
        }
        var singleType = typeof types === "string" ? types : null;
        var ret;
        if (allocator == ALLOC_NONE) {
          ret = ptr
        } else {
          ret = [_malloc, stackAlloc, dynamicAlloc][allocator](Math.max(size, singleType ? 1 : types.length))
        }
        if (zeroinit) {
          var stop;
          ptr = ret;
          assert((ret & 3) == 0);
          stop = ret + (size & ~3);
          for (; ptr < stop; ptr += 4) {
            HEAP32[ptr >> 2] = 0
          }
          stop = ret + size;
          while (ptr < stop) {
            HEAP8[ptr++ >> 0] = 0
          }
          return ret
        }
        if (singleType === "i8") {
          if (slab.subarray || slab.slice) {
            HEAPU8.set(slab, ret)
          } else {
            HEAPU8.set(new Uint8Array(slab), ret)
          }
          return ret
        }
        var i = 0,
          type, typeSize, previousType;
        while (i < size) {
          var curr = slab[i];
          type = singleType || types[i];
          if (type === 0) {
            i++;
            continue
          }
          if (type == "i64") type = "i32";
          setValue(ret + i, curr, type);
          if (previousType !== type) {
            typeSize = getNativeTypeSize(type);
            previousType = type
          }
          i += typeSize
        }
        return ret
      }

      function getMemory(size) {
        if (!runtimeInitialized) return dynamicAlloc(size);
        return _malloc(size)
      }
      var UTF8Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf8") : undefined;

      function UTF8ArrayToString(u8Array, idx, maxBytesToRead) {
        var endIdx = idx + maxBytesToRead;
        var endPtr = idx;
        while (u8Array[endPtr] && !(endPtr >= endIdx))++endPtr;
        if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
          return UTF8Decoder.decode(u8Array.subarray(idx, endPtr))
        } else {
          var str = "";
          while (idx < endPtr) {
            var u0 = u8Array[idx++];
            if (!(u0 & 128)) {
              str += String.fromCharCode(u0);
              continue
            }
            var u1 = u8Array[idx++] & 63;
            if ((u0 & 224) == 192) {
              str += String.fromCharCode((u0 & 31) << 6 | u1);
              continue
            }
            var u2 = u8Array[idx++] & 63;
            if ((u0 & 240) == 224) {
              u0 = (u0 & 15) << 12 | u1 << 6 | u2
            } else {
              u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | u8Array[idx++] & 63
            }
            if (u0 < 65536) {
              str += String.fromCharCode(u0)
            } else {
              var ch = u0 - 65536;
              str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023)
            }
          }
        }
        return str
      }

      function UTF8ToString(ptr, maxBytesToRead) {
        return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : ""
      }

      function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
        if (!(maxBytesToWrite > 0)) return 0;
        var startIdx = outIdx;
        var endIdx = outIdx + maxBytesToWrite - 1;
        for (var i = 0; i < str.length; ++i) {
          var u = str.charCodeAt(i);
          if (u >= 55296 && u <= 57343) {
            var u1 = str.charCodeAt(++i);
            u = 65536 + ((u & 1023) << 10) | u1 & 1023
          }
          if (u <= 127) {
            if (outIdx >= endIdx) break;
            outU8Array[outIdx++] = u
          } else if (u <= 2047) {
            if (outIdx + 1 >= endIdx) break;
            outU8Array[outIdx++] = 192 | u >> 6;
            outU8Array[outIdx++] = 128 | u & 63
          } else if (u <= 65535) {
            if (outIdx + 2 >= endIdx) break;
            outU8Array[outIdx++] = 224 | u >> 12;
            outU8Array[outIdx++] = 128 | u >> 6 & 63;
            outU8Array[outIdx++] = 128 | u & 63
          } else {
            if (outIdx + 3 >= endIdx) break;
            outU8Array[outIdx++] = 240 | u >> 18;
            outU8Array[outIdx++] = 128 | u >> 12 & 63;
            outU8Array[outIdx++] = 128 | u >> 6 & 63;
            outU8Array[outIdx++] = 128 | u & 63
          }
        }
        outU8Array[outIdx] = 0;
        return outIdx - startIdx
      }

      function stringToUTF8(str, outPtr, maxBytesToWrite) {
        return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite)
      }

      function lengthBytesUTF8(str) {
        var len = 0;
        for (var i = 0; i < str.length; ++i) {
          var u = str.charCodeAt(i);
          if (u >= 55296 && u <= 57343) u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
          if (u <= 127)++len;
          else if (u <= 2047) len += 2;
          else if (u <= 65535) len += 3;
          else len += 4
        }
        return len
      }
      var UTF16Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-16le") : undefined;

      function allocateUTF8(str) {
        var size = lengthBytesUTF8(str) + 1;
        var ret = _malloc(size);
        if (ret) stringToUTF8Array(str, HEAP8, ret, size);
        return ret
      }

      function allocateUTF8OnStack(str) {
        var size = lengthBytesUTF8(str) + 1;
        var ret = stackAlloc(size);
        stringToUTF8Array(str, HEAP8, ret, size);
        return ret
      }

      function writeArrayToMemory(array, buffer) {
        HEAP8.set(array, buffer)
      }

      function writeAsciiToMemory(str, buffer, dontAddNull) {
        for (var i = 0; i < str.length; ++i) {
          HEAP8[buffer++ >> 0] = str.charCodeAt(i)
        }
        if (!dontAddNull) HEAP8[buffer >> 0] = 0
      }

      function demangle(func) {
        return func
      }

      function demangleAll(text) {
        var regex = /__Z[\w\d_]+/g;
        return text.replace(regex, function (x) {
          var y = demangle(x);
          return x === y ? x : y + " [" + x + "]"
        })
      }

      function jsStackTrace() {
        var err = new Error;
        if (!err.stack) {
          try {
            throw new Error(0)
          } catch (e) {
            err = e
          }
          if (!err.stack) {
            return "(no stack trace available)"
          }
        }
        return err.stack.toString()
      }

      function stackTrace() {
        var js = jsStackTrace();
        if (Module["extraStackTrace"]) js += "\n" + Module["extraStackTrace"]();
        return demangleAll(js)
      }
      var WASM_PAGE_SIZE = 65536;

      function alignUp(x, multiple) {
        if (x % multiple > 0) {
          x += multiple - x % multiple
        }
        return x
      }
      var buffer, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;

      function updateGlobalBufferViews() {
        Module["HEAP8"] = HEAP8 = new Int8Array(buffer);
        Module["HEAP16"] = HEAP16 = new Int16Array(buffer);
        Module["HEAP32"] = HEAP32 = new Int32Array(buffer);
        Module["HEAPU8"] = HEAPU8 = new Uint8Array(buffer);
        Module["HEAPU16"] = HEAPU16 = new Uint16Array(buffer);
        Module["HEAPU32"] = HEAPU32 = new Uint32Array(buffer);
        Module["HEAPF32"] = HEAPF32 = new Float32Array(buffer);
        Module["HEAPF64"] = HEAPF64 = new Float64Array(buffer)
      }
      var DYNAMIC_BASE = 5581296,
        DYNAMICTOP_PTR = 338160;
      var TOTAL_STACK = 5242880;
      var INITIAL_TOTAL_MEMORY = Module["TOTAL_MEMORY"] || 50331648;
      if (INITIAL_TOTAL_MEMORY < TOTAL_STACK) err("TOTAL_MEMORY should be larger than TOTAL_STACK, was " + INITIAL_TOTAL_MEMORY + "! (TOTAL_STACK=" + TOTAL_STACK + ")");
      if (Module["buffer"]) {
        buffer = Module["buffer"]
      } else {
        if (typeof WebAssembly === "object" && typeof WebAssembly.Memory === "function") {
          wasmMemory = new WebAssembly.Memory({
            "initial": INITIAL_TOTAL_MEMORY / WASM_PAGE_SIZE
          });
          buffer = wasmMemory.buffer
        } else {
          buffer = new ArrayBuffer(INITIAL_TOTAL_MEMORY)
        }
      }
      updateGlobalBufferViews();
      HEAP32[DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE;

      function callRuntimeCallbacks(callbacks) {
        while (callbacks.length > 0) {
          var callback = callbacks.shift();
          if (typeof callback == "function") {
            callback();
            continue
          }
          var func = callback.func;
          if (typeof func === "number") {
            if (callback.arg === undefined) {
              Module["dynCall_v"](func)
            } else {
              Module["dynCall_vi"](func, callback.arg)
            }
          } else {
            func(callback.arg === undefined ? null : callback.arg)
          }
        }
      }
      var __ATPRERUN__ = [];
      var __ATINIT__ = [];
      var __ATMAIN__ = [];
      var __ATEXIT__ = [];
      var __ATPOSTRUN__ = [];
      var runtimeInitialized = false;
      var runtimeExited = false;

      function preRun() {
        if (Module["preRun"]) {
          if (typeof Module["preRun"] == "function") Module["preRun"] = [Module["preRun"]];
          while (Module["preRun"].length) {
            addOnPreRun(Module["preRun"].shift())
          }
        }
        callRuntimeCallbacks(__ATPRERUN__)
      }

      function ensureInitRuntime() {
        if (runtimeInitialized) return;
        runtimeInitialized = true;
        if (!Module["noFSInit"] && !FS.init.initialized) FS.init();
        TTY.init();
        callRuntimeCallbacks(__ATINIT__)
      }

      function preMain() {
        FS.ignorePermissions = false;
        callRuntimeCallbacks(__ATMAIN__)
      }

      function exitRuntime() {
        runtimeExited = true
      }

      function postRun() {
        if (Module["postRun"]) {
          if (typeof Module["postRun"] == "function") Module["postRun"] = [Module["postRun"]];
          while (Module["postRun"].length) {
            addOnPostRun(Module["postRun"].shift())
          }
        }
        callRuntimeCallbacks(__ATPOSTRUN__)
      }

      function addOnPreRun(cb) {
        __ATPRERUN__.unshift(cb)
      }

      function addOnPostRun(cb) {
        __ATPOSTRUN__.unshift(cb)
      }
      var Math_abs = Math.abs;
      var Math_ceil = Math.ceil;
      var Math_floor = Math.floor;
      var Math_min = Math.min;
      var runDependencies = 0;
      var runDependencyWatcher = null;
      var dependenciesFulfilled = null;

      function getUniqueRunDependency(id) {
        return id
      }

      function addRunDependency(id) {
        runDependencies++;
        if (Module["monitorRunDependencies"]) {
          Module["monitorRunDependencies"](runDependencies)
        }
      }

      function removeRunDependency(id) {
        runDependencies--;
        if (Module["monitorRunDependencies"]) {
          Module["monitorRunDependencies"](runDependencies)
        }
        if (runDependencies == 0) {
          if (runDependencyWatcher !== null) {
            clearInterval(runDependencyWatcher);
            runDependencyWatcher = null
          }
          if (dependenciesFulfilled) {
            var callback = dependenciesFulfilled;
            dependenciesFulfilled = null;
            callback()
          }
        }
      }
      Module["preloadedImages"] = {};
      Module["preloadedAudios"] = {};
      var dataURIPrefix = "data:application/octet-stream;base64,";

      function isDataURI(filename) {
        return String.prototype.startsWith ? filename.startsWith(dataURIPrefix) : filename.indexOf(dataURIPrefix) === 0
      }
      var wasmBinaryFile = "snes9x.wasm";
      if (!isDataURI(wasmBinaryFile)) {
        wasmBinaryFile = locateFile(wasmBinaryFile)
      }

      function getBinary() {
        try {
          if (Module["wasmBinary"]) {
            return new Uint8Array(Module["wasmBinary"])
          }
          if (Module["readBinary"]) {
            return Module["readBinary"](wasmBinaryFile)
          } else {
            throw "both async and sync fetching of the wasm failed"
          }
        } catch (err) {
          abort(err)
        }
      }

      function getBinaryPromise() {
        if (!Module["wasmBinary"] && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && typeof fetch === "function") {
          return fetch(wasmBinaryFile, {
            credentials: "same-origin"
          })
            .then(function (response) {
              if (!response["ok"]) {
                throw "failed to load wasm binary file at '" + wasmBinaryFile + "'"
              }
              return response["arrayBuffer"]()
            })
            .catch(function () {
              return getBinary()
            })
        }
        return new Promise(function (resolve, reject) {
          resolve(getBinary())
        })
      }

      function createWasm(env) {
        var info = {
          "env": env,
          "global": {
            "NaN": NaN,
            Infinity: Infinity
          },
          "global.Math": Math,
          "asm2wasm": asm2wasmImports
        };

        function receiveInstance(instance, module) {
          var exports = instance.exports;
          Module["asm"] = exports;
          removeRunDependency("wasm-instantiate")
        }
        addRunDependency("wasm-instantiate");
        if (Module["instantiateWasm"]) {
          try {
            return Module["instantiateWasm"](info, receiveInstance)
          } catch (e) {
            err("Module.instantiateWasm callback failed with error: " + e);
            return false
          }
        }

        function receiveInstantiatedSource(output) {
          receiveInstance(output["instance"])
        }

        function instantiateArrayBuffer(receiver) {
          getBinaryPromise()
            .then(function (binary) {
              return WebAssembly.instantiate(binary, info)
            })
            .then(receiver, function (reason) {
              err("failed to asynchronously prepare wasm: " + reason);
              abort(reason)
            })
        }
        if (!Module["wasmBinary"] && typeof WebAssembly.instantiateStreaming === "function" && !isDataURI(wasmBinaryFile) && typeof fetch === "function") {
          WebAssembly.instantiateStreaming(fetch(wasmBinaryFile, {
            credentials: "same-origin"
          }), info)
            .then(receiveInstantiatedSource, function (reason) {
              err("wasm streaming compile failed: " + reason);
              err("falling back to ArrayBuffer instantiation");
              instantiateArrayBuffer(receiveInstantiatedSource)
            })
        } else {
          instantiateArrayBuffer(receiveInstantiatedSource)
        }
        return {}
      }
      Module["asm"] = function (global, env, providedBuffer) {
        env["memory"] = wasmMemory;
        env["table"] = wasmTable = new WebAssembly.Table({
          "initial": 4490,
          "maximum": 4490,
          "element": "anyfunc"
        });
        env["__memory_base"] = 1024;
        env["__table_base"] = 0;
        var exports = createWasm(env);
        return exports
      };
      var ASM_CONSTS = [function () {
        FS.syncfs(false, function (err) {
          if (err) {
            console.log("Error saving sram file.");
            console.log(err)
          } else {
            console.log("File system synced")
          }
        })
      }, function () {
        console.log("Syncing file system...");
        FS.mkdir("/home/web_user/.snes9x");
        FS.mkdir("/home/web_user/.snes9x/sram");
        FS.mount(IDBFS, {}, "/home/web_user/.snes9x/sram");
        FS.syncfs(true, function (err) {
          if (err) {
            console.log(err)
          } else {
            console.log("File system synced.");
            window.initSNES()
          }
        })
      }];

      function _emscripten_asm_const_i(code) {
        return ASM_CONSTS[code]()
      }
      __ATINIT__.push({
        func: function () {
          globalCtors()
        }
      });

      function ___setErrNo(value) {
        if (Module["___errno_location"]) HEAP32[Module["___errno_location"]() >> 2] = value;
        return value
      }
      var PATH = {
        splitPath: function (filename) {
          var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
          return splitPathRe.exec(filename)
            .slice(1)
        },
        normalizeArray: function (parts, allowAboveRoot) {
          var up = 0;
          for (var i = parts.length - 1; i >= 0; i--) {
            var last = parts[i];
            if (last === ".") {
              parts.splice(i, 1)
            } else if (last === "..") {
              parts.splice(i, 1);
              up++
            } else if (up) {
              parts.splice(i, 1);
              up--
            }
          }
          if (allowAboveRoot) {
            for (; up; up--) {
              parts.unshift("..")
            }
          }
          return parts
        },
        normalize: function (path) {
          var isAbsolute = path.charAt(0) === "/",
            trailingSlash = path.substr(-1) === "/";
          path = PATH.normalizeArray(path.split("/")
            .filter(function (p) {
              return !!p
            }), !isAbsolute)
            .join("/");
          if (!path && !isAbsolute) {
            path = "."
          }
          if (path && trailingSlash) {
            path += "/"
          }
          return (isAbsolute ? "/" : "") + path
        },
        dirname: function (path) {
          var result = PATH.splitPath(path),
            root = result[0],
            dir = result[1];
          if (!root && !dir) {
            return "."
          }
          if (dir) {
            dir = dir.substr(0, dir.length - 1)
          }
          return root + dir
        },
        basename: function (path) {
          if (path === "/") return "/";
          var lastSlash = path.lastIndexOf("/");
          if (lastSlash === -1) return path;
          return path.substr(lastSlash + 1)
        },
        extname: function (path) {
          return PATH.splitPath(path)[3]
        },
        join: function () {
          var paths = Array.prototype.slice.call(arguments, 0);
          return PATH.normalize(paths.join("/"))
        },
        join2: function (l, r) {
          return PATH.normalize(l + "/" + r)
        },
        resolve: function () {
          var resolvedPath = "",
            resolvedAbsolute = false;
          for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
            var path = i >= 0 ? arguments[i] : FS.cwd();
            if (typeof path !== "string") {
              throw new TypeError("Arguments to path.resolve must be strings")
            } else if (!path) {
              return ""
            }
            resolvedPath = path + "/" + resolvedPath;
            resolvedAbsolute = path.charAt(0) === "/"
          }
          resolvedPath = PATH.normalizeArray(resolvedPath.split("/")
            .filter(function (p) {
              return !!p
            }), !resolvedAbsolute)
            .join("/");
          return (resolvedAbsolute ? "/" : "") + resolvedPath || "."
        },
        relative: function (from, to) {
          from = PATH.resolve(from)
            .substr(1);
          to = PATH.resolve(to)
            .substr(1);

          function trim(arr) {
            var start = 0;
            for (; start < arr.length; start++) {
              if (arr[start] !== "") break
            }
            var end = arr.length - 1;
            for (; end >= 0; end--) {
              if (arr[end] !== "") break
            }
            if (start > end) return [];
            return arr.slice(start, end - start + 1)
          }
          var fromParts = trim(from.split("/"));
          var toParts = trim(to.split("/"));
          var length = Math.min(fromParts.length, toParts.length);
          var samePartsLength = length;
          for (var i = 0; i < length; i++) {
            if (fromParts[i] !== toParts[i]) {
              samePartsLength = i;
              break
            }
          }
          var outputParts = [];
          for (var i = samePartsLength; i < fromParts.length; i++) {
            outputParts.push("..")
          }
          outputParts = outputParts.concat(toParts.slice(samePartsLength));
          return outputParts.join("/")
        }
      };
      var TTY = {
        ttys: [],
        init: function () { },
        shutdown: function () { },
        register: function (dev, ops) {
          TTY.ttys[dev] = {
            input: [],
            output: [],
            ops: ops
          };
          FS.registerDevice(dev, TTY.stream_ops)
        },
        stream_ops: {
          open: function (stream) {
            var tty = TTY.ttys[stream.node.rdev];
            if (!tty) {
              throw new FS.ErrnoError(ERRNO_CODES.ENODEV)
            }
            stream.tty = tty;
            stream.seekable = false
          },
          close: function (stream) {
            stream.tty.ops.flush(stream.tty)
          },
          flush: function (stream) {
            stream.tty.ops.flush(stream.tty)
          },
          read: function (stream, buffer, offset, length, pos) {
            if (!stream.tty || !stream.tty.ops.get_char) {
              throw new FS.ErrnoError(ERRNO_CODES.ENXIO)
            }
            var bytesRead = 0;
            for (var i = 0; i < length; i++) {
              var result;
              try {
                result = stream.tty.ops.get_char(stream.tty)
              } catch (e) {
                throw new FS.ErrnoError(ERRNO_CODES.EIO)
              }
              if (result === undefined && bytesRead === 0) {
                throw new FS.ErrnoError(ERRNO_CODES.EAGAIN)
              }
              if (result === null || result === undefined) break;
              bytesRead++;
              buffer[offset + i] = result
            }
            if (bytesRead) {
              stream.node.timestamp = Date.now()
            }
            return bytesRead
          },
          write: function (stream, buffer, offset, length, pos) {
            if (!stream.tty || !stream.tty.ops.put_char) {
              throw new FS.ErrnoError(ERRNO_CODES.ENXIO)
            }
            try {
              for (var i = 0; i < length; i++) {
                stream.tty.ops.put_char(stream.tty, buffer[offset + i])
              }
            } catch (e) {
              throw new FS.ErrnoError(ERRNO_CODES.EIO)
            }
            if (length) {
              stream.node.timestamp = Date.now()
            }
            return i
          }
        },
        default_tty_ops: {
          get_char: function (tty) {
            if (!tty.input.length) {
              var result = null;
              if (ENVIRONMENT_IS_NODE) {
                var BUFSIZE = 256;
                var buf = new Buffer(BUFSIZE);
                var bytesRead = 0;
                var isPosixPlatform = process.platform != "win32";
                var fd = process.stdin.fd;
                if (isPosixPlatform) {
                  var usingDevice = false;
                  try {
                    fd = fs.openSync("/dev/stdin", "r");
                    usingDevice = true
                  } catch (e) { }
                }
                try {
                  bytesRead = fs.readSync(fd, buf, 0, BUFSIZE, null)
                } catch (e) {
                  if (e.toString()
                    .indexOf("EOF") != -1) bytesRead = 0;
                  else throw e
                }
                if (usingDevice) {
                  fs.closeSync(fd)
                }
                if (bytesRead > 0) {
                  result = buf.slice(0, bytesRead)
                    .toString("utf-8")
                } else {
                  result = null
                }
              } else if (typeof window != "undefined" && typeof window.prompt == "function") {
                result = window.prompt("Input: ");
                if (result !== null) {
                  result += "\n"
                }
              } else if (typeof readline == "function") {
                result = readline();
                if (result !== null) {
                  result += "\n"
                }
              }
              if (!result) {
                return null
              }
              tty.input = intArrayFromString(result, true)
            }
            return tty.input.shift()
          },
          put_char: function (tty, val) {
            if (val === null || val === 10) {
              out(UTF8ArrayToString(tty.output, 0));
              tty.output = []
            } else {
              if (val != 0) tty.output.push(val)
            }
          },
          flush: function (tty) {
            if (tty.output && tty.output.length > 0) {
              out(UTF8ArrayToString(tty.output, 0));
              tty.output = []
            }
          }
        },
        default_tty1_ops: {
          put_char: function (tty, val) {
            if (val === null || val === 10) {
              err(UTF8ArrayToString(tty.output, 0));
              tty.output = []
            } else {
              if (val != 0) tty.output.push(val)
            }
          },
          flush: function (tty) {
            if (tty.output && tty.output.length > 0) {
              err(UTF8ArrayToString(tty.output, 0));
              tty.output = []
            }
          }
        }
      };
      var MEMFS = {
        ops_table: null,
        mount: function (mount) {
          return MEMFS.createNode(null, "/", 16384 | 511, 0)
        },
        createNode: function (parent, name, mode, dev) {
          if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
            throw new FS.ErrnoError(ERRNO_CODES.EPERM)
          }
          if (!MEMFS.ops_table) {
            MEMFS.ops_table = {
              dir: {
                node: {
                  getattr: MEMFS.node_ops.getattr,
                  setattr: MEMFS.node_ops.setattr,
                  lookup: MEMFS.node_ops.lookup,
                  mknod: MEMFS.node_ops.mknod,
                  rename: MEMFS.node_ops.rename,
                  unlink: MEMFS.node_ops.unlink,
                  rmdir: MEMFS.node_ops.rmdir,
                  readdir: MEMFS.node_ops.readdir,
                  symlink: MEMFS.node_ops.symlink
                },
                stream: {
                  llseek: MEMFS.stream_ops.llseek
                }
              },
              file: {
                node: {
                  getattr: MEMFS.node_ops.getattr,
                  setattr: MEMFS.node_ops.setattr
                },
                stream: {
                  llseek: MEMFS.stream_ops.llseek,
                  read: MEMFS.stream_ops.read,
                  write: MEMFS.stream_ops.write,
                  allocate: MEMFS.stream_ops.allocate,
                  mmap: MEMFS.stream_ops.mmap,
                  msync: MEMFS.stream_ops.msync
                }
              },
              link: {
                node: {
                  getattr: MEMFS.node_ops.getattr,
                  setattr: MEMFS.node_ops.setattr,
                  readlink: MEMFS.node_ops.readlink
                },
                stream: {}
              },
              chrdev: {
                node: {
                  getattr: MEMFS.node_ops.getattr,
                  setattr: MEMFS.node_ops.setattr
                },
                stream: FS.chrdev_stream_ops
              }
            }
          }
          var node = FS.createNode(parent, name, mode, dev);
          if (FS.isDir(node.mode)) {
            node.node_ops = MEMFS.ops_table.dir.node;
            node.stream_ops = MEMFS.ops_table.dir.stream;
            node.contents = {}
          } else if (FS.isFile(node.mode)) {
            node.node_ops = MEMFS.ops_table.file.node;
            node.stream_ops = MEMFS.ops_table.file.stream;
            node.usedBytes = 0;
            node.contents = null
          } else if (FS.isLink(node.mode)) {
            node.node_ops = MEMFS.ops_table.link.node;
            node.stream_ops = MEMFS.ops_table.link.stream
          } else if (FS.isChrdev(node.mode)) {
            node.node_ops = MEMFS.ops_table.chrdev.node;
            node.stream_ops = MEMFS.ops_table.chrdev.stream
          }
          node.timestamp = Date.now();
          if (parent) {
            parent.contents[name] = node
          }
          return node
        },
        getFileDataAsRegularArray: function (node) {
          if (node.contents && node.contents.subarray) {
            var arr = [];
            for (var i = 0; i < node.usedBytes; ++i) arr.push(node.contents[i]);
            return arr
          }
          return node.contents
        },
        getFileDataAsTypedArray: function (node) {
          if (!node.contents) return new Uint8Array;
          if (node.contents.subarray) return node.contents.subarray(0, node.usedBytes);
          return new Uint8Array(node.contents)
        },
        expandFileStorage: function (node, newCapacity) {
          var prevCapacity = node.contents ? node.contents.length : 0;
          if (prevCapacity >= newCapacity) return;
          var CAPACITY_DOUBLING_MAX = 1024 * 1024;
          newCapacity = Math.max(newCapacity, prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125) | 0);
          if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256);
          var oldContents = node.contents;
          node.contents = new Uint8Array(newCapacity);
          if (node.usedBytes > 0) node.contents.set(oldContents.subarray(0, node.usedBytes), 0);
          return
        },
        resizeFileStorage: function (node, newSize) {
          if (node.usedBytes == newSize) return;
          if (newSize == 0) {
            node.contents = null;
            node.usedBytes = 0;
            return
          }
          if (!node.contents || node.contents.subarray) {
            var oldContents = node.contents;
            node.contents = new Uint8Array(new ArrayBuffer(newSize));
            if (oldContents) {
              node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes)))
            }
            node.usedBytes = newSize;
            return
          }
          if (!node.contents) node.contents = [];
          if (node.contents.length > newSize) node.contents.length = newSize;
          else
            while (node.contents.length < newSize) node.contents.push(0);
          node.usedBytes = newSize
        },
        node_ops: {
          getattr: function (node) {
            var attr = {};
            attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
            attr.ino = node.id;
            attr.mode = node.mode;
            attr.nlink = 1;
            attr.uid = 0;
            attr.gid = 0;
            attr.rdev = node.rdev;
            if (FS.isDir(node.mode)) {
              attr.size = 4096
            } else if (FS.isFile(node.mode)) {
              attr.size = node.usedBytes
            } else if (FS.isLink(node.mode)) {
              attr.size = node.link.length
            } else {
              attr.size = 0
            }
            attr.atime = new Date(node.timestamp);
            attr.mtime = new Date(node.timestamp);
            attr.ctime = new Date(node.timestamp);
            attr.blksize = 4096;
            attr.blocks = Math.ceil(attr.size / attr.blksize);
            return attr
          },
          setattr: function (node, attr) {
            if (attr.mode !== undefined) {
              node.mode = attr.mode
            }
            if (attr.timestamp !== undefined) {
              node.timestamp = attr.timestamp
            }
            if (attr.size !== undefined) {
              MEMFS.resizeFileStorage(node, attr.size)
            }
          },
          lookup: function (parent, name) {
            throw FS.genericErrors[ERRNO_CODES.ENOENT]
          },
          mknod: function (parent, name, mode, dev) {
            return MEMFS.createNode(parent, name, mode, dev)
          },
          rename: function (old_node, new_dir, new_name) {
            if (FS.isDir(old_node.mode)) {
              var new_node;
              try {
                new_node = FS.lookupNode(new_dir, new_name)
              } catch (e) { }
              if (new_node) {
                for (var i in new_node.contents) {
                  throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY)
                }
              }
            }
            delete old_node.parent.contents[old_node.name];
            old_node.name = new_name;
            new_dir.contents[new_name] = old_node;
            old_node.parent = new_dir
          },
          unlink: function (parent, name) {
            delete parent.contents[name]
          },
          rmdir: function (parent, name) {
            var node = FS.lookupNode(parent, name);
            for (var i in node.contents) {
              throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY)
            }
            delete parent.contents[name]
          },
          readdir: function (node) {
            var entries = [".", ".."];
            for (var key in node.contents) {
              if (!node.contents.hasOwnProperty(key)) {
                continue
              }
              entries.push(key)
            }
            return entries
          },
          symlink: function (parent, newname, oldpath) {
            var node = MEMFS.createNode(parent, newname, 511 | 40960, 0);
            node.link = oldpath;
            return node
          },
          readlink: function (node) {
            if (!FS.isLink(node.mode)) {
              throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
            }
            return node.link
          }
        },
        stream_ops: {
          read: function (stream, buffer, offset, length, position) {
            var contents = stream.node.contents;
            if (position >= stream.node.usedBytes) return 0;
            var size = Math.min(stream.node.usedBytes - position, length);
            if (size > 8 && contents.subarray) {
              buffer.set(contents.subarray(position, position + size), offset)
            } else {
              for (var i = 0; i < size; i++) buffer[offset + i] = contents[position + i]
            }
            return size
          },
          write: function (stream, buffer, offset, length, position, canOwn) {
            canOwn = false;
            if (!length) return 0;
            var node = stream.node;
            node.timestamp = Date.now();
            if (buffer.subarray && (!node.contents || node.contents.subarray)) {
              if (canOwn) {
                node.contents = buffer.subarray(offset, offset + length);
                node.usedBytes = length;
                return length
              } else if (node.usedBytes === 0 && position === 0) {
                node.contents = new Uint8Array(buffer.subarray(offset, offset + length));
                node.usedBytes = length;
                return length
              } else if (position + length <= node.usedBytes) {
                node.contents.set(buffer.subarray(offset, offset + length), position);
                return length
              }
            }
            MEMFS.expandFileStorage(node, position + length);
            if (node.contents.subarray && buffer.subarray) node.contents.set(buffer.subarray(offset, offset + length), position);
            else {
              for (var i = 0; i < length; i++) {
                node.contents[position + i] = buffer[offset + i]
              }
            }
            node.usedBytes = Math.max(node.usedBytes, position + length);
            return length
          },
          llseek: function (stream, offset, whence) {
            var position = offset;
            if (whence === 1) {
              position += stream.position
            } else if (whence === 2) {
              if (FS.isFile(stream.node.mode)) {
                position += stream.node.usedBytes
              }
            }
            if (position < 0) {
              throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
            }
            return position
          },
          allocate: function (stream, offset, length) {
            MEMFS.expandFileStorage(stream.node, offset + length);
            stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length)
          },
          mmap: function (stream, buffer, offset, length, position, prot, flags) {
            if (!FS.isFile(stream.node.mode)) {
              throw new FS.ErrnoError(ERRNO_CODES.ENODEV)
            }
            var ptr;
            var allocated;
            var contents = stream.node.contents;
            if (!(flags & 2) && (contents.buffer === buffer || contents.buffer === buffer.buffer)) {
              allocated = false;
              ptr = contents.byteOffset
            } else {
              if (position > 0 || position + length < stream.node.usedBytes) {
                if (contents.subarray) {
                  contents = contents.subarray(position, position + length)
                } else {
                  contents = Array.prototype.slice.call(contents, position, position + length)
                }
              }
              allocated = true;
              ptr = _malloc(length);
              if (!ptr) {
                throw new FS.ErrnoError(ERRNO_CODES.ENOMEM)
              }
              buffer.set(contents, ptr)
            }
            return {
              ptr: ptr,
              allocated: allocated
            }
          },
          msync: function (stream, buffer, offset, length, mmapFlags) {
            if (!FS.isFile(stream.node.mode)) {
              throw new FS.ErrnoError(ERRNO_CODES.ENODEV)
            }
            if (mmapFlags & 2) {
              return 0
            }
            var bytesWritten = MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
            return 0
          }
        }
      };
      var NODEFS = {
        isWindows: false,
        staticInit: function () {
          NODEFS.isWindows = !!process.platform.match(/^win/);
          var flags = process["binding"]("constants");
          if (flags["fs"]) {
            flags = flags["fs"]
          }
          NODEFS.flagsForNodeMap = {
            1024: flags["O_APPEND"],
            64: flags["O_CREAT"],
            128: flags["O_EXCL"],
            0: flags["O_RDONLY"],
            2: flags["O_RDWR"],
            4096: flags["O_SYNC"],
            512: flags["O_TRUNC"],
            1: flags["O_WRONLY"]
          }
        },
        bufferFrom: function (arrayBuffer) {
          return Buffer.alloc ? Buffer.from(arrayBuffer) : new Buffer(arrayBuffer)
        },
        mount: function (mount) {
          assert(ENVIRONMENT_IS_NODE);
          return NODEFS.createNode(null, "/", NODEFS.getMode(mount.opts.root), 0)
        },
        createNode: function (parent, name, mode, dev) {
          if (!FS.isDir(mode) && !FS.isFile(mode) && !FS.isLink(mode)) {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
          }
          var node = FS.createNode(parent, name, mode);
          node.node_ops = NODEFS.node_ops;
          node.stream_ops = NODEFS.stream_ops;
          return node
        },
        getMode: function (path) {
          var stat;
          try {
            stat = fs.lstatSync(path);
            if (NODEFS.isWindows) {
              stat.mode = stat.mode | (stat.mode & 292) >> 2
            }
          } catch (e) {
            if (!e.code) throw e;
            throw new FS.ErrnoError(ERRNO_CODES[e.code])
          }
          return stat.mode
        },
        realPath: function (node) {
          var parts = [];
          while (node.parent !== node) {
            parts.push(node.name);
            node = node.parent
          }
          parts.push(node.mount.opts.root);
          parts.reverse();
          return PATH.join.apply(null, parts)
        },
        flagsForNode: function (flags) {
          flags &= ~2097152;
          flags &= ~2048;
          flags &= ~32768;
          flags &= ~524288;
          var newFlags = 0;
          for (var k in NODEFS.flagsForNodeMap) {
            if (flags & k) {
              newFlags |= NODEFS.flagsForNodeMap[k];
              flags ^= k
            }
          }
          if (!flags) {
            return newFlags
          } else {
            throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
          }
        },
        node_ops: {
          getattr: function (node) {
            var path = NODEFS.realPath(node);
            var stat;
            try {
              stat = fs.lstatSync(path)
            } catch (e) {
              if (!e.code) throw e;
              throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
            if (NODEFS.isWindows && !stat.blksize) {
              stat.blksize = 4096
            }
            if (NODEFS.isWindows && !stat.blocks) {
              stat.blocks = (stat.size + stat.blksize - 1) / stat.blksize | 0
            }
            return {
              dev: stat.dev,
              ino: stat.ino,
              mode: stat.mode,
              nlink: stat.nlink,
              uid: stat.uid,
              gid: stat.gid,
              rdev: stat.rdev,
              size: stat.size,
              atime: stat.atime,
              mtime: stat.mtime,
              ctime: stat.ctime,
              blksize: stat.blksize,
              blocks: stat.blocks
            }
          },
          setattr: function (node, attr) {
            var path = NODEFS.realPath(node);
            try {
              if (attr.mode !== undefined) {
                fs.chmodSync(path, attr.mode);
                node.mode = attr.mode
              }
              if (attr.timestamp !== undefined) {
                var date = new Date(attr.timestamp);
                fs.utimesSync(path, date, date)
              }
              if (attr.size !== undefined) {
                fs.truncateSync(path, attr.size)
              }
            } catch (e) {
              if (!e.code) throw e;
              throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
          },
          lookup: function (parent, name) {
            var path = PATH.join2(NODEFS.realPath(parent), name);
            var mode = NODEFS.getMode(path);
            return NODEFS.createNode(parent, name, mode)
          },
          mknod: function (parent, name, mode, dev) {
            var node = NODEFS.createNode(parent, name, mode, dev);
            var path = NODEFS.realPath(node);
            try {
              if (FS.isDir(node.mode)) {
                fs.mkdirSync(path, node.mode)
              } else {
                fs.writeFileSync(path, "", {
                  mode: node.mode
                })
              }
            } catch (e) {
              if (!e.code) throw e;
              throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
            return node
          },
          rename: function (oldNode, newDir, newName) {
            var oldPath = NODEFS.realPath(oldNode);
            var newPath = PATH.join2(NODEFS.realPath(newDir), newName);
            try {
              fs.renameSync(oldPath, newPath)
            } catch (e) {
              if (!e.code) throw e;
              throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
          },
          unlink: function (parent, name) {
            var path = PATH.join2(NODEFS.realPath(parent), name);
            try {
              fs.unlinkSync(path)
            } catch (e) {
              if (!e.code) throw e;
              throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
          },
          rmdir: function (parent, name) {
            var path = PATH.join2(NODEFS.realPath(parent), name);
            try {
              fs.rmdirSync(path)
            } catch (e) {
              if (!e.code) throw e;
              throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
          },
          readdir: function (node) {
            var path = NODEFS.realPath(node);
            try {
              return fs.readdirSync(path)
            } catch (e) {
              if (!e.code) throw e;
              throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
          },
          symlink: function (parent, newName, oldPath) {
            var newPath = PATH.join2(NODEFS.realPath(parent), newName);
            try {
              fs.symlinkSync(oldPath, newPath)
            } catch (e) {
              if (!e.code) throw e;
              throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
          },
          readlink: function (node) {
            var path = NODEFS.realPath(node);
            try {
              path = fs.readlinkSync(path);
              path = NODEJS_PATH.relative(NODEJS_PATH.resolve(node.mount.opts.root), path);
              return path
            } catch (e) {
              if (!e.code) throw e;
              throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
          }
        },
        stream_ops: {
          open: function (stream) {
            var path = NODEFS.realPath(stream.node);
            try {
              if (FS.isFile(stream.node.mode)) {
                stream.nfd = fs.openSync(path, NODEFS.flagsForNode(stream.flags))
              }
            } catch (e) {
              if (!e.code) throw e;
              throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
          },
          close: function (stream) {
            try {
              if (FS.isFile(stream.node.mode) && stream.nfd) {
                fs.closeSync(stream.nfd)
              }
            } catch (e) {
              if (!e.code) throw e;
              throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
          },
          read: function (stream, buffer, offset, length, position) {
            if (length === 0) return 0;
            try {
              return fs.readSync(stream.nfd, NODEFS.bufferFrom(buffer.buffer), offset, length, position)
            } catch (e) {
              throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
          },
          write: function (stream, buffer, offset, length, position) {
            try {
              return fs.writeSync(stream.nfd, NODEFS.bufferFrom(buffer.buffer), offset, length, position)
            } catch (e) {
              throw new FS.ErrnoError(ERRNO_CODES[e.code])
            }
          },
          llseek: function (stream, offset, whence) {
            var position = offset;
            if (whence === 1) {
              position += stream.position
            } else if (whence === 2) {
              if (FS.isFile(stream.node.mode)) {
                try {
                  var stat = fs.fstatSync(stream.nfd);
                  position += stat.size
                } catch (e) {
                  throw new FS.ErrnoError(ERRNO_CODES[e.code])
                }
              }
            }
            if (position < 0) {
              throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
            }
            return position
          }
        }
      };
      var FS = {
        root: null,
        mounts: [],
        devices: {},
        streams: [],
        nextInode: 1,
        nameTable: null,
        currentPath: "/",
        initialized: false,
        ignorePermissions: true,
        trackingDelegate: {},
        tracking: {
          openFlags: {
            READ: 1,
            WRITE: 2
          }
        },
        ErrnoError: null,
        genericErrors: {},
        filesystems: null,
        syncFSRequests: 0,
        handleFSError: function (e) {
          if (!(e instanceof FS.ErrnoError)) throw e + " : " + stackTrace();
          return ___setErrNo(e.errno)
        },
        lookupPath: function (path, opts) {
          path = PATH.resolve(FS.cwd(), path);
          opts = opts || {};
          if (!path) return {
            path: "",
            node: null
          };
          var defaults = {
            follow_mount: true,
            recurse_count: 0
          };
          for (var key in defaults) {
            if (opts[key] === undefined) {
              opts[key] = defaults[key]
            }
          }
          if (opts.recurse_count > 8) {
            throw new FS.ErrnoError(40)
          }
          var parts = PATH.normalizeArray(path.split("/")
            .filter(function (p) {
              return !!p
            }), false);
          var current = FS.root;
          var current_path = "/";
          for (var i = 0; i < parts.length; i++) {
            var islast = i === parts.length - 1;
            if (islast && opts.parent) {
              break
            }
            current = FS.lookupNode(current, parts[i]);
            current_path = PATH.join2(current_path, parts[i]);
            if (FS.isMountpoint(current)) {
              if (!islast || islast && opts.follow_mount) {
                current = current.mounted.root
              }
            }
            if (!islast || opts.follow) {
              var count = 0;
              while (FS.isLink(current.mode)) {
                var link = FS.readlink(current_path);
                current_path = PATH.resolve(PATH.dirname(current_path), link);
                var lookup = FS.lookupPath(current_path, {
                  recurse_count: opts.recurse_count
                });
                current = lookup.node;
                if (count++ > 40) {
                  throw new FS.ErrnoError(40)
                }
              }
            }
          }
          return {
            path: current_path,
            node: current
          }
        },
        getPath: function (node) {
          var path;
          while (true) {
            if (FS.isRoot(node)) {
              var mount = node.mount.mountpoint;
              if (!path) return mount;
              return mount[mount.length - 1] !== "/" ? mount + "/" + path : mount + path
            }
            path = path ? node.name + "/" + path : node.name;
            node = node.parent
          }
        },
        hashName: function (parentid, name) {
          var hash = 0;
          for (var i = 0; i < name.length; i++) {
            hash = (hash << 5) - hash + name.charCodeAt(i) | 0
          }
          return (parentid + hash >>> 0) % FS.nameTable.length
        },
        hashAddNode: function (node) {
          var hash = FS.hashName(node.parent.id, node.name);
          node.name_next = FS.nameTable[hash];
          FS.nameTable[hash] = node
        },
        hashRemoveNode: function (node) {
          var hash = FS.hashName(node.parent.id, node.name);
          if (FS.nameTable[hash] === node) {
            FS.nameTable[hash] = node.name_next
          } else {
            var current = FS.nameTable[hash];
            while (current) {
              if (current.name_next === node) {
                current.name_next = node.name_next;
                break
              }
              current = current.name_next
            }
          }
        },
        lookupNode: function (parent, name) {
          var err = FS.mayLookup(parent);
          if (err) {
            throw new FS.ErrnoError(err, parent)
          }
          var hash = FS.hashName(parent.id, name);
          for (var node = FS.nameTable[hash]; node; node = node.name_next) {
            var nodeName = node.name;
            if (node.parent.id === parent.id && nodeName === name) {
              return node
            }
          }
          return FS.lookup(parent, name)
        },
        createNode: function (parent, name, mode, rdev) {
          if (!FS.FSNode) {
            FS.FSNode = function (parent, name, mode, rdev) {
              if (!parent) {
                parent = this
              }
              this.parent = parent;
              this.mount = parent.mount;
              this.mounted = null;
              this.id = FS.nextInode++;
              this.name = name;
              this.mode = mode;
              this.node_ops = {};
              this.stream_ops = {};
              this.rdev = rdev
            };
            FS.FSNode.prototype = {};
            var readMode = 292 | 73;
            var writeMode = 146;
            Object.defineProperties(FS.FSNode.prototype, {
              read: {
                get: function () {
                  return (this.mode & readMode) === readMode
                },
                set: function (val) {
                  val ? this.mode |= readMode : this.mode &= ~readMode
                }
              },
              write: {
                get: function () {
                  return (this.mode & writeMode) === writeMode
                },
                set: function (val) {
                  val ? this.mode |= writeMode : this.mode &= ~writeMode
                }
              },
              isFolder: {
                get: function () {
                  return FS.isDir(this.mode)
                }
              },
              isDevice: {
                get: function () {
                  return FS.isChrdev(this.mode)
                }
              }
            })
          }
          var node = new FS.FSNode(parent, name, mode, rdev);
          FS.hashAddNode(node);
          return node
        },
        destroyNode: function (node) {
          FS.hashRemoveNode(node)
        },
        isRoot: function (node) {
          return node === node.parent
        },
        isMountpoint: function (node) {
          return !!node.mounted
        },
        isFile: function (mode) {
          return (mode & 61440) === 32768
        },
        isDir: function (mode) {
          return (mode & 61440) === 16384
        },
        isLink: function (mode) {
          return (mode & 61440) === 40960
        },
        isChrdev: function (mode) {
          return (mode & 61440) === 8192
        },
        isBlkdev: function (mode) {
          return (mode & 61440) === 24576
        },
        isFIFO: function (mode) {
          return (mode & 61440) === 4096
        },
        isSocket: function (mode) {
          return (mode & 49152) === 49152
        },
        flagModes: {
          "r": 0,
          "rs": 1052672,
          "r+": 2,
          "w": 577,
          "wx": 705,
          "xw": 705,
          "w+": 578,
          "wx+": 706,
          "xw+": 706,
          "a": 1089,
          "ax": 1217,
          "xa": 1217,
          "a+": 1090,
          "ax+": 1218,
          "xa+": 1218
        },
        modeStringToFlags: function (str) {
          var flags = FS.flagModes[str];
          if (typeof flags === "undefined") {
            throw new Error("Unknown file open mode: " + str)
          }
          return flags
        },
        flagsToPermissionString: function (flag) {
          var perms = ["r", "w", "rw"][flag & 3];
          if (flag & 512) {
            perms += "w"
          }
          return perms
        },
        nodePermissions: function (node, perms) {
          if (FS.ignorePermissions) {
            return 0
          }
          if (perms.indexOf("r") !== -1 && !(node.mode & 292)) {
            return 13
          } else if (perms.indexOf("w") !== -1 && !(node.mode & 146)) {
            return 13
          } else if (perms.indexOf("x") !== -1 && !(node.mode & 73)) {
            return 13
          }
          return 0
        },
        mayLookup: function (dir) {
          var err = FS.nodePermissions(dir, "x");
          if (err) return err;
          if (!dir.node_ops.lookup) return 13;
          return 0
        },
        mayCreate: function (dir, name) {
          try {
            var node = FS.lookupNode(dir, name);
            return 17
          } catch (e) { }
          return FS.nodePermissions(dir, "wx")
        },
        mayDelete: function (dir, name, isdir) {
          var node;
          try {
            node = FS.lookupNode(dir, name)
          } catch (e) {
            return e.errno
          }
          var err = FS.nodePermissions(dir, "wx");
          if (err) {
            return err
          }
          if (isdir) {
            if (!FS.isDir(node.mode)) {
              return 20
            }
            if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
              return 16
            }
          } else {
            if (FS.isDir(node.mode)) {
              return 21
            }
          }
          return 0
        },
        mayOpen: function (node, flags) {
          if (!node) {
            return 2
          }
          if (FS.isLink(node.mode)) {
            return 40
          } else if (FS.isDir(node.mode)) {
            if (FS.flagsToPermissionString(flags) !== "r" || flags & 512) {
              return 21
            }
          }
          return FS.nodePermissions(node, FS.flagsToPermissionString(flags))
        },
        MAX_OPEN_FDS: 4096,
        nextfd: function (fd_start, fd_end) {
          fd_start = fd_start || 0;
          fd_end = fd_end || FS.MAX_OPEN_FDS;
          for (var fd = fd_start; fd <= fd_end; fd++) {
            if (!FS.streams[fd]) {
              return fd
            }
          }
          throw new FS.ErrnoError(24)
        },
        getStream: function (fd) {
          return FS.streams[fd]
        },
        createStream: function (stream, fd_start, fd_end) {
          if (!FS.FSStream) {
            FS.FSStream = function () { };
            FS.FSStream.prototype = {};
            Object.defineProperties(FS.FSStream.prototype, {
              object: {
                get: function () {
                  return this.node
                },
                set: function (val) {
                  this.node = val
                }
              },
              isRead: {
                get: function () {
                  return (this.flags & 2097155) !== 1
                }
              },
              isWrite: {
                get: function () {
                  return (this.flags & 2097155) !== 0
                }
              },
              isAppend: {
                get: function () {
                  return this.flags & 1024
                }
              }
            })
          }
          var newStream = new FS.FSStream;
          for (var p in stream) {
            newStream[p] = stream[p]
          }
          stream = newStream;
          var fd = FS.nextfd(fd_start, fd_end);
          stream.fd = fd;
          FS.streams[fd] = stream;
          return stream
        },
        closeStream: function (fd) {
          FS.streams[fd] = null
        },
        chrdev_stream_ops: {
          open: function (stream) {
            var device = FS.getDevice(stream.node.rdev);
            stream.stream_ops = device.stream_ops;
            if (stream.stream_ops.open) {
              stream.stream_ops.open(stream)
            }
          },
          llseek: function () {
            throw new FS.ErrnoError(29)
          }
        },
        major: function (dev) {
          return dev >> 8
        },
        minor: function (dev) {
          return dev & 255
        },
        makedev: function (ma, mi) {
          return ma << 8 | mi
        },
        registerDevice: function (dev, ops) {
          FS.devices[dev] = {
            stream_ops: ops
          }
        },
        getDevice: function (dev) {
          return FS.devices[dev]
        },
        getMounts: function (mount) {
          var mounts = [];
          var check = [mount];
          while (check.length) {
            var m = check.pop();
            mounts.push(m);
            check.push.apply(check, m.mounts)
          }
          return mounts
        },
        syncfs: function (populate, callback) {
          if (typeof populate === "function") {
            callback = populate;
            populate = false
          }
          FS.syncFSRequests++;
          if (FS.syncFSRequests > 1) {
            console.log("warning: " + FS.syncFSRequests + " FS.syncfs operations in flight at once, probably just doing extra work")
          }
          var mounts = FS.getMounts(FS.root.mount);
          var completed = 0;

          function doCallback(err) {
            FS.syncFSRequests--;
            return callback(err)
          }

          function done(err) {
            if (err) {
              if (!done.errored) {
                done.errored = true;
                return doCallback(err)
              }
              return
            }
            if (++completed >= mounts.length) {
              doCallback(null)
            }
          }
          mounts.forEach(function (mount) {
            if (!mount.type.syncfs) {
              return done(null)
            }
            mount.type.syncfs(mount, populate, done)
          })
        },
        mount: function (type, opts, mountpoint) {
          var root = mountpoint === "/";
          var pseudo = !mountpoint;
          var node;
          if (root && FS.root) {
            throw new FS.ErrnoError(16)
          } else if (!root && !pseudo) {
            var lookup = FS.lookupPath(mountpoint, {
              follow_mount: false
            });
            mountpoint = lookup.path;
            node = lookup.node;
            if (FS.isMountpoint(node)) {
              throw new FS.ErrnoError(16)
            }
            if (!FS.isDir(node.mode)) {
              throw new FS.ErrnoError(20)
            }
          }
          var mount = {
            type: type,
            opts: opts,
            mountpoint: mountpoint,
            mounts: []
          };
          var mountRoot = type.mount(mount);
          mountRoot.mount = mount;
          mount.root = mountRoot;
          if (root) {
            FS.root = mountRoot
          } else if (node) {
            node.mounted = mount;
            if (node.mount) {
              node.mount.mounts.push(mount)
            }
          }
          return mountRoot
        },
        unmount: function (mountpoint) {
          var lookup = FS.lookupPath(mountpoint, {
            follow_mount: false
          });
          if (!FS.isMountpoint(lookup.node)) {
            throw new FS.ErrnoError(22)
          }
          var node = lookup.node;
          var mount = node.mounted;
          var mounts = FS.getMounts(mount);
          Object.keys(FS.nameTable)
            .forEach(function (hash) {
              var current = FS.nameTable[hash];
              while (current) {
                var next = current.name_next;
                if (mounts.indexOf(current.mount) !== -1) {
                  FS.destroyNode(current)
                }
                current = next
              }
            });
          node.mounted = null;
          var idx = node.mount.mounts.indexOf(mount);
          node.mount.mounts.splice(idx, 1)
        },
        lookup: function (parent, name) {
          return parent.node_ops.lookup(parent, name)
        },
        mknod: function (path, mode, dev) {
          var lookup = FS.lookupPath(path, {
            parent: true
          });
          var parent = lookup.node;
          var name = PATH.basename(path);
          if (!name || name === "." || name === "..") {
            throw new FS.ErrnoError(22)
          }
          var err = FS.mayCreate(parent, name);
          if (err) {
            throw new FS.ErrnoError(err)
          }
          if (!parent.node_ops.mknod) {
            throw new FS.ErrnoError(1)
          }
          return parent.node_ops.mknod(parent, name, mode, dev)
        },
        create: function (path, mode) {
          mode = mode !== undefined ? mode : 438;
          mode &= 4095;
          mode |= 32768;
          return FS.mknod(path, mode, 0)
        },
        mkdir: function (path, mode) {
          mode = mode !== undefined ? mode : 511;
          mode &= 511 | 512;
          mode |= 16384;
          return FS.mknod(path, mode, 0)
        },
        mkdirTree: function (path, mode) {
          var dirs = path.split("/");
          var d = "";
          for (var i = 0; i < dirs.length; ++i) {
            if (!dirs[i]) continue;
            d += "/" + dirs[i];
            try {
              FS.mkdir(d, mode)
            } catch (e) {
              if (e.errno != 17) throw e
            }
          }
        },
        mkdev: function (path, mode, dev) {
          if (typeof dev === "undefined") {
            dev = mode;
            mode = 438
          }
          mode |= 8192;
          return FS.mknod(path, mode, dev)
        },
        symlink: function (oldpath, newpath) {
          if (!PATH.resolve(oldpath)) {
            throw new FS.ErrnoError(2)
          }
          var lookup = FS.lookupPath(newpath, {
            parent: true
          });
          var parent = lookup.node;
          if (!parent) {
            throw new FS.ErrnoError(2)
          }
          var newname = PATH.basename(newpath);
          var err = FS.mayCreate(parent, newname);
          if (err) {
            throw new FS.ErrnoError(err)
          }
          if (!parent.node_ops.symlink) {
            throw new FS.ErrnoError(1)
          }
          return parent.node_ops.symlink(parent, newname, oldpath)
        },
        rename: function (old_path, new_path) {
          var old_dirname = PATH.dirname(old_path);
          var new_dirname = PATH.dirname(new_path);
          var old_name = PATH.basename(old_path);
          var new_name = PATH.basename(new_path);
          var lookup, old_dir, new_dir;
          try {
            lookup = FS.lookupPath(old_path, {
              parent: true
            });
            old_dir = lookup.node;
            lookup = FS.lookupPath(new_path, {
              parent: true
            });
            new_dir = lookup.node
          } catch (e) {
            throw new FS.ErrnoError(16)
          }
          if (!old_dir || !new_dir) throw new FS.ErrnoError(2);
          if (old_dir.mount !== new_dir.mount) {
            throw new FS.ErrnoError(18)
          }
          var old_node = FS.lookupNode(old_dir, old_name);
          var relative = PATH.relative(old_path, new_dirname);
          if (relative.charAt(0) !== ".") {
            throw new FS.ErrnoError(22)
          }
          relative = PATH.relative(new_path, old_dirname);
          if (relative.charAt(0) !== ".") {
            throw new FS.ErrnoError(39)
          }
          var new_node;
          try {
            new_node = FS.lookupNode(new_dir, new_name)
          } catch (e) { }
          if (old_node === new_node) {
            return
          }
          var isdir = FS.isDir(old_node.mode);
          var err = FS.mayDelete(old_dir, old_name, isdir);
          if (err) {
            throw new FS.ErrnoError(err)
          }
          err = new_node ? FS.mayDelete(new_dir, new_name, isdir) : FS.mayCreate(new_dir, new_name);
          if (err) {
            throw new FS.ErrnoError(err)
          }
          if (!old_dir.node_ops.rename) {
            throw new FS.ErrnoError(1)
          }
          if (FS.isMountpoint(old_node) || new_node && FS.isMountpoint(new_node)) {
            throw new FS.ErrnoError(16)
          }
          if (new_dir !== old_dir) {
            err = FS.nodePermissions(old_dir, "w");
            if (err) {
              throw new FS.ErrnoError(err)
            }
          }
          try {
            if (FS.trackingDelegate["willMovePath"]) {
              FS.trackingDelegate["willMovePath"](old_path, new_path)
            }
          } catch (e) {
            console.log("FS.trackingDelegate['willMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message)
          }
          FS.hashRemoveNode(old_node);
          try {
            old_dir.node_ops.rename(old_node, new_dir, new_name)
          } catch (e) {
            throw e
          } finally {
            FS.hashAddNode(old_node)
          }
          try {
            if (FS.trackingDelegate["onMovePath"]) FS.trackingDelegate["onMovePath"](old_path, new_path)
          } catch (e) {
            console.log("FS.trackingDelegate['onMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message)
          }
        },
        rmdir: function (path) {
          var lookup = FS.lookupPath(path, {
            parent: true
          });
          var parent = lookup.node;
          var name = PATH.basename(path);
          var node = FS.lookupNode(parent, name);
          var err = FS.mayDelete(parent, name, true);
          if (err) {
            throw new FS.ErrnoError(err)
          }
          if (!parent.node_ops.rmdir) {
            throw new FS.ErrnoError(1)
          }
          if (FS.isMountpoint(node)) {
            throw new FS.ErrnoError(16)
          }
          try {
            if (FS.trackingDelegate["willDeletePath"]) {
              FS.trackingDelegate["willDeletePath"](path)
            }
          } catch (e) {
            console.log("FS.trackingDelegate['willDeletePath']('" + path + "') threw an exception: " + e.message)
          }
          parent.node_ops.rmdir(parent, name);
          FS.destroyNode(node);
          try {
            if (FS.trackingDelegate["onDeletePath"]) FS.trackingDelegate["onDeletePath"](path)
          } catch (e) {
            console.log("FS.trackingDelegate['onDeletePath']('" + path + "') threw an exception: " + e.message)
          }
        },
        readdir: function (path) {
          var lookup = FS.lookupPath(path, {
            follow: true
          });
          var node = lookup.node;
          if (!node.node_ops.readdir) {
            throw new FS.ErrnoError(20)
          }
          return node.node_ops.readdir(node)
        },
        unlink: function (path) {
          var lookup = FS.lookupPath(path, {
            parent: true
          });
          var parent = lookup.node;
          var name = PATH.basename(path);
          var node = FS.lookupNode(parent, name);
          var err = FS.mayDelete(parent, name, false);
          if (err) {
            throw new FS.ErrnoError(err)
          }
          if (!parent.node_ops.unlink) {
            throw new FS.ErrnoError(1)
          }
          if (FS.isMountpoint(node)) {
            throw new FS.ErrnoError(16)
          }
          try {
            if (FS.trackingDelegate["willDeletePath"]) {
              FS.trackingDelegate["willDeletePath"](path)
            }
          } catch (e) {
            console.log("FS.trackingDelegate['willDeletePath']('" + path + "') threw an exception: " + e.message)
          }
          parent.node_ops.unlink(parent, name);
          FS.destroyNode(node);
          try {
            if (FS.trackingDelegate["onDeletePath"]) FS.trackingDelegate["onDeletePath"](path)
          } catch (e) {
            console.log("FS.trackingDelegate['onDeletePath']('" + path + "') threw an exception: " + e.message)
          }
        },
        readlink: function (path) {
          var lookup = FS.lookupPath(path);
          var link = lookup.node;
          if (!link) {
            throw new FS.ErrnoError(2)
          }
          if (!link.node_ops.readlink) {
            throw new FS.ErrnoError(22)
          }
          return PATH.resolve(FS.getPath(link.parent), link.node_ops.readlink(link))
        },
        stat: function (path, dontFollow) {
          var lookup = FS.lookupPath(path, {
            follow: !dontFollow
          });
          var node = lookup.node;
          if (!node) {
            throw new FS.ErrnoError(2)
          }
          if (!node.node_ops.getattr) {
            throw new FS.ErrnoError(1)
          }
          return node.node_ops.getattr(node)
        },
        lstat: function (path) {
          return FS.stat(path, true)
        },
        chmod: function (path, mode, dontFollow) {
          var node;
          if (typeof path === "string") {
            var lookup = FS.lookupPath(path, {
              follow: !dontFollow
            });
            node = lookup.node
          } else {
            node = path
          }
          if (!node.node_ops.setattr) {
            throw new FS.ErrnoError(1)
          }
          node.node_ops.setattr(node, {
            mode: mode & 4095 | node.mode & ~4095,
            timestamp: Date.now()
          })
        },
        lchmod: function (path, mode) {
          FS.chmod(path, mode, true)
        },
        fchmod: function (fd, mode) {
          var stream = FS.getStream(fd);
          if (!stream) {
            throw new FS.ErrnoError(9)
          }
          FS.chmod(stream.node, mode)
        },
        chown: function (path, uid, gid, dontFollow) {
          var node;
          if (typeof path === "string") {
            var lookup = FS.lookupPath(path, {
              follow: !dontFollow
            });
            node = lookup.node
          } else {
            node = path
          }
          if (!node.node_ops.setattr) {
            throw new FS.ErrnoError(1)
          }
          node.node_ops.setattr(node, {
            timestamp: Date.now()
          })
        },
        lchown: function (path, uid, gid) {
          FS.chown(path, uid, gid, true)
        },
        fchown: function (fd, uid, gid) {
          var stream = FS.getStream(fd);
          if (!stream) {
            throw new FS.ErrnoError(9)
          }
          FS.chown(stream.node, uid, gid)
        },
        truncate: function (path, len) {
          if (len < 0) {
            throw new FS.ErrnoError(22)
          }
          var node;
          if (typeof path === "string") {
            var lookup = FS.lookupPath(path, {
              follow: true
            });
            node = lookup.node
          } else {
            node = path
          }
          if (!node.node_ops.setattr) {
            throw new FS.ErrnoError(1)
          }
          if (FS.isDir(node.mode)) {
            throw new FS.ErrnoError(21)
          }
          if (!FS.isFile(node.mode)) {
            throw new FS.ErrnoError(22)
          }
          var err = FS.nodePermissions(node, "w");
          if (err) {
            throw new FS.ErrnoError(err)
          }
          node.node_ops.setattr(node, {
            size: len,
            timestamp: Date.now()
          })
        },
        ftruncate: function (fd, len) {
          var stream = FS.getStream(fd);
          if (!stream) {
            throw new FS.ErrnoError(9)
          }
          if ((stream.flags & 2097155) === 0) {
            throw new FS.ErrnoError(22)
          }
          FS.truncate(stream.node, len)
        },
        utime: function (path, atime, mtime) {
          var lookup = FS.lookupPath(path, {
            follow: true
          });
          var node = lookup.node;
          node.node_ops.setattr(node, {
            timestamp: Math.max(atime, mtime)
          })
        },
        open: function (path, flags, mode, fd_start, fd_end) {
          if (path === "") {
            throw new FS.ErrnoError(2)
          }
          flags = typeof flags === "string" ? FS.modeStringToFlags(flags) : flags;
          mode = typeof mode === "undefined" ? 438 : mode;
          if (flags & 64) {
            mode = mode & 4095 | 32768
          } else {
            mode = 0
          }
          var node;
          if (typeof path === "object") {
            node = path
          } else {
            path = PATH.normalize(path);
            try {
              var lookup = FS.lookupPath(path, {
                follow: !(flags & 131072)
              });
              node = lookup.node
            } catch (e) { }
          }
          var created = false;
          if (flags & 64) {
            if (node) {
              if (flags & 128) {
                throw new FS.ErrnoError(17)
              }
            } else {
              node = FS.mknod(path, mode, 0);
              created = true
            }
          }
          if (!node) {
            throw new FS.ErrnoError(2)
          }
          if (FS.isChrdev(node.mode)) {
            flags &= ~512
          }
          if (flags & 65536 && !FS.isDir(node.mode)) {
            throw new FS.ErrnoError(20)
          }
          if (!created) {
            var err = FS.mayOpen(node, flags);
            if (err) {
              throw new FS.ErrnoError(err)
            }
          }
          if (flags & 512) {
            FS.truncate(node, 0)
          }
          flags &= ~(128 | 512);
          var stream = FS.createStream({
            node: node,
            path: FS.getPath(node),
            flags: flags,
            seekable: true,
            position: 0,
            stream_ops: node.stream_ops,
            ungotten: [],
            error: false
          }, fd_start, fd_end);
          if (stream.stream_ops.open) {
            stream.stream_ops.open(stream)
          }
          if (Module["logReadFiles"] && !(flags & 1)) {
            if (!FS.readFiles) FS.readFiles = {};
            if (!(path in FS.readFiles)) {
              FS.readFiles[path] = 1;
              console.log("FS.trackingDelegate error on read file: " + path)
            }
          }
          try {
            if (FS.trackingDelegate["onOpenFile"]) {
              var trackingFlags = 0;
              if ((flags & 2097155) !== 1) {
                trackingFlags |= FS.tracking.openFlags.READ
              }
              if ((flags & 2097155) !== 0) {
                trackingFlags |= FS.tracking.openFlags.WRITE
              }
              FS.trackingDelegate["onOpenFile"](path, trackingFlags)
            }
          } catch (e) {
            console.log("FS.trackingDelegate['onOpenFile']('" + path + "', flags) threw an exception: " + e.message)
          }
          return stream
        },
        close: function (stream) {
          if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(9)
          }
          if (stream.getdents) stream.getdents = null;
          try {
            if (stream.stream_ops.close) {
              stream.stream_ops.close(stream)
            }
          } catch (e) {
            throw e
          } finally {
            FS.closeStream(stream.fd)
          }
          stream.fd = null
        },
        isClosed: function (stream) {
          return stream.fd === null
        },
        llseek: function (stream, offset, whence) {
          if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(9)
          }
          if (!stream.seekable || !stream.stream_ops.llseek) {
            throw new FS.ErrnoError(29)
          }
          if (whence != 0 && whence != 1 && whence != 2) {
            throw new FS.ErrnoError(22)
          }
          stream.position = stream.stream_ops.llseek(stream, offset, whence);
          stream.ungotten = [];
          return stream.position
        },
        read: function (stream, buffer, offset, length, position) {
          if (length < 0 || position < 0) {
            throw new FS.ErrnoError(22)
          }
          if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(9)
          }
          if ((stream.flags & 2097155) === 1) {
            throw new FS.ErrnoError(9)
          }
          if (FS.isDir(stream.node.mode)) {
            throw new FS.ErrnoError(21)
          }
          if (!stream.stream_ops.read) {
            throw new FS.ErrnoError(22)
          }
          var seeking = typeof position !== "undefined";
          if (!seeking) {
            position = stream.position
          } else if (!stream.seekable) {
            throw new FS.ErrnoError(29)
          }
          var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
          if (!seeking) stream.position += bytesRead;
          return bytesRead
        },
        write: function (stream, buffer, offset, length, position, canOwn) {
          if (length < 0 || position < 0) {
            throw new FS.ErrnoError(22)
          }
          if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(9)
          }
          if ((stream.flags & 2097155) === 0) {
            throw new FS.ErrnoError(9)
          }
          if (FS.isDir(stream.node.mode)) {
            throw new FS.ErrnoError(21)
          }
          if (!stream.stream_ops.write) {
            throw new FS.ErrnoError(22)
          }
          if (stream.flags & 1024) {
            FS.llseek(stream, 0, 2)
          }
          var seeking = typeof position !== "undefined";
          if (!seeking) {
            position = stream.position
          } else if (!stream.seekable) {
            throw new FS.ErrnoError(29)
          }
          var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
          if (!seeking) stream.position += bytesWritten;
          try {
            if (stream.path && FS.trackingDelegate["onWriteToFile"]) FS.trackingDelegate["onWriteToFile"](stream.path)
          } catch (e) {
            console.log("FS.trackingDelegate['onWriteToFile']('" + stream.path + "') threw an exception: " + e.message)
          }
          return bytesWritten
        },
        allocate: function (stream, offset, length) {
          if (FS.isClosed(stream)) {
            throw new FS.ErrnoError(9)
          }
          if (offset < 0 || length <= 0) {
            throw new FS.ErrnoError(22)
          }
          if ((stream.flags & 2097155) === 0) {
            throw new FS.ErrnoError(9)
          }
          if (!FS.isFile(stream.node.mode) && !FS.isDir(stream.node.mode)) {
            throw new FS.ErrnoError(19)
          }
          if (!stream.stream_ops.allocate) {
            throw new FS.ErrnoError(95)
          }
          stream.stream_ops.allocate(stream, offset, length)
        },
        mmap: function (stream, buffer, offset, length, position, prot, flags) {
          if ((stream.flags & 2097155) === 1) {
            throw new FS.ErrnoError(13)
          }
          if (!stream.stream_ops.mmap) {
            throw new FS.ErrnoError(19)
          }
          return stream.stream_ops.mmap(stream, buffer, offset, length, position, prot, flags)
        },
        msync: function (stream, buffer, offset, length, mmapFlags) {
          if (!stream || !stream.stream_ops.msync) {
            return 0
          }
          return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags)
        },
        munmap: function (stream) {
          return 0
        },
        ioctl: function (stream, cmd, arg) {
          if (!stream.stream_ops.ioctl) {
            throw new FS.ErrnoError(25)
          }
          return stream.stream_ops.ioctl(stream, cmd, arg)
        },
        readFile: function (path, opts) {
          opts = opts || {};
          opts.flags = opts.flags || "r";
          opts.encoding = opts.encoding || "binary";
          if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
            throw new Error('Invalid encoding type "' + opts.encoding + '"')
          }
          var ret;
          var stream = FS.open(path, opts.flags);
          var stat = FS.stat(path);
          var length = stat.size;
          var buf = new Uint8Array(length);
          FS.read(stream, buf, 0, length, 0);
          if (opts.encoding === "utf8") {
            ret = UTF8ArrayToString(buf, 0)
          } else if (opts.encoding === "binary") {
            ret = buf
          }
          FS.close(stream);
          return ret
        },
        writeFile: function (path, data, opts) {
          opts = opts || {};
          opts.flags = opts.flags || "w";
          var stream = FS.open(path, opts.flags, opts.mode);
          if (typeof data === "string") {
            var buf = new Uint8Array(lengthBytesUTF8(data) + 1);
            var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
            FS.write(stream, buf, 0, actualNumBytes, undefined, opts.canOwn)
          } else if (ArrayBuffer.isView(data)) {
            FS.write(stream, data, 0, data.byteLength, undefined, opts.canOwn)
          } else {
            throw new Error("Unsupported data type")
          }
          FS.close(stream)
        },
        cwd: function () {
          return FS.currentPath
        },
        chdir: function (path) {
          var lookup = FS.lookupPath(path, {
            follow: true
          });
          if (lookup.node === null) {
            throw new FS.ErrnoError(2)
          }
          if (!FS.isDir(lookup.node.mode)) {
            throw new FS.ErrnoError(20)
          }
          var err = FS.nodePermissions(lookup.node, "x");
          if (err) {
            throw new FS.ErrnoError(err)
          }
          FS.currentPath = lookup.path
        },
        createDefaultDirectories: function () {
          FS.mkdir("/tmp");
          FS.mkdir("/home");
          FS.mkdir("/home/web_user")
        },
        createDefaultDevices: function () {
          FS.mkdir("/dev");
          FS.registerDevice(FS.makedev(1, 3), {
            read: function () {
              return 0
            },
            write: function (stream, buffer, offset, length, pos) {
              return length
            }
          });
          FS.mkdev("/dev/null", FS.makedev(1, 3));
          TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
          TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
          FS.mkdev("/dev/tty", FS.makedev(5, 0));
          FS.mkdev("/dev/tty1", FS.makedev(6, 0));
          var random_device;
          if (typeof crypto === "object" && typeof crypto["getRandomValues"] === "function") {
            var randomBuffer = new Uint8Array(1);
            random_device = function () {
              crypto.getRandomValues(randomBuffer);
              return randomBuffer[0]
            }
          } else if (ENVIRONMENT_IS_NODE) {
            try {
              var crypto_module = require("crypto");
              random_device = function () {
                return crypto_module["randomBytes"](1)[0]
              }
            } catch (e) { }
          } else { }
          if (!random_device) {
            random_device = function () {
              abort("random_device")
            }
          }
          FS.createDevice("/dev", "random", random_device);
          FS.createDevice("/dev", "urandom", random_device);
          FS.mkdir("/dev/shm");
          FS.mkdir("/dev/shm/tmp")
        },
        createSpecialDirectories: function () {
          FS.mkdir("/proc");
          FS.mkdir("/proc/self");
          FS.mkdir("/proc/self/fd");
          FS.mount({
            mount: function () {
              var node = FS.createNode("/proc/self", "fd", 16384 | 511, 73);
              node.node_ops = {
                lookup: function (parent, name) {
                  var fd = +name;
                  var stream = FS.getStream(fd);
                  if (!stream) throw new FS.ErrnoError(9);
                  var ret = {
                    parent: null,
                    mount: {
                      mountpoint: "fake"
                    },
                    node_ops: {
                      readlink: function () {
                        return stream.path
                      }
                    }
                  };
                  ret.parent = ret;
                  return ret
                }
              };
              return node
            }
          }, {}, "/proc/self/fd")
        },
        createStandardStreams: function () {
          if (Module["stdin"]) {
            FS.createDevice("/dev", "stdin", Module["stdin"])
          } else {
            FS.symlink("/dev/tty", "/dev/stdin")
          }
          if (Module["stdout"]) {
            FS.createDevice("/dev", "stdout", null, Module["stdout"])
          } else {
            FS.symlink("/dev/tty", "/dev/stdout")
          }
          if (Module["stderr"]) {
            FS.createDevice("/dev", "stderr", null, Module["stderr"])
          } else {
            FS.symlink("/dev/tty1", "/dev/stderr")
          }
          var stdin = FS.open("/dev/stdin", "r");
          var stdout = FS.open("/dev/stdout", "w");
          var stderr = FS.open("/dev/stderr", "w")
        },
        ensureErrnoError: function () {
          if (FS.ErrnoError) return;
          FS.ErrnoError = function ErrnoError(errno, node) {
            this.node = node;
            this.setErrno = function (errno) {
              this.errno = errno
            };
            this.setErrno(errno);
            this.message = "FS error";
            if (this.stack) Object.defineProperty(this, "stack", {
              value: (new Error)
                .stack,
              writable: true
            })
          };
          FS.ErrnoError.prototype = new Error;
          FS.ErrnoError.prototype.constructor = FS.ErrnoError;
          [2].forEach(function (code) {
            FS.genericErrors[code] = new FS.ErrnoError(code);
            FS.genericErrors[code].stack = "<generic error, no stack>"
          })
        },
        staticInit: function () {
          FS.ensureErrnoError();
          FS.nameTable = new Array(4096);
          FS.mount(MEMFS, {}, "/");
          FS.createDefaultDirectories();
          FS.createDefaultDevices();
          FS.createSpecialDirectories();
          FS.filesystems = {
            "MEMFS": MEMFS,
            "NODEFS": NODEFS
          }
        },
        init: function (input, output, error) {
          FS.init.initialized = true;
          FS.ensureErrnoError();
          Module["stdin"] = input || Module["stdin"];
          Module["stdout"] = output || Module["stdout"];
          Module["stderr"] = error || Module["stderr"];
          FS.createStandardStreams()
        },
        quit: function () {
          FS.init.initialized = false;
          var fflush = Module["_fflush"];
          if (fflush) fflush(0);
          for (var i = 0; i < FS.streams.length; i++) {
            var stream = FS.streams[i];
            if (!stream) {
              continue
            }
            FS.close(stream)
          }
        },
        getMode: function (canRead, canWrite) {
          var mode = 0;
          if (canRead) mode |= 292 | 73;
          if (canWrite) mode |= 146;
          return mode
        },
        joinPath: function (parts, forceRelative) {
          var path = PATH.join.apply(null, parts);
          if (forceRelative && path[0] == "/") path = path.substr(1);
          return path
        },
        absolutePath: function (relative, base) {
          return PATH.resolve(base, relative)
        },
        standardizePath: function (path) {
          return PATH.normalize(path)
        },
        findObject: function (path, dontResolveLastLink) {
          var ret = FS.analyzePath(path, dontResolveLastLink);
          if (ret.exists) {
            return ret.object
          } else {
            ___setErrNo(ret.error);
            return null
          }
        },
        analyzePath: function (path, dontResolveLastLink) {
          try {
            var lookup = FS.lookupPath(path, {
              follow: !dontResolveLastLink
            });
            path = lookup.path
          } catch (e) { }
          var ret = {
            isRoot: false,
            exists: false,
            error: 0,
            name: null,
            path: null,
            object: null,
            parentExists: false,
            parentPath: null,
            parentObject: null
          };
          try {
            var lookup = FS.lookupPath(path, {
              parent: true
            });
            ret.parentExists = true;
            ret.parentPath = lookup.path;
            ret.parentObject = lookup.node;
            ret.name = PATH.basename(path);
            lookup = FS.lookupPath(path, {
              follow: !dontResolveLastLink
            });
            ret.exists = true;
            ret.path = lookup.path;
            ret.object = lookup.node;
            ret.name = lookup.node.name;
            ret.isRoot = lookup.path === "/"
          } catch (e) {
            ret.error = e.errno
          }
          return ret
        },
        createFolder: function (parent, name, canRead, canWrite) {
          var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
          var mode = FS.getMode(canRead, canWrite);
          return FS.mkdir(path, mode)
        },
        createPath: function (parent, path, canRead, canWrite) {
          parent = typeof parent === "string" ? parent : FS.getPath(parent);
          var parts = path.split("/")
            .reverse();
          while (parts.length) {
            var part = parts.pop();
            if (!part) continue;
            var current = PATH.join2(parent, part);
            try {
              FS.mkdir(current)
            } catch (e) { }
            parent = current
          }
          return current
        },
        createFile: function (parent, name, properties, canRead, canWrite) {
          var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
          var mode = FS.getMode(canRead, canWrite);
          return FS.create(path, mode)
        },
        createDataFile: function (parent, name, data, canRead, canWrite, canOwn) {
          var path = name ? PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name) : parent;
          var mode = FS.getMode(canRead, canWrite);
          var node = FS.create(path, mode);
          if (data) {
            if (typeof data === "string") {
              var arr = new Array(data.length);
              for (var i = 0, len = data.length; i < len; ++i) arr[i] = data.charCodeAt(i);
              data = arr
            }
            FS.chmod(node, mode | 146);
            var stream = FS.open(node, "w");
            FS.write(stream, data, 0, data.length, 0, canOwn);
            FS.close(stream);
            FS.chmod(node, mode)
          }
          return node
        },
        createDevice: function (parent, name, input, output) {
          var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
          var mode = FS.getMode(!!input, !!output);
          if (!FS.createDevice.major) FS.createDevice.major = 64;
          var dev = FS.makedev(FS.createDevice.major++, 0);
          FS.registerDevice(dev, {
            open: function (stream) {
              stream.seekable = false
            },
            close: function (stream) {
              if (output && output.buffer && output.buffer.length) {
                output(10)
              }
            },
            read: function (stream, buffer, offset, length, pos) {
              var bytesRead = 0;
              for (var i = 0; i < length; i++) {
                var result;
                try {
                  result = input()
                } catch (e) {
                  throw new FS.ErrnoError(5)
                }
                if (result === undefined && bytesRead === 0) {
                  throw new FS.ErrnoError(11)
                }
                if (result === null || result === undefined) break;
                bytesRead++;
                buffer[offset + i] = result
              }
              if (bytesRead) {
                stream.node.timestamp = Date.now()
              }
              return bytesRead
            },
            write: function (stream, buffer, offset, length, pos) {
              for (var i = 0; i < length; i++) {
                try {
                  output(buffer[offset + i])
                } catch (e) {
                  throw new FS.ErrnoError(5)
                }
              }
              if (length) {
                stream.node.timestamp = Date.now()
              }
              return i
            }
          });
          return FS.mkdev(path, mode, dev)
        },
        createLink: function (parent, name, target, canRead, canWrite) {
          var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
          return FS.symlink(target, path)
        },
        forceLoadFile: function (obj) {
          if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
          var success = true;
          if (typeof XMLHttpRequest !== "undefined") {
            throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.")
          } else if (Module["read"]) {
            try {
              obj.contents = intArrayFromString(Module["read"](obj.url), true);
              obj.usedBytes = obj.contents.length
            } catch (e) {
              success = false
            }
          } else {
            throw new Error("Cannot load without read() or XMLHttpRequest.")
          }
          if (!success) ___setErrNo(5);
          return success
        },
        createLazyFile: function (parent, name, url, canRead, canWrite) {
          function LazyUint8Array() {
            this.lengthKnown = false;
            this.chunks = []
          }
          LazyUint8Array.prototype.get = function LazyUint8Array_get(idx) {
            if (idx > this.length - 1 || idx < 0) {
              return undefined
            }
            var chunkOffset = idx % this.chunkSize;
            var chunkNum = idx / this.chunkSize | 0;
            return this.getter(chunkNum)[chunkOffset]
          };
          LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
            this.getter = getter
          };
          LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
            var xhr = new XMLHttpRequest;
            xhr.open("HEAD", url, false);
            xhr.send(null);
            if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
            var datalength = Number(xhr.getResponseHeader("Content-length"));
            var header;
            var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
            var usesGzip = (header = xhr.getResponseHeader("Content-Encoding")) && header === "gzip";
            var chunkSize = 1024 * 1024;
            if (!hasByteServing) chunkSize = datalength;
            var doXHR = function (from, to) {
              if (from > to) throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
              if (to > datalength - 1) throw new Error("only " + datalength + " bytes available! programmer error!");
              var xhr = new XMLHttpRequest;
              xhr.open("GET", url, false);
              if (datalength !== chunkSize) xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
              if (typeof Uint8Array != "undefined") xhr.responseType = "arraybuffer";
              if (xhr.overrideMimeType) {
                xhr.overrideMimeType("text/plain; charset=x-user-defined")
              }
              xhr.send(null);
              if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
              if (xhr.response !== undefined) {
                return new Uint8Array(xhr.response || [])
              } else {
                return intArrayFromString(xhr.responseText || "", true)
              }
            };
            var lazyArray = this;
            lazyArray.setDataGetter(function (chunkNum) {
              var start = chunkNum * chunkSize;
              var end = (chunkNum + 1) * chunkSize - 1;
              end = Math.min(end, datalength - 1);
              if (typeof lazyArray.chunks[chunkNum] === "undefined") {
                lazyArray.chunks[chunkNum] = doXHR(start, end)
              }
              if (typeof lazyArray.chunks[chunkNum] === "undefined") throw new Error("doXHR failed!");
              return lazyArray.chunks[chunkNum]
            });
            if (usesGzip || !datalength) {
              chunkSize = datalength = 1;
              datalength = this.getter(0)
                .length;
              chunkSize = datalength;
              console.log("LazyFiles on gzip forces download of the whole file when length is accessed")
            }
            this._length = datalength;
            this._chunkSize = chunkSize;
            this.lengthKnown = true
          };
          if (typeof XMLHttpRequest !== "undefined") {
            if (!ENVIRONMENT_IS_WORKER) throw "Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";
            var lazyArray = new LazyUint8Array;
            Object.defineProperties(lazyArray, {
              length: {
                get: function () {
                  if (!this.lengthKnown) {
                    this.cacheLength()
                  }
                  return this._length
                }
              },
              chunkSize: {
                get: function () {
                  if (!this.lengthKnown) {
                    this.cacheLength()
                  }
                  return this._chunkSize
                }
              }
            });
            var properties = {
              isDevice: false,
              contents: lazyArray
            }
          } else {
            var properties = {
              isDevice: false,
              url: url
            }
          }
          var node = FS.createFile(parent, name, properties, canRead, canWrite);
          if (properties.contents) {
            node.contents = properties.contents
          } else if (properties.url) {
            node.contents = null;
            node.url = properties.url
          }
          Object.defineProperties(node, {
            usedBytes: {
              get: function () {
                return this.contents.length
              }
            }
          });
          var stream_ops = {};
          var keys = Object.keys(node.stream_ops);
          keys.forEach(function (key) {
            var fn = node.stream_ops[key];
            stream_ops[key] = function forceLoadLazyFile() {
              if (!FS.forceLoadFile(node)) {
                throw new FS.ErrnoError(5)
              }
              return fn.apply(null, arguments)
            }
          });
          stream_ops.read = function stream_ops_read(stream, buffer, offset, length, position) {
            if (!FS.forceLoadFile(node)) {
              throw new FS.ErrnoError(5)
            }
            var contents = stream.node.contents;
            if (position >= contents.length) return 0;
            var size = Math.min(contents.length - position, length);
            if (contents.slice) {
              for (var i = 0; i < size; i++) {
                buffer[offset + i] = contents[position + i]
              }
            } else {
              for (var i = 0; i < size; i++) {
                buffer[offset + i] = contents.get(position + i)
              }
            }
            return size
          };
          node.stream_ops = stream_ops;
          return node
        },
        createPreloadedFile: function (parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) {
          Browser.init();
          var fullname = name ? PATH.resolve(PATH.join2(parent, name)) : parent;
          var dep = getUniqueRunDependency("cp " + fullname);

          function processData(byteArray) {
            function finish(byteArray) {
              if (preFinish) preFinish();
              if (!dontCreateFile) {
                FS.createDataFile(parent, name, byteArray, canRead, canWrite, canOwn)
              }
              if (onload) onload();
              removeRunDependency(dep)
            }
            var handled = false;
            Module["preloadPlugins"].forEach(function (plugin) {
              if (handled) return;
              if (plugin["canHandle"](fullname)) {
                plugin["handle"](byteArray, fullname, finish, function () {
                  if (onerror) onerror();
                  removeRunDependency(dep)
                });
                handled = true
              }
            });
            if (!handled) finish(byteArray)
          }
          addRunDependency(dep);
          if (typeof url == "string") {
            Browser.asyncLoad(url, function (byteArray) {
              processData(byteArray)
            }, onerror)
          } else {
            processData(url)
          }
        },
        indexedDB: function () {
          return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB
        },
        DB_NAME: function () {
          return "EM_FS_" + window.location.pathname
        },
        DB_VERSION: 20,
        DB_STORE_NAME: "FILE_DATA",
        saveFilesToDB: function (paths, onload, onerror) {
          onload = onload || function () { };
          onerror = onerror || function () { };
          var indexedDB = FS.indexedDB();
          try {
            var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION)
          } catch (e) {
            return onerror(e)
          }
          openRequest.onupgradeneeded = function openRequest_onupgradeneeded() {
            console.log("creating db");
            var db = openRequest.result;
            db.createObjectStore(FS.DB_STORE_NAME)
          };
          openRequest.onsuccess = function openRequest_onsuccess() {
            var db = openRequest.result;
            var transaction = db.transaction([FS.DB_STORE_NAME], "readwrite");
            var files = transaction.objectStore(FS.DB_STORE_NAME);
            var ok = 0,
              fail = 0,
              total = paths.length;

            function finish() {
              if (fail == 0) onload();
              else onerror()
            }
            paths.forEach(function (path) {
              var putRequest = files.put(FS.analyzePath(path)
                .object.contents, path);
              putRequest.onsuccess = function putRequest_onsuccess() {
                ok++;
                if (ok + fail == total) finish()
              };
              putRequest.onerror = function putRequest_onerror() {
                fail++;
                if (ok + fail == total) finish()
              }
            });
            transaction.onerror = onerror
          };
          openRequest.onerror = onerror
        },
        loadFilesFromDB: function (paths, onload, onerror) {
          onload = onload || function () { };
          onerror = onerror || function () { };
          var indexedDB = FS.indexedDB();
          try {
            var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION)
          } catch (e) {
            return onerror(e)
          }
          openRequest.onupgradeneeded = onerror;
          openRequest.onsuccess = function openRequest_onsuccess() {
            var db = openRequest.result;
            try {
              var transaction = db.transaction([FS.DB_STORE_NAME], "readonly")
            } catch (e) {
              onerror(e);
              return
            }
            var files = transaction.objectStore(FS.DB_STORE_NAME);
            var ok = 0,
              fail = 0,
              total = paths.length;

            function finish() {
              if (fail == 0) onload();
              else onerror()
            }
            paths.forEach(function (path) {
              var getRequest = files.get(path);
              getRequest.onsuccess = function getRequest_onsuccess() {
                if (FS.analyzePath(path)
                  .exists) {
                  FS.unlink(path)
                }
                FS.createDataFile(PATH.dirname(path), PATH.basename(path), getRequest.result, true, true, true);
                ok++;
                if (ok + fail == total) finish()
              };
              getRequest.onerror = function getRequest_onerror() {
                fail++;
                if (ok + fail == total) finish()
              }
            });
            transaction.onerror = onerror
          };
          openRequest.onerror = onerror
        }
      };

      function _emscripten_set_main_loop_timing(mode, value) {
        Browser.mainLoop.timingMode = mode;
        Browser.mainLoop.timingValue = value;
        if (!Browser.mainLoop.func) {
          return 1
        }
        if (mode == 0) {
          Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setTimeout() {
            var timeUntilNextTick = Math.max(0, Browser.mainLoop.tickStartTime + value - _emscripten_get_now()) | 0;
            setTimeout(Browser.mainLoop.runner, timeUntilNextTick)
          };
          Browser.mainLoop.method = "timeout"
        } else if (mode == 1) {
          Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_rAF() {
            Browser.requestAnimationFrame(Browser.mainLoop.runner)
          };
          Browser.mainLoop.method = "rAF"
        } else if (mode == 2) {
          if (typeof setImmediate === "undefined") {
            var setImmediates = [];
            var emscriptenMainLoopMessageId = "setimmediate";
            var Browser_setImmediate_messageHandler = function (event) {
              if (event.data === emscriptenMainLoopMessageId || event.data.target === emscriptenMainLoopMessageId) {
                event.stopPropagation();
                setImmediates.shift()()
              }
            };
            addEventListener("message", Browser_setImmediate_messageHandler, true);
            setImmediate = function Browser_emulated_setImmediate(func) {
              setImmediates.push(func);
              if (ENVIRONMENT_IS_WORKER) {
                if (Module["setImmediates"] === undefined) Module["setImmediates"] = [];
                Module["setImmediates"].push(func);
                postMessage({
                  target: emscriptenMainLoopMessageId
                })
              } else postMessage(emscriptenMainLoopMessageId, "*")
            }
          }
          Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setImmediate() {
            setImmediate(Browser.mainLoop.runner)
          };
          Browser.mainLoop.method = "immediate"
        }
        return 0
      }

      function _emscripten_get_now() {
        abort()
      }

      function _emscripten_set_main_loop(func, fps, simulateInfiniteLoop, arg, noSetTiming) {
        Module["noExitRuntime"] = true;
        assert(!Browser.mainLoop.func, "emscripten_set_main_loop: there can only be one main loop function at once: call emscripten_cancel_main_loop to cancel the previous one before setting a new one with different parameters.");
        Browser.mainLoop.func = func;
        Browser.mainLoop.arg = arg;
        var browserIterationFunc;
        if (typeof arg !== "undefined") {
          browserIterationFunc = function () {
            Module["dynCall_vi"](func, arg)
          }
        } else {
          browserIterationFunc = function () {
            Module["dynCall_v"](func)
          }
        }
        var thisMainLoopId = Browser.mainLoop.currentlyRunningMainloop;
        Browser.mainLoop.runner = function Browser_mainLoop_runner() {
          if (ABORT) return;
          if (Browser.mainLoop.queue.length > 0) {
            var start = Date.now();
            var blocker = Browser.mainLoop.queue.shift();
            blocker.func(blocker.arg);
            if (Browser.mainLoop.remainingBlockers) {
              var remaining = Browser.mainLoop.remainingBlockers;
              var next = remaining % 1 == 0 ? remaining - 1 : Math.floor(remaining);
              if (blocker.counted) {
                Browser.mainLoop.remainingBlockers = next
              } else {
                next = next + .5;
                Browser.mainLoop.remainingBlockers = (8 * remaining + next) / 9
              }
            }
            console.log('main loop blocker "' + blocker.name + '" took ' + (Date.now() - start) + " ms");
            Browser.mainLoop.updateStatus();
            if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
            setTimeout(Browser.mainLoop.runner, 0);
            return
          }
          if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
          Browser.mainLoop.currentFrameNumber = Browser.mainLoop.currentFrameNumber + 1 | 0;
          if (Browser.mainLoop.timingMode == 1 && Browser.mainLoop.timingValue > 1 && Browser.mainLoop.currentFrameNumber % Browser.mainLoop.timingValue != 0) {
            Browser.mainLoop.scheduler();
            return
          } else if (Browser.mainLoop.timingMode == 0) {
            Browser.mainLoop.tickStartTime = _emscripten_get_now()
          }
          if (Browser.mainLoop.method === "timeout" && Module.ctx) {
            err("Looks like you are rendering without using requestAnimationFrame for the main loop. You should use 0 for the frame rate in emscripten_set_main_loop in order to use requestAnimationFrame, as that can greatly improve your frame rates!");
            Browser.mainLoop.method = ""
          }
          Browser.mainLoop.runIter(browserIterationFunc);
          if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
          if (typeof SDL === "object" && SDL.audio && SDL.audio.queueNewAudioData) SDL.audio.queueNewAudioData();
          Browser.mainLoop.scheduler()
        };
        if (!noSetTiming) {
          if (fps && fps > 0) _emscripten_set_main_loop_timing(0, 1e3 / fps);
          else _emscripten_set_main_loop_timing(1, 1);
          Browser.mainLoop.scheduler()
        }
        if (simulateInfiniteLoop) {
          throw "SimulateInfiniteLoop"
        }
      }
      var Browser = {
        mainLoop: {
          scheduler: null,
          method: "",
          currentlyRunningMainloop: 0,
          func: null,
          arg: 0,
          timingMode: 0,
          timingValue: 0,
          currentFrameNumber: 0,
          queue: [],
          pause: function () {
            Browser.mainLoop.scheduler = null;
            Browser.mainLoop.currentlyRunningMainloop++
          },
          resume: function () {
            Browser.mainLoop.currentlyRunningMainloop++;
            var timingMode = Browser.mainLoop.timingMode;
            var timingValue = Browser.mainLoop.timingValue;
            var func = Browser.mainLoop.func;
            Browser.mainLoop.func = null;
            _emscripten_set_main_loop(func, 0, false, Browser.mainLoop.arg, true);
            _emscripten_set_main_loop_timing(timingMode, timingValue);
            Browser.mainLoop.scheduler()
          },
          updateStatus: function () {
            if (Module["setStatus"]) {
              var message = Module["statusMessage"] || "Please wait...";
              var remaining = Browser.mainLoop.remainingBlockers;
              var expected = Browser.mainLoop.expectedBlockers;
              if (remaining) {
                if (remaining < expected) {
                  Module["setStatus"](message + " (" + (expected - remaining) + "/" + expected + ")")
                } else {
                  Module["setStatus"](message)
                }
              } else {
                Module["setStatus"]("")
              }
            }
          },
          runIter: function (func) {
            if (ABORT) return;
            if (Module["preMainLoop"]) {
              var preRet = Module["preMainLoop"]();
              if (preRet === false) {
                return
              }
            }
            try {
              func()
            } catch (e) {
              if (e instanceof ExitStatus) {
                return
              } else {
                if (e && typeof e === "object" && e.stack) err("exception thrown: " + [e, e.stack]);
                throw e
              }
            }
            if (Module["postMainLoop"]) Module["postMainLoop"]()
          }
        },
        isFullscreen: false,
        pointerLock: false,
        moduleContextCreatedCallbacks: [],
        workers: [],
        init: function () {
          if (!Module["preloadPlugins"]) Module["preloadPlugins"] = [];
          if (Browser.initted) return;
          Browser.initted = true;
          try {
            new Blob;
            Browser.hasBlobConstructor = true
          } catch (e) {
            Browser.hasBlobConstructor = false;
            console.log("warning: no blob constructor, cannot create blobs with mimetypes")
          }
          Browser.BlobBuilder = typeof MozBlobBuilder != "undefined" ? MozBlobBuilder : typeof WebKitBlobBuilder != "undefined" ? WebKitBlobBuilder : !Browser.hasBlobConstructor ? console.log("warning: no BlobBuilder") : null;
          Browser.URLObject = typeof window != "undefined" ? window.URL ? window.URL : window.webkitURL : undefined;
          if (!Module.noImageDecoding && typeof Browser.URLObject === "undefined") {
            console.log("warning: Browser does not support creating object URLs. Built-in browser image decoding will not be available.");
            Module.noImageDecoding = true
          }
          var imagePlugin = {};
          imagePlugin["canHandle"] = function imagePlugin_canHandle(name) {
            return !Module.noImageDecoding && /\.(jpg|jpeg|png|bmp)$/i.test(name)
          };
          imagePlugin["handle"] = function imagePlugin_handle(byteArray, name, onload, onerror) {
            var b = null;
            if (Browser.hasBlobConstructor) {
              try {
                b = new Blob([byteArray], {
                  type: Browser.getMimetype(name)
                });
                if (b.size !== byteArray.length) {
                  b = new Blob([new Uint8Array(byteArray)
                    .buffer
                  ], {
                      type: Browser.getMimetype(name)
                    })
                }
              } catch (e) {
                warnOnce("Blob constructor present but fails: " + e + "; falling back to blob builder")
              }
            }
            if (!b) {
              var bb = new Browser.BlobBuilder;
              bb.append(new Uint8Array(byteArray)
                .buffer);
              b = bb.getBlob()
            }
            var url = Browser.URLObject.createObjectURL(b);
            var img = new Image;
            img.onload = function img_onload() {
              assert(img.complete, "Image " + name + " could not be decoded");
              var canvas = document.createElement("canvas");
              canvas.width = img.width;
              canvas.height = img.height;
              var ctx = canvas.getContext("2d");
              ctx.drawImage(img, 0, 0);
              Module["preloadedImages"][name] = canvas;
              Browser.URLObject.revokeObjectURL(url);
              if (onload) onload(byteArray)
            };
            img.onerror = function img_onerror(event) {
              console.log("Image " + url + " could not be decoded");
              if (onerror) onerror()
            };
            img.src = url
          };
          Module["preloadPlugins"].push(imagePlugin);
          var audioPlugin = {};
          audioPlugin["canHandle"] = function audioPlugin_canHandle(name) {
            return !Module.noAudioDecoding && name.substr(-4) in {
              ".ogg": 1,
              ".wav": 1,
              ".mp3": 1
            }
          };
          audioPlugin["handle"] = function audioPlugin_handle(byteArray, name, onload, onerror) {
            var done = false;

            function finish(audio) {
              if (done) return;
              done = true;
              Module["preloadedAudios"][name] = audio;
              if (onload) onload(byteArray)
            }

            function fail() {
              if (done) return;
              done = true;
              Module["preloadedAudios"][name] = new Audio;
              if (onerror) onerror()
            }
            if (Browser.hasBlobConstructor) {
              try {
                var b = new Blob([byteArray], {
                  type: Browser.getMimetype(name)
                })
              } catch (e) {
                return fail()
              }
              var url = Browser.URLObject.createObjectURL(b);
              var audio = new Audio;
              audio.addEventListener("canplaythrough", function () {
                finish(audio)
              }, false);
              audio.onerror = function audio_onerror(event) {
                if (done) return;
                console.log("warning: browser could not fully decode audio " + name + ", trying slower base64 approach");

                function encode64(data) {
                  var BASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
                  var PAD = "=";
                  var ret = "";
                  var leftchar = 0;
                  var leftbits = 0;
                  for (var i = 0; i < data.length; i++) {
                    leftchar = leftchar << 8 | data[i];
                    leftbits += 8;
                    while (leftbits >= 6) {
                      var curr = leftchar >> leftbits - 6 & 63;
                      leftbits -= 6;
                      ret += BASE[curr]
                    }
                  }
                  if (leftbits == 2) {
                    ret += BASE[(leftchar & 3) << 4];
                    ret += PAD + PAD
                  } else if (leftbits == 4) {
                    ret += BASE[(leftchar & 15) << 2];
                    ret += PAD
                  }
                  return ret
                }
                audio.src = "data:audio/x-" + name.substr(-3) + ";base64," + encode64(byteArray);
                finish(audio)
              };
              audio.src = url;
              Browser.safeSetTimeout(function () {
                finish(audio)
              }, 1e4)
            } else {
              return fail()
            }
          };
          Module["preloadPlugins"].push(audioPlugin);

          function pointerLockChange() {
            Browser.pointerLock = document["pointerLockElement"] === Module["canvas"] || document["mozPointerLockElement"] === Module["canvas"] || document["webkitPointerLockElement"] === Module["canvas"] || document["msPointerLockElement"] === Module["canvas"]
          }
          var canvas = Module["canvas"];
          if (canvas) {
            canvas.requestPointerLock = canvas["requestPointerLock"] || canvas["mozRequestPointerLock"] || canvas["webkitRequestPointerLock"] || canvas["msRequestPointerLock"] || function () { };
            canvas.exitPointerLock = document["exitPointerLock"] || document["mozExitPointerLock"] || document["webkitExitPointerLock"] || document["msExitPointerLock"] || function () { };
            canvas.exitPointerLock = canvas.exitPointerLock.bind(document);
            document.addEventListener("pointerlockchange", pointerLockChange, false);
            document.addEventListener("mozpointerlockchange", pointerLockChange, false);
            document.addEventListener("webkitpointerlockchange", pointerLockChange, false);
            document.addEventListener("mspointerlockchange", pointerLockChange, false);
            if (Module["elementPointerLock"]) {
              canvas.addEventListener("click", function (ev) {
                if (!Browser.pointerLock && Module["canvas"].requestPointerLock) {
                  Module["canvas"].requestPointerLock();
                  ev.preventDefault()
                }
              }, false)
            }
          }
        },
        createContext: function (canvas, useWebGL, setInModule, webGLContextAttributes) {
          if (useWebGL && Module.ctx && canvas == Module.canvas) return Module.ctx;
          var ctx;
          var contextHandle;
          if (useWebGL) {
            var contextAttributes = {
              antialias: false,
              alpha: false,
              majorVersion: 1
            };
            if (webGLContextAttributes) {
              for (var attribute in webGLContextAttributes) {
                contextAttributes[attribute] = webGLContextAttributes[attribute]
              }
            }
            if (typeof GL !== "undefined") {
              contextHandle = GL.createContext(canvas, contextAttributes);
              if (contextHandle) {
                ctx = GL.getContext(contextHandle)
                  .GLctx
              }
            }
          } else {
            ctx = canvas.getContext("2d")
          }
          if (!ctx) return null;
          if (setInModule) {
            if (!useWebGL) assert(typeof GLctx === "undefined", "cannot set in module if GLctx is used, but we are a non-GL context that would replace it");
            Module.ctx = ctx;
            if (useWebGL) GL.makeContextCurrent(contextHandle);
            Module.useWebGL = useWebGL;
            Browser.moduleContextCreatedCallbacks.forEach(function (callback) {
              callback()
            });
            Browser.init()
          }
          return ctx
        },
        destroyContext: function (canvas, useWebGL, setInModule) { },
        fullscreenHandlersInstalled: false,
        lockPointer: undefined,
        resizeCanvas: undefined,
        requestFullscreen: function (lockPointer, resizeCanvas, vrDevice) {
          Browser.lockPointer = lockPointer;
          Browser.resizeCanvas = resizeCanvas;
          Browser.vrDevice = vrDevice;
          if (typeof Browser.lockPointer === "undefined") Browser.lockPointer = true;
          if (typeof Browser.resizeCanvas === "undefined") Browser.resizeCanvas = false;
          if (typeof Browser.vrDevice === "undefined") Browser.vrDevice = null;
          var canvas = Module["canvas"];

          function fullscreenChange() {
            Browser.isFullscreen = false;
            var canvasContainer = canvas.parentNode;
            if ((document["fullscreenElement"] || document["mozFullScreenElement"] || document["msFullscreenElement"] || document["webkitFullscreenElement"] || document["webkitCurrentFullScreenElement"]) === canvasContainer) {
              canvas.exitFullscreen = Browser.exitFullscreen;
              if (Browser.lockPointer) canvas.requestPointerLock();
              Browser.isFullscreen = true;
              if (Browser.resizeCanvas) {
                Browser.setFullscreenCanvasSize()
              } else {
                Browser.updateCanvasDimensions(canvas)
              }
            } else {
              canvasContainer.parentNode.insertBefore(canvas, canvasContainer);
              canvasContainer.parentNode.removeChild(canvasContainer);
              if (Browser.resizeCanvas) {
                Browser.setWindowedCanvasSize()
              } else {
                Browser.updateCanvasDimensions(canvas)
              }
            }
            if (Module["onFullScreen"]) Module["onFullScreen"](Browser.isFullscreen);
            if (Module["onFullscreen"]) Module["onFullscreen"](Browser.isFullscreen)
          }
          if (!Browser.fullscreenHandlersInstalled) {
            Browser.fullscreenHandlersInstalled = true;
            document.addEventListener("fullscreenchange", fullscreenChange, false);
            document.addEventListener("mozfullscreenchange", fullscreenChange, false);
            document.addEventListener("webkitfullscreenchange", fullscreenChange, false);
            document.addEventListener("MSFullscreenChange", fullscreenChange, false)
          }
          var canvasContainer = document.createElement("div");
          canvas.parentNode.insertBefore(canvasContainer, canvas);
          canvasContainer.appendChild(canvas);
          canvasContainer.requestFullscreen = canvasContainer["requestFullscreen"] || canvasContainer["mozRequestFullScreen"] || canvasContainer["msRequestFullscreen"] || (canvasContainer["webkitRequestFullscreen"] ? function () {
            canvasContainer["webkitRequestFullscreen"](Element["ALLOW_KEYBOARD_INPUT"])
          } : null) || (canvasContainer["webkitRequestFullScreen"] ? function () {
            canvasContainer["webkitRequestFullScreen"](Element["ALLOW_KEYBOARD_INPUT"])
          } : null);
          if (vrDevice) {
            canvasContainer.requestFullscreen({
              vrDisplay: vrDevice
            })
          } else {
            canvasContainer.requestFullscreen()
          }
        },
        requestFullScreen: function (lockPointer, resizeCanvas, vrDevice) {
          err("Browser.requestFullScreen() is deprecated. Please call Browser.requestFullscreen instead.");
          Browser.requestFullScreen = function (lockPointer, resizeCanvas, vrDevice) {
            return Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice)
          };
          return Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice)
        },
        exitFullscreen: function () {
          if (!Browser.isFullscreen) {
            return false
          }
          var CFS = document["exitFullscreen"] || document["cancelFullScreen"] || document["mozCancelFullScreen"] || document["msExitFullscreen"] || document["webkitCancelFullScreen"] || function () { };
          CFS.apply(document, []);
          return true
        },
        nextRAF: 0,
        fakeRequestAnimationFrame: function (func) {
          var now = Date.now();
          if (Browser.nextRAF === 0) {
            Browser.nextRAF = now + 1e3 / 60
          } else {
            while (now + 2 >= Browser.nextRAF) {
              Browser.nextRAF += 1e3 / 60
            }
          }
          var delay = Math.max(Browser.nextRAF - now, 0);
          setTimeout(func, delay)
        },
        requestAnimationFrame: function requestAnimationFrame(func) {
          if (typeof window === "undefined") {
            Browser.fakeRequestAnimationFrame(func)
          } else {
            if (!window.requestAnimationFrame) {
              window.requestAnimationFrame = window["requestAnimationFrame"] || window["mozRequestAnimationFrame"] || window["webkitRequestAnimationFrame"] || window["msRequestAnimationFrame"] || window["oRequestAnimationFrame"] || Browser.fakeRequestAnimationFrame
            }
            window.requestAnimationFrame(func)
          }
        },
        safeCallback: function (func) {
          return function () {
            if (!ABORT) return func.apply(null, arguments)
          }
        },
        allowAsyncCallbacks: true,
        queuedAsyncCallbacks: [],
        pauseAsyncCallbacks: function () {
          Browser.allowAsyncCallbacks = false
        },
        resumeAsyncCallbacks: function () {
          Browser.allowAsyncCallbacks = true;
          if (Browser.queuedAsyncCallbacks.length > 0) {
            var callbacks = Browser.queuedAsyncCallbacks;
            Browser.queuedAsyncCallbacks = [];
            callbacks.forEach(function (func) {
              func()
            })
          }
        },
        safeRequestAnimationFrame: function (func) {
          return Browser.requestAnimationFrame(function () {
            if (ABORT) return;
            if (Browser.allowAsyncCallbacks) {
              func()
            } else {
              Browser.queuedAsyncCallbacks.push(func)
            }
          })
        },
        safeSetTimeout: function (func, timeout) {
          Module["noExitRuntime"] = true;
          return setTimeout(function () {
            if (ABORT) return;
            if (Browser.allowAsyncCallbacks) {
              func()
            } else {
              Browser.queuedAsyncCallbacks.push(func)
            }
          }, timeout)
        },
        safeSetInterval: function (func, timeout) {
          Module["noExitRuntime"] = true;
          return setInterval(function () {
            if (ABORT) return;
            if (Browser.allowAsyncCallbacks) {
              func()
            }
          }, timeout)
        },
        getMimetype: function (name) {
          return {
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "png": "image/png",
            "bmp": "image/bmp",
            "ogg": "audio/ogg",
            "wav": "audio/wav",
            "mp3": "audio/mpeg"
          }[name.substr(name.lastIndexOf(".") + 1)]
        },
        getUserMedia: function (func) {
          if (!window.getUserMedia) {
            window.getUserMedia = navigator["getUserMedia"] || navigator["mozGetUserMedia"]
          }
          window.getUserMedia(func)
        },
        getMovementX: function (event) {
          return event["movementX"] || event["mozMovementX"] || event["webkitMovementX"] || 0
        },
        getMovementY: function (event) {
          return event["movementY"] || event["mozMovementY"] || event["webkitMovementY"] || 0
        },
        getMouseWheelDelta: function (event) {
          var delta = 0;
          switch (event.type) {
            case "DOMMouseScroll":
              delta = event.detail / 3;
              break;
            case "mousewheel":
              delta = event.wheelDelta / 120;
              break;
            case "wheel":
              delta = event.deltaY;
              switch (event.deltaMode) {
                case 0:
                  delta /= 100;
                  break;
                case 1:
                  delta /= 3;
                  break;
                case 2:
                  delta *= 80;
                  break;
                default:
                  throw "unrecognized mouse wheel delta mode: " + event.deltaMode
              }
              break;
            default:
              throw "unrecognized mouse wheel event: " + event.type
          }
          return delta
        },
        mouseX: 0,
        mouseY: 0,
        mouseMovementX: 0,
        mouseMovementY: 0,
        touches: {},
        lastTouches: {},
        calculateMouseEvent: function (event) {
          if (Browser.pointerLock) {
            if (event.type != "mousemove" && "mozMovementX" in event) {
              Browser.mouseMovementX = Browser.mouseMovementY = 0
            } else {
              Browser.mouseMovementX = Browser.getMovementX(event);
              Browser.mouseMovementY = Browser.getMovementY(event)
            }
            if (typeof SDL != "undefined") {
              Browser.mouseX = SDL.mouseX + Browser.mouseMovementX;
              Browser.mouseY = SDL.mouseY + Browser.mouseMovementY
            } else {
              Browser.mouseX += Browser.mouseMovementX;
              Browser.mouseY += Browser.mouseMovementY
            }
          } else {
            var rect = Module["canvas"].getBoundingClientRect();
            var cw = Module["canvas"].width;
            var ch = Module["canvas"].height;
            var scrollX = typeof window.scrollX !== "undefined" ? window.scrollX : window.pageXOffset;
            var scrollY = typeof window.scrollY !== "undefined" ? window.scrollY : window.pageYOffset;
            if (event.type === "touchstart" || event.type === "touchend" || event.type === "touchmove") {
              var touch = event.touch;
              if (touch === undefined) {
                return
              }
              var adjustedX = touch.pageX - (scrollX + rect.left);
              var adjustedY = touch.pageY - (scrollY + rect.top);
              adjustedX = adjustedX * (cw / rect.width);
              adjustedY = adjustedY * (ch / rect.height);
              var coords = {
                x: adjustedX,
                y: adjustedY
              };
              if (event.type === "touchstart") {
                Browser.lastTouches[touch.identifier] = coords;
                Browser.touches[touch.identifier] = coords
              } else if (event.type === "touchend" || event.type === "touchmove") {
                var last = Browser.touches[touch.identifier];
                if (!last) last = coords;
                Browser.lastTouches[touch.identifier] = last;
                Browser.touches[touch.identifier] = coords
              }
              return
            }
            var x = event.pageX - (scrollX + rect.left);
            var y = event.pageY - (scrollY + rect.top);
            x = x * (cw / rect.width);
            y = y * (ch / rect.height);
            Browser.mouseMovementX = x - Browser.mouseX;
            Browser.mouseMovementY = y - Browser.mouseY;
            Browser.mouseX = x;
            Browser.mouseY = y
          }
        },
        asyncLoad: function (url, onload, onerror, noRunDep) {
          var dep = !noRunDep ? getUniqueRunDependency("al " + url) : "";
          Module["readAsync"](url, function (arrayBuffer) {
            assert(arrayBuffer, 'Loading data file "' + url + '" failed (no arrayBuffer).');
            onload(new Uint8Array(arrayBuffer));
            if (dep) removeRunDependency(dep)
          }, function (event) {
            if (onerror) {
              onerror()
            } else {
              throw 'Loading data file "' + url + '" failed.'
            }
          });
          if (dep) addRunDependency(dep)
        },
        resizeListeners: [],
        updateResizeListeners: function () {
          var canvas = Module["canvas"];
          Browser.resizeListeners.forEach(function (listener) {
            listener(canvas.width, canvas.height)
          })
        },
        setCanvasSize: function (width, height, noUpdates) {
          var canvas = Module["canvas"];
          Browser.updateCanvasDimensions(canvas, width, height);
          if (!noUpdates) Browser.updateResizeListeners()
        },
        windowedWidth: 0,
        windowedHeight: 0,
        setFullscreenCanvasSize: function () {
          if (typeof SDL != "undefined") {
            var flags = HEAPU32[SDL.screen >> 2];
            flags = flags | 8388608;
            HEAP32[SDL.screen >> 2] = flags
          }
          Browser.updateCanvasDimensions(Module["canvas"]);
          Browser.updateResizeListeners()
        },
        setWindowedCanvasSize: function () {
          if (typeof SDL != "undefined") {
            var flags = HEAPU32[SDL.screen >> 2];
            flags = flags & ~8388608;
            HEAP32[SDL.screen >> 2] = flags
          }
          Browser.updateCanvasDimensions(Module["canvas"]);
          Browser.updateResizeListeners()
        },
        updateCanvasDimensions: function (canvas, wNative, hNative) {
          if (wNative && hNative) {
            canvas.widthNative = wNative;
            canvas.heightNative = hNative
          } else {
            wNative = canvas.widthNative;
            hNative = canvas.heightNative
          }
          var w = wNative;
          var h = hNative;
          if (Module["forcedAspectRatio"] && Module["forcedAspectRatio"] > 0) {
            if (w / h < Module["forcedAspectRatio"]) {
              w = Math.round(h * Module["forcedAspectRatio"])
            } else {
              h = Math.round(w / Module["forcedAspectRatio"])
            }
          }
          if ((document["fullscreenElement"] || document["mozFullScreenElement"] || document["msFullscreenElement"] || document["webkitFullscreenElement"] || document["webkitCurrentFullScreenElement"]) === canvas.parentNode && typeof screen != "undefined") {
            var factor = Math.min(screen.width / w, screen.height / h);
            w = Math.round(w * factor);
            h = Math.round(h * factor)
          }
          if (Browser.resizeCanvas) {
            if (canvas.width != w) canvas.width = w;
            if (canvas.height != h) canvas.height = h;
            if (typeof canvas.style != "undefined") {
              canvas.style.removeProperty("width");
              canvas.style.removeProperty("height")
            }
          } else {
            if (canvas.width != wNative) canvas.width = wNative;
            if (canvas.height != hNative) canvas.height = hNative;
            if (typeof canvas.style != "undefined") {
              if (w != wNative || h != hNative) {
                canvas.style.setProperty("width", w + "px", "important");
                canvas.style.setProperty("height", h + "px", "important")
              } else {
                canvas.style.removeProperty("width");
                canvas.style.removeProperty("height")
              }
            }
          }
        },
        wgetRequests: {},
        nextWgetRequestHandle: 0,
        getNextWgetRequestHandle: function () {
          var handle = Browser.nextWgetRequestHandle;
          Browser.nextWgetRequestHandle++;
          return handle
        }
      };

      function _SDL_GetTicks() {
        return Date.now() - SDL.startTime | 0
      }

      function _SDL_LockSurface(surf) {
        var surfData = SDL.surfaces[surf];
        surfData.locked++;
        if (surfData.locked > 1) return 0;
        if (!surfData.buffer) {
          surfData.buffer = _malloc(surfData.width * surfData.height * 4);
          HEAP32[surf + 20 >> 2] = surfData.buffer
        }
        HEAP32[surf + 20 >> 2] = surfData.buffer;
        if (surf == SDL.screen && Module.screenIsReadOnly && surfData.image) return 0;
        if (SDL.defaults.discardOnLock) {
          if (!surfData.image) {
            surfData.image = surfData.ctx.createImageData(surfData.width, surfData.height)
          }
          if (!SDL.defaults.opaqueFrontBuffer) return
        } else {
          surfData.image = surfData.ctx.getImageData(0, 0, surfData.width, surfData.height)
        }
        if (surf == SDL.screen && SDL.defaults.opaqueFrontBuffer) {
          var data = surfData.image.data;
          var num = data.length;
          for (var i = 0; i < num / 4; i++) {
            data[i * 4 + 3] = 255
          }
        }
        if (SDL.defaults.copyOnLock && !SDL.defaults.discardOnLock) {
          if (surfData.isFlagSet(2097152)) {
            throw "CopyOnLock is not supported for SDL_LockSurface with SDL_HWPALETTE flag set" + (new Error)
              .stack
          } else {
            HEAPU8.set(surfData.image.data, surfData.buffer)
          }
        }
        return 0
      }
      var SDL = {
        defaults: {
          width: 320,
          height: 200,
          copyOnLock: true,
          discardOnLock: false,
          opaqueFrontBuffer: true
        },
        version: null,
        surfaces: {},
        canvasPool: [],
        events: [],
        fonts: [null],
        audios: [null],
        rwops: [null],
        music: {
          audio: null,
          volume: 1
        },
        mixerFrequency: 22050,
        mixerFormat: 32784,
        mixerNumChannels: 2,
        mixerChunkSize: 1024,
        channelMinimumNumber: 0,
        GL: false,
        glAttributes: {
          0: 3,
          1: 3,
          2: 2,
          3: 0,
          4: 0,
          5: 1,
          6: 16,
          7: 0,
          8: 0,
          9: 0,
          10: 0,
          11: 0,
          12: 0,
          13: 0,
          14: 0,
          15: 1,
          16: 0,
          17: 0,
          18: 0
        },
        keyboardState: null,
        keyboardMap: {},
        canRequestFullscreen: false,
        isRequestingFullscreen: false,
        textInput: false,
        startTime: null,
        initFlags: 0,
        buttonState: 0,
        modState: 0,
        DOMButtons: [0, 0, 0],
        DOMEventToSDLEvent: {},
        TOUCH_DEFAULT_ID: 0,
        eventHandler: null,
        eventHandlerContext: null,
        eventHandlerTemp: 0,
        keyCodes: {
          16: 1249,
          17: 1248,
          18: 1250,
          20: 1081,
          33: 1099,
          34: 1102,
          35: 1101,
          36: 1098,
          37: 1104,
          38: 1106,
          39: 1103,
          40: 1105,
          44: 316,
          45: 1097,
          46: 127,
          91: 1251,
          93: 1125,
          96: 1122,
          97: 1113,
          98: 1114,
          99: 1115,
          100: 1116,
          101: 1117,
          102: 1118,
          103: 1119,
          104: 1120,
          105: 1121,
          106: 1109,
          107: 1111,
          109: 1110,
          110: 1123,
          111: 1108,
          112: 1082,
          113: 1083,
          114: 1084,
          115: 1085,
          116: 1086,
          117: 1087,
          118: 1088,
          119: 1089,
          120: 1090,
          121: 1091,
          122: 1092,
          123: 1093,
          124: 1128,
          125: 1129,
          126: 1130,
          127: 1131,
          128: 1132,
          129: 1133,
          130: 1134,
          131: 1135,
          132: 1136,
          133: 1137,
          134: 1138,
          135: 1139,
          144: 1107,
          160: 94,
          161: 33,
          162: 34,
          163: 35,
          164: 36,
          165: 37,
          166: 38,
          167: 95,
          168: 40,
          169: 41,
          170: 42,
          171: 43,
          172: 124,
          173: 45,
          174: 123,
          175: 125,
          176: 126,
          181: 127,
          182: 129,
          183: 128,
          188: 44,
          190: 46,
          191: 47,
          192: 96,
          219: 91,
          220: 92,
          221: 93,
          222: 39,
          224: 1251
        },
        scanCodes: {
          8: 42,
          9: 43,
          13: 40,
          27: 41,
          32: 44,
          35: 204,
          39: 53,
          44: 54,
          46: 55,
          47: 56,
          48: 39,
          49: 30,
          50: 31,
          51: 32,
          52: 33,
          53: 34,
          54: 35,
          55: 36,
          56: 37,
          57: 38,
          58: 203,
          59: 51,
          61: 46,
          91: 47,
          92: 49,
          93: 48,
          96: 52,
          97: 4,
          98: 5,
          99: 6,
          100: 7,
          101: 8,
          102: 9,
          103: 10,
          104: 11,
          105: 12,
          106: 13,
          107: 14,
          108: 15,
          109: 16,
          110: 17,
          111: 18,
          112: 19,
          113: 20,
          114: 21,
          115: 22,
          116: 23,
          117: 24,
          118: 25,
          119: 26,
          120: 27,
          121: 28,
          122: 29,
          127: 76,
          305: 224,
          308: 226,
          316: 70
        },
        loadRect: function (rect) {
          return {
            x: HEAP32[rect + 0 >> 2],
            y: HEAP32[rect + 4 >> 2],
            w: HEAP32[rect + 8 >> 2],
            h: HEAP32[rect + 12 >> 2]
          }
        },
        updateRect: function (rect, r) {
          HEAP32[rect >> 2] = r.x;
          HEAP32[rect + 4 >> 2] = r.y;
          HEAP32[rect + 8 >> 2] = r.w;
          HEAP32[rect + 12 >> 2] = r.h
        },
        intersectionOfRects: function (first, second) {
          var leftX = Math.max(first.x, second.x);
          var leftY = Math.max(first.y, second.y);
          var rightX = Math.min(first.x + first.w, second.x + second.w);
          var rightY = Math.min(first.y + first.h, second.y + second.h);
          return {
            x: leftX,
            y: leftY,
            w: Math.max(leftX, rightX) - leftX,
            h: Math.max(leftY, rightY) - leftY
          }
        },
        checkPixelFormat: function (fmt) { },
        loadColorToCSSRGB: function (color) {
          var rgba = HEAP32[color >> 2];
          return "rgb(" + (rgba & 255) + "," + (rgba >> 8 & 255) + "," + (rgba >> 16 & 255) + ")"
        },
        loadColorToCSSRGBA: function (color) {
          var rgba = HEAP32[color >> 2];
          return "rgba(" + (rgba & 255) + "," + (rgba >> 8 & 255) + "," + (rgba >> 16 & 255) + "," + (rgba >> 24 & 255) / 255 + ")"
        },
        translateColorToCSSRGBA: function (rgba) {
          return "rgba(" + (rgba & 255) + "," + (rgba >> 8 & 255) + "," + (rgba >> 16 & 255) + "," + (rgba >>> 24) / 255 + ")"
        },
        translateRGBAToCSSRGBA: function (r, g, b, a) {
          return "rgba(" + (r & 255) + "," + (g & 255) + "," + (b & 255) + "," + (a & 255) / 255 + ")"
        },
        translateRGBAToColor: function (r, g, b, a) {
          return r | g << 8 | b << 16 | a << 24
        },
        makeSurface: function (width, height, flags, usePageCanvas, source, rmask, gmask, bmask, amask) {
          flags = flags || 0;
          var is_SDL_HWSURFACE = flags & 1;
          var is_SDL_HWPALETTE = flags & 2097152;
          var is_SDL_OPENGL = flags & 67108864;
          var surf = _malloc(60);
          var pixelFormat = _malloc(44);
          var bpp = is_SDL_HWPALETTE ? 1 : 4;
          var buffer = 0;
          if (!is_SDL_HWSURFACE && !is_SDL_OPENGL) {
            buffer = _malloc(width * height * 4)
          }
          HEAP32[surf >> 2] = flags;
          HEAP32[surf + 4 >> 2] = pixelFormat;
          HEAP32[surf + 8 >> 2] = width;
          HEAP32[surf + 12 >> 2] = height;
          HEAP32[surf + 16 >> 2] = width * bpp;
          HEAP32[surf + 20 >> 2] = buffer;
          HEAP32[surf + 36 >> 2] = 0;
          HEAP32[surf + 40 >> 2] = 0;
          HEAP32[surf + 44 >> 2] = Module["canvas"].width;
          HEAP32[surf + 48 >> 2] = Module["canvas"].height;
          HEAP32[surf + 56 >> 2] = 1;
          HEAP32[pixelFormat >> 2] = -2042224636;
          HEAP32[pixelFormat + 4 >> 2] = 0;
          HEAP8[pixelFormat + 8 >> 0] = bpp * 8;
          HEAP8[pixelFormat + 9 >> 0] = bpp;
          HEAP32[pixelFormat + 12 >> 2] = rmask || 255;
          HEAP32[pixelFormat + 16 >> 2] = gmask || 65280;
          HEAP32[pixelFormat + 20 >> 2] = bmask || 16711680;
          HEAP32[pixelFormat + 24 >> 2] = amask || 4278190080;
          SDL.GL = SDL.GL || is_SDL_OPENGL;
          var canvas;
          if (!usePageCanvas) {
            if (SDL.canvasPool.length > 0) {
              canvas = SDL.canvasPool.pop()
            } else {
              canvas = document.createElement("canvas")
            }
            canvas.width = width;
            canvas.height = height
          } else {
            canvas = Module["canvas"]
          }
          var webGLContextAttributes = {
            antialias: SDL.glAttributes[13] != 0 && SDL.glAttributes[14] > 1,
            depth: SDL.glAttributes[6] > 0,
            stencil: SDL.glAttributes[7] > 0,
            alpha: SDL.glAttributes[3] > 0
          };
          var ctx = Browser.createContext(canvas, is_SDL_OPENGL, usePageCanvas, webGLContextAttributes);
          SDL.surfaces[surf] = {
            width: width,
            height: height,
            canvas: canvas,
            ctx: ctx,
            surf: surf,
            buffer: buffer,
            pixelFormat: pixelFormat,
            alpha: 255,
            flags: flags,
            locked: 0,
            usePageCanvas: usePageCanvas,
            source: source,
            isFlagSet: function (flag) {
              return flags & flag
            }
          };
          return surf
        },
        copyIndexedColorData: function (surfData, rX, rY, rW, rH) {
          if (!surfData.colors) {
            return
          }
          var fullWidth = Module["canvas"].width;
          var fullHeight = Module["canvas"].height;
          var startX = rX || 0;
          var startY = rY || 0;
          var endX = (rW || fullWidth - startX) + startX;
          var endY = (rH || fullHeight - startY) + startY;
          var buffer = surfData.buffer;
          if (!surfData.image.data32) {
            surfData.image.data32 = new Uint32Array(surfData.image.data.buffer)
          }
          var data32 = surfData.image.data32;
          var colors32 = surfData.colors32;
          for (var y = startY; y < endY; ++y) {
            var base = y * fullWidth;
            for (var x = startX; x < endX; ++x) {
              data32[base + x] = colors32[HEAPU8[buffer + base + x >> 0]]
            }
          }
        },
        freeSurface: function (surf) {
          var refcountPointer = surf + 56;
          var refcount = HEAP32[refcountPointer >> 2];
          if (refcount > 1) {
            HEAP32[refcountPointer >> 2] = refcount - 1;
            return
          }
          var info = SDL.surfaces[surf];
          if (!info.usePageCanvas && info.canvas) SDL.canvasPool.push(info.canvas);
          if (info.buffer) _free(info.buffer);
          _free(info.pixelFormat);
          _free(surf);
          SDL.surfaces[surf] = null;
          if (surf === SDL.screen) {
            SDL.screen = null
          }
        },
        blitSurface: function (src, srcrect, dst, dstrect, scale) {
          var srcData = SDL.surfaces[src];
          var dstData = SDL.surfaces[dst];
          var sr, dr;
          if (srcrect) {
            sr = SDL.loadRect(srcrect)
          } else {
            sr = {
              x: 0,
              y: 0,
              w: srcData.width,
              h: srcData.height
            }
          }
          if (dstrect) {
            dr = SDL.loadRect(dstrect)
          } else {
            dr = {
              x: 0,
              y: 0,
              w: srcData.width,
              h: srcData.height
            }
          }
          if (dstData.clipRect) {
            var widthScale = !scale || sr.w === 0 ? 1 : sr.w / dr.w;
            var heightScale = !scale || sr.h === 0 ? 1 : sr.h / dr.h;
            dr = SDL.intersectionOfRects(dstData.clipRect, dr);
            sr.w = dr.w * widthScale;
            sr.h = dr.h * heightScale;
            if (dstrect) {
              SDL.updateRect(dstrect, dr)
            }
          }
          var blitw, blith;
          if (scale) {
            blitw = dr.w;
            blith = dr.h
          } else {
            blitw = sr.w;
            blith = sr.h
          }
          if (sr.w === 0 || sr.h === 0 || blitw === 0 || blith === 0) {
            return 0
          }
          var oldAlpha = dstData.ctx.globalAlpha;
          dstData.ctx.globalAlpha = srcData.alpha / 255;
          dstData.ctx.drawImage(srcData.canvas, sr.x, sr.y, sr.w, sr.h, dr.x, dr.y, blitw, blith);
          dstData.ctx.globalAlpha = oldAlpha;
          if (dst != SDL.screen) {
            warnOnce("WARNING: copying canvas data to memory for compatibility");
            _SDL_LockSurface(dst);
            dstData.locked--
          }
          return 0
        },
        downFingers: {},
        savedKeydown: null,
        receiveEvent: function (event) {
          function unpressAllPressedKeys() {
            for (var code in SDL.keyboardMap) {
              SDL.events.push({
                type: "keyup",
                keyCode: SDL.keyboardMap[code]
              })
            }
          }
          switch (event.type) {
            case "touchstart":
            case "touchmove":
              {
                event.preventDefault();
                var touches = [];
                if (event.type === "touchstart") {
                  for (var i = 0; i < event.touches.length; i++) {
                    var touch = event.touches[i];
                    if (SDL.downFingers[touch.identifier] != true) {
                      SDL.downFingers[touch.identifier] = true;
                      touches.push(touch)
                    }
                  }
                } else {
                  touches = event.touches
                }
                var firstTouch = touches[0];
                if (firstTouch) {
                  if (event.type == "touchstart") {
                    SDL.DOMButtons[0] = 1
                  }
                  var mouseEventType;
                  switch (event.type) {
                    case "touchstart":
                      mouseEventType = "mousedown";
                      break;
                    case "touchmove":
                      mouseEventType = "mousemove";
                      break
                  }
                  var mouseEvent = {
                    type: mouseEventType,
                    button: 0,
                    pageX: firstTouch.clientX,
                    pageY: firstTouch.clientY
                  };
                  SDL.events.push(mouseEvent)
                }
                for (var i = 0; i < touches.length; i++) {
                  var touch = touches[i];
                  SDL.events.push({
                    type: event.type,
                    touch: touch
                  })
                }
                break
              }
            case "touchend":
              {
                event.preventDefault();
                for (var i = 0; i < event.changedTouches.length; i++) {
                  var touch = event.changedTouches[i];
                  if (SDL.downFingers[touch.identifier] === true) {
                    delete SDL.downFingers[touch.identifier]
                  }
                }
                var mouseEvent = {
                  type: "mouseup",
                  button: 0,
                  pageX: event.changedTouches[0].clientX,
                  pageY: event.changedTouches[0].clientY
                }; SDL.DOMButtons[0] = 0; SDL.events.push(mouseEvent);
                for (var i = 0; i < event.changedTouches.length; i++) {
                  var touch = event.changedTouches[i];
                  SDL.events.push({
                    type: "touchend",
                    touch: touch
                  })
                }
                break
              }
            case "DOMMouseScroll":
            case "mousewheel":
            case "wheel":
              var delta = -Browser.getMouseWheelDelta(event);
              delta = delta == 0 ? 0 : delta > 0 ? Math.max(delta, 1) : Math.min(delta, -1);
              var button = delta > 0 ? 3 : 4;
              SDL.events.push({
                type: "mousedown",
                button: button,
                pageX: event.pageX,
                pageY: event.pageY
              });
              SDL.events.push({
                type: "mouseup",
                button: button,
                pageX: event.pageX,
                pageY: event.pageY
              });
              SDL.events.push({
                type: "wheel",
                deltaX: 0,
                deltaY: delta
              });
              event.preventDefault();
              break;
            case "mousemove":
              if (SDL.DOMButtons[0] === 1) {
                SDL.events.push({
                  type: "touchmove",
                  touch: {
                    identifier: 0,
                    deviceID: -1,
                    pageX: event.pageX,
                    pageY: event.pageY
                  }
                })
              }
              if (Browser.pointerLock) {
                if ("mozMovementX" in event) {
                  event["movementX"] = event["mozMovementX"];
                  event["movementY"] = event["mozMovementY"]
                }
                if (event["movementX"] == 0 && event["movementY"] == 0) {
                  event.preventDefault();
                  return
                }
              }
            case "keydown":
            case "keyup":
            case "keypress":
            case "mousedown":
            case "mouseup":
              if (event.type !== "keydown" || !SDL.unicode && !SDL.textInput || (event.keyCode === 8 || event.keyCode === 9)) {
                event.preventDefault()
              }
              if (event.type == "mousedown") {
                SDL.DOMButtons[event.button] = 1;
                SDL.events.push({
                  type: "touchstart",
                  touch: {
                    identifier: 0,
                    deviceID: -1,
                    pageX: event.pageX,
                    pageY: event.pageY
                  }
                })
              } else if (event.type == "mouseup") {
                if (!SDL.DOMButtons[event.button]) {
                  return
                }
                SDL.events.push({
                  type: "touchend",
                  touch: {
                    identifier: 0,
                    deviceID: -1,
                    pageX: event.pageX,
                    pageY: event.pageY
                  }
                });
                SDL.DOMButtons[event.button] = 0
              }
              if (event.type === "keydown" || event.type === "mousedown") {
                SDL.canRequestFullscreen = true
              } else if (event.type === "keyup" || event.type === "mouseup") {
                if (SDL.isRequestingFullscreen) {
                  Module["requestFullscreen"](true, true);
                  SDL.isRequestingFullscreen = false
                }
                SDL.canRequestFullscreen = false
              }
              if (event.type === "keypress" && SDL.savedKeydown) {
                SDL.savedKeydown.keypressCharCode = event.charCode;
                SDL.savedKeydown = null
              } else if (event.type === "keydown") {
                SDL.savedKeydown = event
              }
              if (event.type !== "keypress" || SDL.textInput) {
                SDL.events.push(event)
              }
              break;
            case "mouseout":
              for (var i = 0; i < 3; i++) {
                if (SDL.DOMButtons[i]) {
                  SDL.events.push({
                    type: "mouseup",
                    button: i,
                    pageX: event.pageX,
                    pageY: event.pageY
                  });
                  SDL.DOMButtons[i] = 0
                }
              }
              event.preventDefault();
              break;
            case "focus":
              SDL.events.push(event);
              event.preventDefault();
              break;
            case "blur":
              SDL.events.push(event);
              unpressAllPressedKeys();
              event.preventDefault();
              break;
            case "visibilitychange":
              SDL.events.push({
                type: "visibilitychange",
                visible: !document.hidden
              });
              unpressAllPressedKeys();
              event.preventDefault();
              break;
            case "unload":
              if (Browser.mainLoop.runner) {
                SDL.events.push(event);
                Browser.mainLoop.runner()
              }
              return;
            case "resize":
              SDL.events.push(event);
              if (event.preventDefault) {
                event.preventDefault()
              }
              break
          }
          if (SDL.events.length >= 1e4) {
            err("SDL event queue full, dropping events");
            SDL.events = SDL.events.slice(0, 1e4)
          }
          SDL.flushEventsToHandler();
          return
        },
        lookupKeyCodeForEvent: function (event) {
          var code = event.keyCode;
          if (code >= 65 && code <= 90) {
            code += 32
          } else {
            code = SDL.keyCodes[event.keyCode] || event.keyCode;
            if (event.location === KeyboardEvent.DOM_KEY_LOCATION_RIGHT && code >= (224 | 1 << 10) && code <= (227 | 1 << 10)) {
              code += 4
            }
          }
          return code
        },
        handleEvent: function (event) {
          if (event.handled) return;
          event.handled = true;
          switch (event.type) {
            case "touchstart":
            case "touchend":
            case "touchmove":
              {
                Browser.calculateMouseEvent(event);
                break
              }
            case "keydown":
            case "keyup":
              {
                var down = event.type === "keydown";
                var code = SDL.lookupKeyCodeForEvent(event); HEAP8[SDL.keyboardState + code >> 0] = down; SDL.modState = (HEAP8[SDL.keyboardState + 1248 >> 0] ? 64 : 0) | (HEAP8[SDL.keyboardState + 1249 >> 0] ? 1 : 0) | (HEAP8[SDL.keyboardState + 1250 >> 0] ? 256 : 0) | (HEAP8[SDL.keyboardState + 1252 >> 0] ? 128 : 0) | (HEAP8[SDL.keyboardState + 1253 >> 0] ? 2 : 0) | (HEAP8[SDL.keyboardState + 1254 >> 0] ? 512 : 0);
                if (down) {
                  SDL.keyboardMap[code] = event.keyCode
                } else {
                  delete SDL.keyboardMap[code]
                }
                break
              }
            case "mousedown":
            case "mouseup":
              if (event.type == "mousedown") {
                SDL.buttonState |= 1 << event.button
              } else if (event.type == "mouseup") {
                SDL.buttonState &= ~(1 << event.button)
              }
            case "mousemove":
              {
                Browser.calculateMouseEvent(event);
                break
              }
          }
        },
        flushEventsToHandler: function () {
          if (!SDL.eventHandler) return;
          while (SDL.pollEvent(SDL.eventHandlerTemp)) {
            Module["dynCall_iii"](SDL.eventHandler, SDL.eventHandlerContext, SDL.eventHandlerTemp)
          }
        },
        pollEvent: function (ptr) {
          if (SDL.initFlags & 512 && SDL.joystickEventState) {
            SDL.queryJoysticks()
          }
          if (ptr) {
            while (SDL.events.length > 0) {
              if (SDL.makeCEvent(SDL.events.shift(), ptr) !== false) return 1
            }
            return 0
          } else {
            return SDL.events.length > 0
          }
        },
        makeCEvent: function (event, ptr) {
          if (typeof event === "number") {
            _memcpy(ptr, event, 28);
            _free(event);
            return
          }
          SDL.handleEvent(event);
          switch (event.type) {
            case "keydown":
            case "keyup":
              {
                var down = event.type === "keydown";
                var key = SDL.lookupKeyCodeForEvent(event);
                var scan;
                if (key >= 1024) {
                  scan = key - 1024
                } else {
                  scan = SDL.scanCodes[key] || key
                }
                HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type]; HEAP8[ptr + 8 >> 0] = down ? 1 : 0; HEAP8[ptr + 9 >> 0] = 0; HEAP32[ptr + 12 >> 2] = scan; HEAP32[ptr + 16 >> 2] = key; HEAP16[ptr + 20 >> 1] = SDL.modState; HEAP32[ptr + 24 >> 2] = event.keypressCharCode || key;
                break
              }
            case "keypress":
              {
                HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
                var cStr = intArrayFromString(String.fromCharCode(event.charCode));
                for (var i = 0; i < cStr.length; ++i) {
                  HEAP8[ptr + (8 + i) >> 0] = cStr[i]
                }
                break
              }
            case "mousedown":
            case "mouseup":
            case "mousemove":
              {
                if (event.type != "mousemove") {
                  var down = event.type === "mousedown";
                  HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
                  HEAP32[ptr + 4 >> 2] = 0;
                  HEAP32[ptr + 8 >> 2] = 0;
                  HEAP32[ptr + 12 >> 2] = 0;
                  HEAP8[ptr + 16 >> 0] = event.button + 1;
                  HEAP8[ptr + 17 >> 0] = down ? 1 : 0;
                  HEAP32[ptr + 20 >> 2] = Browser.mouseX;
                  HEAP32[ptr + 24 >> 2] = Browser.mouseY
                } else {
                  HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
                  HEAP32[ptr + 4 >> 2] = 0;
                  HEAP32[ptr + 8 >> 2] = 0;
                  HEAP32[ptr + 12 >> 2] = 0;
                  HEAP32[ptr + 16 >> 2] = SDL.buttonState;
                  HEAP32[ptr + 20 >> 2] = Browser.mouseX;
                  HEAP32[ptr + 24 >> 2] = Browser.mouseY;
                  HEAP32[ptr + 28 >> 2] = Browser.mouseMovementX;
                  HEAP32[ptr + 32 >> 2] = Browser.mouseMovementY
                }
                break
              }
            case "wheel":
              {
                HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type]; HEAP32[ptr + 16 >> 2] = event.deltaX; HEAP32[ptr + 20 >> 2] = event.deltaY;
                break
              }
            case "touchstart":
            case "touchend":
            case "touchmove":
              {
                var touch = event.touch;
                if (!Browser.touches[touch.identifier]) break;
                var w = Module["canvas"].width;
                var h = Module["canvas"].height;
                var x = Browser.touches[touch.identifier].x / w;
                var y = Browser.touches[touch.identifier].y / h;
                var lx = Browser.lastTouches[touch.identifier].x / w;
                var ly = Browser.lastTouches[touch.identifier].y / h;
                var dx = x - lx;
                var dy = y - ly;
                if (touch["deviceID"] === undefined) touch.deviceID = SDL.TOUCH_DEFAULT_ID;
                if (dx === 0 && dy === 0 && event.type === "touchmove") return false; HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type]; HEAP32[ptr + 4 >> 2] = _SDL_GetTicks(); tempI64 = [touch.deviceID >>> 0, (tempDouble = touch.deviceID, +Math_abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)],
                  HEAP32[ptr + 8 >> 2] = tempI64[0],
                  HEAP32[ptr + 12 >> 2] = tempI64[1]; tempI64 = [touch.identifier >>> 0, (tempDouble = touch.identifier, +Math_abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math_min(+Math_floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)],
                    HEAP32[ptr + 16 >> 2] = tempI64[0],
                    HEAP32[ptr + 20 >> 2] = tempI64[1]; HEAPF32[ptr + 24 >> 2] = x; HEAPF32[ptr + 28 >> 2] = y; HEAPF32[ptr + 32 >> 2] = dx; HEAPF32[ptr + 36 >> 2] = dy;
                if (touch.force !== undefined) {
                  HEAPF32[ptr + 40 >> 2] = touch.force
                } else {
                  HEAPF32[ptr + 40 >> 2] = event.type == "touchend" ? 0 : 1
                }
                break
              }
            case "unload":
              {
                HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type];
                break
              }
            case "resize":
              {
                HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type]; HEAP32[ptr + 4 >> 2] = event.w; HEAP32[ptr + 8 >> 2] = event.h;
                break
              }
            case "joystick_button_up":
            case "joystick_button_down":
              {
                var state = event.type === "joystick_button_up" ? 0 : 1; HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type]; HEAP8[ptr + 4 >> 0] = event.index; HEAP8[ptr + 5 >> 0] = event.button; HEAP8[ptr + 6 >> 0] = state;
                break
              }
            case "joystick_axis_motion":
              {
                HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type]; HEAP8[ptr + 4 >> 0] = event.index; HEAP8[ptr + 5 >> 0] = event.axis; HEAP32[ptr + 8 >> 2] = SDL.joystickAxisValueConversion(event.value);
                break
              }
            case "focus":
              {
                var SDL_WINDOWEVENT_FOCUS_GAINED = 12; HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type]; HEAP32[ptr + 4 >> 2] = 0; HEAP8[ptr + 8 >> 0] = SDL_WINDOWEVENT_FOCUS_GAINED;
                break
              }
            case "blur":
              {
                var SDL_WINDOWEVENT_FOCUS_LOST = 13; HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type]; HEAP32[ptr + 4 >> 2] = 0; HEAP8[ptr + 8 >> 0] = SDL_WINDOWEVENT_FOCUS_LOST;
                break
              }
            case "visibilitychange":
              {
                var SDL_WINDOWEVENT_SHOWN = 1;
                var SDL_WINDOWEVENT_HIDDEN = 2;
                var visibilityEventID = event.visible ? SDL_WINDOWEVENT_SHOWN : SDL_WINDOWEVENT_HIDDEN; HEAP32[ptr >> 2] = SDL.DOMEventToSDLEvent[event.type]; HEAP32[ptr + 4 >> 2] = 0; HEAP8[ptr + 8 >> 0] = visibilityEventID;
                break
              }
            default:
              throw "Unhandled SDL event: " + event.type
          }
        },
        makeFontString: function (height, fontName) {
          if (fontName.charAt(0) != "'" && fontName.charAt(0) != '"') {
            fontName = '"' + fontName + '"'
          }
          return height + "px " + fontName + ", serif"
        },
        estimateTextWidth: function (fontData, text) {
          var h = fontData.size;
          var fontString = SDL.makeFontString(h, fontData.name);
          var tempCtx = SDL.ttfContext;
          tempCtx.save();
          tempCtx.font = fontString;
          var ret = tempCtx.measureText(text)
            .width | 0;
          tempCtx.restore();
          return ret
        },
        allocateChannels: function (num) {
          if (SDL.numChannels && SDL.numChannels >= num && num != 0) return;
          SDL.numChannels = num;
          SDL.channels = [];
          for (var i = 0; i < num; i++) {
            SDL.channels[i] = {
              audio: null,
              volume: 1
            }
          }
        },
        setGetVolume: function (info, volume) {
          if (!info) return 0;
          var ret = info.volume * 128;
          if (volume != -1) {
            info.volume = Math.min(Math.max(volume, 0), 128) / 128;
            if (info.audio) {
              try {
                info.audio.volume = info.volume;
                if (info.audio.webAudioGainNode) info.audio.webAudioGainNode["gain"]["value"] = info.volume
              } catch (e) {
                err("setGetVolume failed to set audio volume: " + e)
              }
            }
          }
          return ret
        },
        setPannerPosition: function (info, x, y, z) {
          if (!info) return;
          if (info.audio) {
            if (info.audio.webAudioPannerNode) {
              info.audio.webAudioPannerNode["setPosition"](x, y, z)
            }
          }
        },
        playWebAudio: function (audio) {
          if (!audio) return;
          if (audio.webAudioNode) return;
          if (!SDL.webAudioAvailable()) return;
          try {
            var webAudio = audio.resource.webAudio;
            audio.paused = false;
            if (!webAudio.decodedBuffer) {
              if (webAudio.onDecodeComplete === undefined) abort("Cannot play back audio object that was not loaded");
              webAudio.onDecodeComplete.push(function () {
                if (!audio.paused) SDL.playWebAudio(audio)
              });
              return
            }
            audio.webAudioNode = SDL.audioContext["createBufferSource"]();
            audio.webAudioNode["buffer"] = webAudio.decodedBuffer;
            audio.webAudioNode["loop"] = audio.loop;
            audio.webAudioNode["onended"] = function () {
              audio["onended"]()
            };
            audio.webAudioPannerNode = SDL.audioContext["createPanner"]();
            audio.webAudioPannerNode["setPosition"](0, 0, -.5);
            audio.webAudioPannerNode["panningModel"] = "equalpower";
            audio.webAudioGainNode = SDL.audioContext["createGain"]();
            audio.webAudioGainNode["gain"]["value"] = audio.volume;
            audio.webAudioNode["connect"](audio.webAudioPannerNode);
            audio.webAudioPannerNode["connect"](audio.webAudioGainNode);
            audio.webAudioGainNode["connect"](SDL.audioContext["destination"]);
            audio.webAudioNode["start"](0, audio.currentPosition);
            audio.startTime = SDL.audioContext["currentTime"] - audio.currentPosition
          } catch (e) {
            err("playWebAudio failed: " + e)
          }
        },
        pauseWebAudio: function (audio) {
          if (!audio) return;
          if (audio.webAudioNode) {
            try {
              audio.currentPosition = (SDL.audioContext["currentTime"] - audio.startTime) % audio.resource.webAudio.decodedBuffer.duration;
              audio.webAudioNode["onended"] = undefined;
              audio.webAudioNode.stop(0);
              audio.webAudioNode = undefined
            } catch (e) {
              err("pauseWebAudio failed: " + e)
            }
          }
          audio.paused = true
        },
        openAudioContext: function () {
          if (!SDL.audioContext) {
            if (typeof AudioContext !== "undefined") SDL.audioContext = new AudioContext;
            else if (typeof webkitAudioContext !== "undefined") SDL.audioContext = new webkitAudioContext
          }
        },
        webAudioAvailable: function () {
          return !!SDL.audioContext
        },
        fillWebAudioBufferFromHeap: function (heapPtr, sizeSamplesPerChannel, dstAudioBuffer) {
          var numChannels = SDL.audio.channels;
          for (var c = 0; c < numChannels; ++c) {
            var channelData = dstAudioBuffer["getChannelData"](c);
            if (channelData.length != sizeSamplesPerChannel) {
              throw "Web Audio output buffer length mismatch! Destination size: " + channelData.length + " samples vs expected " + sizeSamplesPerChannel + " samples!"
            }
            if (SDL.audio.format == 32784) {
              for (var j = 0; j < sizeSamplesPerChannel; ++j) {
                channelData[j] = HEAP16[heapPtr + (j * numChannels + c) * 2 >> 1] / 32768
              }
            } else if (SDL.audio.format == 8) {
              for (var j = 0; j < sizeSamplesPerChannel; ++j) {
                var v = HEAP8[heapPtr + (j * numChannels + c) >> 0];
                channelData[j] = (v >= 0 ? v - 128 : v + 128) / 128
              }
            } else if (SDL.audio.format == 33056) {
              for (var j = 0; j < sizeSamplesPerChannel; ++j) {
                channelData[j] = HEAPF32[heapPtr + (j * numChannels + c) * 4 >> 2]
              }
            } else {
              throw "Invalid SDL audio format " + SDL.audio.format + "!"
            }
          }
        },
        debugSurface: function (surfData) {
          console.log("dumping surface " + [surfData.surf, surfData.source, surfData.width, surfData.height]);
          var image = surfData.ctx.getImageData(0, 0, surfData.width, surfData.height);
          var data = image.data;
          var num = Math.min(surfData.width, surfData.height);
          for (var i = 0; i < num; i++) {
            console.log("   diagonal " + i + ":" + [data[i * surfData.width * 4 + i * 4 + 0], data[i * surfData.width * 4 + i * 4 + 1], data[i * surfData.width * 4 + i * 4 + 2], data[i * surfData.width * 4 + i * 4 + 3]])
          }
        },
        joystickEventState: 1,
        lastJoystickState: {},
        joystickNamePool: {},
        recordJoystickState: function (joystick, state) {
          var buttons = new Array(state.buttons.length);
          for (var i = 0; i < state.buttons.length; i++) {
            buttons[i] = SDL.getJoystickButtonState(state.buttons[i])
          }
          SDL.lastJoystickState[joystick] = {
            buttons: buttons,
            axes: state.axes.slice(0),
            timestamp: state.timestamp,
            index: state.index,
            id: state.id
          }
        },
        getJoystickButtonState: function (button) {
          if (typeof button === "object") {
            return button["pressed"]
          } else {
            return button > 0
          }
        },
        queryJoysticks: function () {
          for (var joystick in SDL.lastJoystickState) {
            var state = SDL.getGamepad(joystick - 1);
            var prevState = SDL.lastJoystickState[joystick];
            if (typeof state === "undefined") return;
            if (state === null) return;
            if (typeof state.timestamp !== "number" || state.timestamp !== prevState.timestamp || !state.timestamp) {
              var i;
              for (i = 0; i < state.buttons.length; i++) {
                var buttonState = SDL.getJoystickButtonState(state.buttons[i]);
                if (buttonState !== prevState.buttons[i]) {
                  SDL.events.push({
                    type: buttonState ? "joystick_button_down" : "joystick_button_up",
                    joystick: joystick,
                    index: joystick - 1,
                    button: i
                  })
                }
              }
              for (i = 0; i < state.axes.length; i++) {
                if (state.axes[i] !== prevState.axes[i]) {
                  SDL.events.push({
                    type: "joystick_axis_motion",
                    joystick: joystick,
                    index: joystick - 1,
                    axis: i,
                    value: state.axes[i]
                  })
                }
              }
              SDL.recordJoystickState(joystick, state)
            }
          }
        },
        joystickAxisValueConversion: function (value) {
          value = Math.min(1, Math.max(value, -1));
          return Math.ceil((value + 1) * 32767.5 - 32768)
        },
        getGamepads: function () {
          var fcn = navigator.getGamepads || navigator.webkitGamepads || navigator.mozGamepads || navigator.gamepads || navigator.webkitGetGamepads;
          if (fcn !== undefined) {
            return fcn.apply(navigator)
          } else {
            return []
          }
        },
        getGamepad: function (deviceIndex) {
          var gamepads = SDL.getGamepads();
          if (gamepads.length > deviceIndex && deviceIndex >= 0) {
            return gamepads[deviceIndex]
          }
          return null
        }
      };

      function _SDL_Flip(surf) { }

      function _SDL_GetError() {
        if (!SDL.errorMessage) {
          SDL.errorMessage = allocate(intArrayFromString("unknown SDL-emscripten error"), "i8", ALLOC_NORMAL)
        }
        return SDL.errorMessage
      }

      function _SDL_Init(initFlags) {
        SDL.startTime = Date.now();
        SDL.initFlags = initFlags;
        if (!Module["doNotCaptureKeyboard"]) {
          var keyboardListeningElement = Module["keyboardListeningElement"] || document;
          keyboardListeningElement.addEventListener("keydown", SDL.receiveEvent);
          keyboardListeningElement.addEventListener("keyup", SDL.receiveEvent);
          keyboardListeningElement.addEventListener("keypress", SDL.receiveEvent);
          window.addEventListener("focus", SDL.receiveEvent);
          window.addEventListener("blur", SDL.receiveEvent);
          document.addEventListener("visibilitychange", SDL.receiveEvent)
        }
        window.addEventListener("unload", SDL.receiveEvent);
        SDL.keyboardState = _malloc(65536);
        _memset(SDL.keyboardState, 0, 65536);
        SDL.DOMEventToSDLEvent["keydown"] = 768;
        SDL.DOMEventToSDLEvent["keyup"] = 769;
        SDL.DOMEventToSDLEvent["keypress"] = 771;
        SDL.DOMEventToSDLEvent["mousedown"] = 1025;
        SDL.DOMEventToSDLEvent["mouseup"] = 1026;
        SDL.DOMEventToSDLEvent["mousemove"] = 1024;
        SDL.DOMEventToSDLEvent["wheel"] = 1027;
        SDL.DOMEventToSDLEvent["touchstart"] = 1792;
        SDL.DOMEventToSDLEvent["touchend"] = 1793;
        SDL.DOMEventToSDLEvent["touchmove"] = 1794;
        SDL.DOMEventToSDLEvent["unload"] = 256;
        SDL.DOMEventToSDLEvent["resize"] = 28673;
        SDL.DOMEventToSDLEvent["visibilitychange"] = 512;
        SDL.DOMEventToSDLEvent["focus"] = 512;
        SDL.DOMEventToSDLEvent["blur"] = 512;
        SDL.DOMEventToSDLEvent["joystick_axis_motion"] = 1536;
        SDL.DOMEventToSDLEvent["joystick_button_down"] = 1539;
        SDL.DOMEventToSDLEvent["joystick_button_up"] = 1540;
        return 0
      }

      function _SDL_InitSubSystem(flags) {
        return 0
      }

      function _SDL_LockAudio() { }

      function _SDL_OpenAudio(desired, obtained) {
        try {
          SDL.audio = {
            freq: HEAPU32[desired >> 2],
            format: HEAPU16[desired + 4 >> 1],
            channels: HEAPU8[desired + 6 >> 0],
            samples: HEAPU16[desired + 8 >> 1],
            callback: HEAPU32[desired + 16 >> 2],
            userdata: HEAPU32[desired + 20 >> 2],
            paused: true,
            timer: null
          };
          if (SDL.audio.format == 8) {
            SDL.audio.silence = 128
          } else if (SDL.audio.format == 32784) {
            SDL.audio.silence = 0
          } else if (SDL.audio.format == 33056) {
            SDL.audio.silence = 0
          } else {
            throw "Invalid SDL audio format " + SDL.audio.format + "!"
          }
          if (SDL.audio.freq <= 0) {
            throw "Unsupported sound frequency " + SDL.audio.freq + "!"
          } else if (SDL.audio.freq <= 22050) {
            SDL.audio.freq = 22050
          } else if (SDL.audio.freq <= 32e3) {
            SDL.audio.freq = 32e3
          } else if (SDL.audio.freq <= 44100) {
            SDL.audio.freq = 44100
          } else if (SDL.audio.freq <= 48e3) {
            SDL.audio.freq = 48e3
          } else if (SDL.audio.freq <= 96e3) {
            SDL.audio.freq = 96e3
          } else {
            throw "Unsupported sound frequency " + SDL.audio.freq + "!"
          }
          if (SDL.audio.channels == 0) {
            SDL.audio.channels = 1
          } else if (SDL.audio.channels < 0 || SDL.audio.channels > 32) {
            throw "Unsupported number of audio channels for SDL audio: " + SDL.audio.channels + "!"
          } else if (SDL.audio.channels != 1 && SDL.audio.channels != 2) {
            console.log("Warning: Using untested number of audio channels " + SDL.audio.channels)
          }
          if (SDL.audio.samples < 128 || SDL.audio.samples > 524288) {
            throw "Unsupported audio callback buffer size " + SDL.audio.samples + "!"
          } else if ((SDL.audio.samples & SDL.audio.samples - 1) != 0) {
            throw "Audio callback buffer size " + SDL.audio.samples + " must be a power-of-two!"
          }
          var totalSamples = SDL.audio.samples * SDL.audio.channels;
          if (SDL.audio.format == 8) {
            SDL.audio.bytesPerSample = 1
          } else if (SDL.audio.format == 32784) {
            SDL.audio.bytesPerSample = 2
          } else if (SDL.audio.format == 33056) {
            SDL.audio.bytesPerSample = 4
          } else {
            throw "Invalid SDL audio format " + SDL.audio.format + "!"
          }
          SDL.audio.bufferSize = totalSamples * SDL.audio.bytesPerSample;
          SDL.audio.bufferDurationSecs = SDL.audio.bufferSize / SDL.audio.bytesPerSample / SDL.audio.channels / SDL.audio.freq;
          SDL.audio.bufferingDelay = 50 / 1e3;
          SDL.audio.buffer = _malloc(SDL.audio.bufferSize);
          SDL.audio.numSimultaneouslyQueuedBuffers = Module["SDL_numSimultaneouslyQueuedBuffers"] || 5;
          SDL.audio.queueNewAudioData = function SDL_queueNewAudioData() {
            if (!SDL.audio) return;
            for (var i = 0; i < SDL.audio.numSimultaneouslyQueuedBuffers; ++i) {
              var secsUntilNextPlayStart = SDL.audio.nextPlayTime - SDL.audioContext["currentTime"];
              if (secsUntilNextPlayStart >= SDL.audio.bufferingDelay + SDL.audio.bufferDurationSecs * SDL.audio.numSimultaneouslyQueuedBuffers) return;
              dynCall_viii(SDL.audio.callback, SDL.audio.userdata, SDL.audio.buffer, SDL.audio.bufferSize);
              SDL.audio.pushAudio(SDL.audio.buffer, SDL.audio.bufferSize)
            }
          };
          SDL.audio.caller = function SDL_audioCaller() {
            if (!SDL.audio) return;
            --SDL.audio.numAudioTimersPending;
            SDL.audio.queueNewAudioData();
            var secsUntilNextPlayStart = SDL.audio.nextPlayTime - SDL.audioContext["currentTime"];
            var preemptBufferFeedSecs = SDL.audio.bufferDurationSecs / 2;
            if (SDL.audio.numAudioTimersPending < SDL.audio.numSimultaneouslyQueuedBuffers) {
              ++SDL.audio.numAudioTimersPending;
              SDL.audio.timer = Browser.safeSetTimeout(SDL.audio.caller, Math.max(0, 1e3 * (secsUntilNextPlayStart - preemptBufferFeedSecs)));
              if (SDL.audio.numAudioTimersPending < SDL.audio.numSimultaneouslyQueuedBuffers) {
                ++SDL.audio.numAudioTimersPending;
                Browser.safeSetTimeout(SDL.audio.caller, 1)
              }
            }
          };
          SDL.audio.audioOutput = new Audio;
          SDL.openAudioContext();
          if (!SDL.audioContext) throw "Web Audio API is not available!";
          SDL.audio.nextPlayTime = 0;
          SDL.audio.pushAudio = function (ptr, sizeBytes) {
            try {
              if (SDL.audio.paused) return;
              var sizeSamples = sizeBytes / SDL.audio.bytesPerSample;
              var sizeSamplesPerChannel = sizeSamples / SDL.audio.channels;
              if (sizeSamplesPerChannel != SDL.audio.samples) {
                throw "Received mismatching audio buffer size!"
              }
              var source = SDL.audioContext["createBufferSource"]();
              var soundBuffer = SDL.audioContext["createBuffer"](SDL.audio.channels, sizeSamplesPerChannel, SDL.audio.freq);
              source["connect"](SDL.audioContext["destination"]);
              SDL.fillWebAudioBufferFromHeap(ptr, sizeSamplesPerChannel, soundBuffer);
              source["buffer"] = soundBuffer;
              var curtime = SDL.audioContext["currentTime"];
              var playtime = Math.max(curtime + SDL.audio.bufferingDelay, SDL.audio.nextPlayTime);
              if (typeof source["start"] !== "undefined") {
                source["start"](playtime)
              } else if (typeof source["noteOn"] !== "undefined") {
                source["noteOn"](playtime)
              }
              SDL.audio.nextPlayTime = playtime + SDL.audio.bufferDurationSecs
            } catch (e) {
              console.log("Web Audio API error playing back audio: " + e.toString())
            }
          };
          if (obtained) {
            HEAP32[obtained >> 2] = SDL.audio.freq;
            HEAP16[obtained + 4 >> 1] = SDL.audio.format;
            HEAP8[obtained + 6 >> 0] = SDL.audio.channels;
            HEAP8[obtained + 7 >> 0] = SDL.audio.silence;
            HEAP16[obtained + 8 >> 1] = SDL.audio.samples;
            HEAP32[obtained + 16 >> 2] = SDL.audio.callback;
            HEAP32[obtained + 20 >> 2] = SDL.audio.userdata
          }
          SDL.allocateChannels(32)
        } catch (e) {
          console.log('Initializing SDL audio threw an exception: "' + e.toString() + '"! Continuing without audio.');
          SDL.audio = null;
          SDL.allocateChannels(0);
          if (obtained) {
            HEAP32[obtained >> 2] = 0;
            HEAP16[obtained + 4 >> 1] = 0;
            HEAP8[obtained + 6 >> 0] = 0;
            HEAP8[obtained + 7 >> 0] = 0;
            HEAP16[obtained + 8 >> 1] = 0;
            HEAP32[obtained + 16 >> 2] = 0;
            HEAP32[obtained + 20 >> 2] = 0
          }
        }
        if (!SDL.audio) {
          return -1
        }
        return 0
      }

      function _SDL_PauseAudio(pauseOn) {
        if (!SDL.audio) {
          return
        }
        if (pauseOn) {
          if (SDL.audio.timer !== undefined) {
            clearTimeout(SDL.audio.timer);
            SDL.audio.numAudioTimersPending = 0;
            SDL.audio.timer = undefined
          }
        } else if (!SDL.audio.timer) {
          SDL.audio.numAudioTimersPending = 1;
          SDL.audio.timer = Browser.safeSetTimeout(SDL.audio.caller, 1)
        }
        SDL.audio.paused = pauseOn
      }

      function _SDL_PollEvent(ptr) {
        return SDL.pollEvent(ptr)
      }

      function _SDL_AudioQuit() {
        for (var i = 0; i < SDL.numChannels; ++i) {
          if (SDL.channels[i].audio) {
            SDL.channels[i].audio.pause();
            SDL.channels[i].audio = undefined
          }
        }
        if (SDL.music.audio) SDL.music.audio.pause();
        SDL.music.audio = undefined
      }

      function _SDL_Quit() {
        _SDL_AudioQuit();
        out("SDL_Quit called (and ignored)")
      }
      var GL = {
        counter: 1,
        lastError: 0,
        buffers: [],
        mappedBuffers: {},
        programs: [],
        framebuffers: [],
        renderbuffers: [],
        textures: [],
        uniforms: [],
        shaders: [],
        vaos: [],
        contexts: {},
        currentContext: null,
        offscreenCanvases: {},
        timerQueriesEXT: [],
        programInfos: {},
        stringCache: {},
        unpackAlignment: 4,
        init: function () {
          GL.miniTempBuffer = new Float32Array(GL.MINI_TEMP_BUFFER_SIZE);
          for (var i = 0; i < GL.MINI_TEMP_BUFFER_SIZE; i++) {
            GL.miniTempBufferViews[i] = GL.miniTempBuffer.subarray(0, i + 1)
          }
        },
        recordError: function recordError(errorCode) {
          if (!GL.lastError) {
            GL.lastError = errorCode
          }
        },
        getNewId: function (table) {
          var ret = GL.counter++;
          for (var i = table.length; i < ret; i++) {
            table[i] = null
          }
          return ret
        },
        MINI_TEMP_BUFFER_SIZE: 256,
        miniTempBuffer: null,
        miniTempBufferViews: [0],
        getSource: function (shader, count, string, length) {
          var source = "";
          for (var i = 0; i < count; ++i) {
            var len = length ? HEAP32[length + i * 4 >> 2] : -1;
            source += UTF8ToString(HEAP32[string + i * 4 >> 2], len < 0 ? undefined : len)
          }
          return source
        },
        createContext: function (canvas, webGLContextAttributes) {
          var ctx = canvas.getContext("webgl", webGLContextAttributes) || canvas.getContext("experimental-webgl", webGLContextAttributes);
          return ctx && GL.registerContext(ctx, webGLContextAttributes)
        },
        registerContext: function (ctx, webGLContextAttributes) {
          var handle = _malloc(8);
          var context = {
            handle: handle,
            attributes: webGLContextAttributes,
            version: webGLContextAttributes.majorVersion,
            GLctx: ctx
          };
          if (ctx.canvas) ctx.canvas.GLctxObject = context;
          GL.contexts[handle] = context;
          if (typeof webGLContextAttributes.enableExtensionsByDefault === "undefined" || webGLContextAttributes.enableExtensionsByDefault) {
            GL.initExtensions(context)
          }
          return handle
        },
        makeContextCurrent: function (contextHandle) {
          GL.currentContext = GL.contexts[contextHandle];
          Module.ctx = GLctx = GL.currentContext && GL.currentContext.GLctx;
          return !(contextHandle && !GLctx)
        },
        getContext: function (contextHandle) {
          return GL.contexts[contextHandle]
        },
        deleteContext: function (contextHandle) {
          if (GL.currentContext === GL.contexts[contextHandle]) GL.currentContext = null;
          if (typeof JSEvents === "object") JSEvents.removeAllHandlersOnTarget(GL.contexts[contextHandle].GLctx.canvas);
          if (GL.contexts[contextHandle] && GL.contexts[contextHandle].GLctx.canvas) GL.contexts[contextHandle].GLctx.canvas.GLctxObject = undefined;
          _free(GL.contexts[contextHandle]);
          GL.contexts[contextHandle] = null
        },
        initExtensions: function (context) {
          if (!context) context = GL.currentContext;
          if (context.initExtensionsDone) return;
          context.initExtensionsDone = true;
          var GLctx = context.GLctx;
          if (context.version < 2) {
            var instancedArraysExt = GLctx.getExtension("ANGLE_instanced_arrays");
            if (instancedArraysExt) {
              GLctx["vertexAttribDivisor"] = function (index, divisor) {
                instancedArraysExt["vertexAttribDivisorANGLE"](index, divisor)
              };
              GLctx["drawArraysInstanced"] = function (mode, first, count, primcount) {
                instancedArraysExt["drawArraysInstancedANGLE"](mode, first, count, primcount)
              };
              GLctx["drawElementsInstanced"] = function (mode, count, type, indices, primcount) {
                instancedArraysExt["drawElementsInstancedANGLE"](mode, count, type, indices, primcount)
              }
            }
            var vaoExt = GLctx.getExtension("OES_vertex_array_object");
            if (vaoExt) {
              GLctx["createVertexArray"] = function () {
                return vaoExt["createVertexArrayOES"]()
              };
              GLctx["deleteVertexArray"] = function (vao) {
                vaoExt["deleteVertexArrayOES"](vao)
              };
              GLctx["bindVertexArray"] = function (vao) {
                vaoExt["bindVertexArrayOES"](vao)
              };
              GLctx["isVertexArray"] = function (vao) {
                return vaoExt["isVertexArrayOES"](vao)
              }
            }
            var drawBuffersExt = GLctx.getExtension("WEBGL_draw_buffers");
            if (drawBuffersExt) {
              GLctx["drawBuffers"] = function (n, bufs) {
                drawBuffersExt["drawBuffersWEBGL"](n, bufs)
              }
            }
          }
          GLctx.disjointTimerQueryExt = GLctx.getExtension("EXT_disjoint_timer_query");
          var automaticallyEnabledExtensions = ["OES_texture_float", "OES_texture_half_float", "OES_standard_derivatives", "OES_vertex_array_object", "WEBGL_compressed_texture_s3tc", "WEBGL_depth_texture", "OES_element_index_uint", "EXT_texture_filter_anisotropic", "EXT_frag_depth", "WEBGL_draw_buffers", "ANGLE_instanced_arrays", "OES_texture_float_linear", "OES_texture_half_float_linear", "EXT_blend_minmax", "EXT_shader_texture_lod", "WEBGL_compressed_texture_pvrtc", "EXT_color_buffer_half_float", "WEBGL_color_buffer_float", "EXT_sRGB", "WEBGL_compressed_texture_etc1", "EXT_disjoint_timer_query", "WEBGL_compressed_texture_etc", "WEBGL_compressed_texture_astc", "EXT_color_buffer_float", "WEBGL_compressed_texture_s3tc_srgb", "EXT_disjoint_timer_query_webgl2"];
          var exts = GLctx.getSupportedExtensions();
          if (exts && exts.length > 0) {
            GLctx.getSupportedExtensions()
              .forEach(function (ext) {
                if (automaticallyEnabledExtensions.indexOf(ext) != -1) {
                  GLctx.getExtension(ext)
                }
              })
          }
        },
        populateUniformTable: function (program) {
          var p = GL.programs[program];
          var ptable = GL.programInfos[program] = {
            uniforms: {},
            maxUniformLength: 0,
            maxAttributeLength: -1,
            maxUniformBlockNameLength: -1
          };
          var utable = ptable.uniforms;
          var numUniforms = GLctx.getProgramParameter(p, 35718);
          for (var i = 0; i < numUniforms; ++i) {
            var u = GLctx.getActiveUniform(p, i);
            var name = u.name;
            ptable.maxUniformLength = Math.max(ptable.maxUniformLength, name.length + 1);
            if (name.slice(-1) == "]") {
              name = name.slice(0, name.lastIndexOf("["))
            }
            var loc = GLctx.getUniformLocation(p, name);
            if (loc) {
              var id = GL.getNewId(GL.uniforms);
              utable[name] = [u.size, id];
              GL.uniforms[id] = loc;
              for (var j = 1; j < u.size; ++j) {
                var n = name + "[" + j + "]";
                loc = GLctx.getUniformLocation(p, n);
                id = GL.getNewId(GL.uniforms);
                GL.uniforms[id] = loc
              }
            }
          }
        }
      };

      function _SDL_SetVideoMode(width, height, depth, flags) {
        ["touchstart", "touchend", "touchmove", "mousedown", "mouseup", "mousemove", "DOMMouseScroll", "mousewheel", "wheel", "mouseout"].forEach(function (event) {
          Module["canvas"].addEventListener(event, SDL.receiveEvent, true)
        });
        var canvas = Module["canvas"];
        if (width == 0 && height == 0) {
          width = canvas.width;
          height = canvas.height
        }
        if (!SDL.addedResizeListener) {
          SDL.addedResizeListener = true;
          Browser.resizeListeners.push(function (w, h) {
            if (!SDL.settingVideoMode) {
              SDL.receiveEvent({
                type: "resize",
                w: w,
                h: h
              })
            }
          })
        }
        SDL.settingVideoMode = true;
        Browser.setCanvasSize(width, height);
        SDL.settingVideoMode = false;
        if (SDL.screen) {
          SDL.freeSurface(SDL.screen);
          assert(!SDL.screen)
        }
        if (SDL.GL) flags = flags | 67108864;
        SDL.screen = SDL.makeSurface(width, height, flags, true, "screen");
        return SDL.screen
      }

      function _SDL_UnlockAudio() { }

      function _SDL_UnlockSurface(surf) {
        assert(!SDL.GL);
        var surfData = SDL.surfaces[surf];
        if (!surfData.locked || --surfData.locked > 0) {
          return
        }
        if (surfData.isFlagSet(2097152)) {
          SDL.copyIndexedColorData(surfData)
        } else if (!surfData.colors) {
          var data = surfData.image.data;
          var buffer = surfData.buffer;
          assert(buffer % 4 == 0, "Invalid buffer offset: " + buffer);
          var src = buffer >> 2;
          var dst = 0;
          var isScreen = surf == SDL.screen;
          var num;
          if (typeof CanvasPixelArray !== "undefined" && data instanceof CanvasPixelArray) {
            num = data.length;
            while (dst < num) {
              var val = HEAP32[src];
              data[dst] = val & 255;
              data[dst + 1] = val >> 8 & 255;
              data[dst + 2] = val >> 16 & 255;
              data[dst + 3] = isScreen ? 255 : val >> 24 & 255;
              src++;
              dst += 4
            }
          } else {
            var data32 = new Uint32Array(data.buffer);
            if (isScreen && SDL.defaults.opaqueFrontBuffer) {
              num = data32.length;
              data32.set(HEAP32.subarray(src, src + num));
              var data8 = new Uint8Array(data.buffer);
              var i = 3;
              var j = i + 4 * num;
              if (num % 8 == 0) {
                while (i < j) {
                  data8[i] = 255;
                  i = i + 4 | 0;
                  data8[i] = 255;
                  i = i + 4 | 0;
                  data8[i] = 255;
                  i = i + 4 | 0;
                  data8[i] = 255;
                  i = i + 4 | 0;
                  data8[i] = 255;
                  i = i + 4 | 0;
                  data8[i] = 255;
                  i = i + 4 | 0;
                  data8[i] = 255;
                  i = i + 4 | 0;
                  data8[i] = 255;
                  i = i + 4 | 0
                }
              } else {
                while (i < j) {
                  data8[i] = 255;
                  i = i + 4 | 0
                }
              }
            } else {
              data32.set(HEAP32.subarray(src, src + data32.length))
            }
          }
        } else {
          var width = Module["canvas"].width;
          var height = Module["canvas"].height;
          var s = surfData.buffer;
          var data = surfData.image.data;
          var colors = surfData.colors;
          for (var y = 0; y < height; y++) {
            var base = y * width * 4;
            for (var x = 0; x < width; x++) {
              var val = HEAPU8[s++ >> 0] * 4;
              var start = base + x * 4;
              data[start] = colors[val];
              data[start + 1] = colors[val + 1];
              data[start + 2] = colors[val + 2]
            }
            s += width * 3
          }
        }
        surfData.ctx.putImageData(surfData.image, 0, 0)
      }

      function ___assert_fail(condition, filename, line, func) {
        abort("Assertion failed: " + UTF8ToString(condition) + ", at: " + [filename ? UTF8ToString(filename) : "unknown filename", line, func ? UTF8ToString(func) : "unknown function"])
      }
      var ENV = {};

      function ___buildEnvironment(environ) {
        var MAX_ENV_VALUES = 64;
        var TOTAL_ENV_SIZE = 1024;
        var poolPtr;
        var envPtr;
        if (!___buildEnvironment.called) {
          ___buildEnvironment.called = true;
          ENV["USER"] = ENV["LOGNAME"] = "web_user";
          ENV["PATH"] = "/";
          ENV["PWD"] = "/";
          ENV["HOME"] = "/home/web_user";
          ENV["LANG"] = "C.UTF-8";
          ENV["_"] = Module["thisProgram"];
          poolPtr = getMemory(TOTAL_ENV_SIZE);
          envPtr = getMemory(MAX_ENV_VALUES * 4);
          HEAP32[envPtr >> 2] = poolPtr;
          HEAP32[environ >> 2] = envPtr
        } else {
          envPtr = HEAP32[environ >> 2];
          poolPtr = HEAP32[envPtr >> 2]
        }
        var strings = [];
        var totalSize = 0;
        for (var key in ENV) {
          if (typeof ENV[key] === "string") {
            var line = key + "=" + ENV[key];
            strings.push(line);
            totalSize += line.length
          }
        }
        if (totalSize > TOTAL_ENV_SIZE) {
          throw new Error("Environment size exceeded TOTAL_ENV_SIZE!")
        }
        var ptrSize = 4;
        for (var i = 0; i < strings.length; i++) {
          var line = strings[i];
          writeAsciiToMemory(line, poolPtr);
          HEAP32[envPtr + i * ptrSize >> 2] = poolPtr;
          poolPtr += line.length + 1
        }
        HEAP32[envPtr + strings.length * ptrSize >> 2] = 0
      }

      function ___cxa_pure_virtual() {
        ABORT = true;
        throw "Pure virtual function called!"
      }

      function ___lock() { }
      var ERRNO_CODES = {
        EPERM: 1,
        ENOENT: 2,
        ESRCH: 3,
        EINTR: 4,
        EIO: 5,
        ENXIO: 6,
        E2BIG: 7,
        ENOEXEC: 8,
        EBADF: 9,
        ECHILD: 10,
        EAGAIN: 11,
        EWOULDBLOCK: 11,
        ENOMEM: 12,
        EACCES: 13,
        EFAULT: 14,
        ENOTBLK: 15,
        EBUSY: 16,
        EEXIST: 17,
        EXDEV: 18,
        ENODEV: 19,
        ENOTDIR: 20,
        EISDIR: 21,
        EINVAL: 22,
        ENFILE: 23,
        EMFILE: 24,
        ENOTTY: 25,
        ETXTBSY: 26,
        EFBIG: 27,
        ENOSPC: 28,
        ESPIPE: 29,
        EROFS: 30,
        EMLINK: 31,
        EPIPE: 32,
        EDOM: 33,
        ERANGE: 34,
        ENOMSG: 42,
        EIDRM: 43,
        ECHRNG: 44,
        EL2NSYNC: 45,
        EL3HLT: 46,
        EL3RST: 47,
        ELNRNG: 48,
        EUNATCH: 49,
        ENOCSI: 50,
        EL2HLT: 51,
        EDEADLK: 35,
        ENOLCK: 37,
        EBADE: 52,
        EBADR: 53,
        EXFULL: 54,
        ENOANO: 55,
        EBADRQC: 56,
        EBADSLT: 57,
        EDEADLOCK: 35,
        EBFONT: 59,
        ENOSTR: 60,
        ENODATA: 61,
        ETIME: 62,
        ENOSR: 63,
        ENONET: 64,
        ENOPKG: 65,
        EREMOTE: 66,
        ENOLINK: 67,
        EADV: 68,
        ESRMNT: 69,
        ECOMM: 70,
        EPROTO: 71,
        EMULTIHOP: 72,
        EDOTDOT: 73,
        EBADMSG: 74,
        ENOTUNIQ: 76,
        EBADFD: 77,
        EREMCHG: 78,
        ELIBACC: 79,
        ELIBBAD: 80,
        ELIBSCN: 81,
        ELIBMAX: 82,
        ELIBEXEC: 83,
        ENOSYS: 38,
        ENOTEMPTY: 39,
        ENAMETOOLONG: 36,
        ELOOP: 40,
        EOPNOTSUPP: 95,
        EPFNOSUPPORT: 96,
        ECONNRESET: 104,
        ENOBUFS: 105,
        EAFNOSUPPORT: 97,
        EPROTOTYPE: 91,
        ENOTSOCK: 88,
        ENOPROTOOPT: 92,
        ESHUTDOWN: 108,
        ECONNREFUSED: 111,
        EADDRINUSE: 98,
        ECONNABORTED: 103,
        ENETUNREACH: 101,
        ENETDOWN: 100,
        ETIMEDOUT: 110,
        EHOSTDOWN: 112,
        EHOSTUNREACH: 113,
        EINPROGRESS: 115,
        EALREADY: 114,
        EDESTADDRREQ: 89,
        EMSGSIZE: 90,
        EPROTONOSUPPORT: 93,
        ESOCKTNOSUPPORT: 94,
        EADDRNOTAVAIL: 99,
        ENETRESET: 102,
        EISCONN: 106,
        ENOTCONN: 107,
        ETOOMANYREFS: 109,
        EUSERS: 87,
        EDQUOT: 122,
        ESTALE: 116,
        ENOTSUP: 95,
        ENOMEDIUM: 123,
        EILSEQ: 84,
        EOVERFLOW: 75,
        ECANCELED: 125,
        ENOTRECOVERABLE: 131,
        EOWNERDEAD: 130,
        ESTRPIPE: 86
      };
      var SYSCALLS = {
        DEFAULT_POLLMASK: 5,
        mappings: {},
        umask: 511,
        calculateAt: function (dirfd, path) {
          if (path[0] !== "/") {
            var dir;
            if (dirfd === -100) {
              dir = FS.cwd()
            } else {
              var dirstream = FS.getStream(dirfd);
              if (!dirstream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
              dir = dirstream.path
            }
            path = PATH.join2(dir, path)
          }
          return path
        },
        doStat: function (func, path, buf) {
          try {
            var stat = func(path)
          } catch (e) {
            if (e && e.node && PATH.normalize(path) !== PATH.normalize(FS.getPath(e.node))) {
              return -ERRNO_CODES.ENOTDIR
            }
            throw e
          }
          HEAP32[buf >> 2] = stat.dev;
          HEAP32[buf + 4 >> 2] = 0;
          HEAP32[buf + 8 >> 2] = stat.ino;
          HEAP32[buf + 12 >> 2] = stat.mode;
          HEAP32[buf + 16 >> 2] = stat.nlink;
          HEAP32[buf + 20 >> 2] = stat.uid;
          HEAP32[buf + 24 >> 2] = stat.gid;
          HEAP32[buf + 28 >> 2] = stat.rdev;
          HEAP32[buf + 32 >> 2] = 0;
          HEAP32[buf + 36 >> 2] = stat.size;
          HEAP32[buf + 40 >> 2] = 4096;
          HEAP32[buf + 44 >> 2] = stat.blocks;
          HEAP32[buf + 48 >> 2] = stat.atime.getTime() / 1e3 | 0;
          HEAP32[buf + 52 >> 2] = 0;
          HEAP32[buf + 56 >> 2] = stat.mtime.getTime() / 1e3 | 0;
          HEAP32[buf + 60 >> 2] = 0;
          HEAP32[buf + 64 >> 2] = stat.ctime.getTime() / 1e3 | 0;
          HEAP32[buf + 68 >> 2] = 0;
          HEAP32[buf + 72 >> 2] = stat.ino;
          return 0
        },
        doMsync: function (addr, stream, len, flags) {
          var buffer = new Uint8Array(HEAPU8.subarray(addr, addr + len));
          FS.msync(stream, buffer, 0, len, flags)
        },
        doMkdir: function (path, mode) {
          path = PATH.normalize(path);
          if (path[path.length - 1] === "/") path = path.substr(0, path.length - 1);
          FS.mkdir(path, mode, 0);
          return 0
        },
        doMknod: function (path, mode, dev) {
          switch (mode & 61440) {
            case 32768:
            case 8192:
            case 24576:
            case 4096:
            case 49152:
              break;
            default:
              return -ERRNO_CODES.EINVAL
          }
          FS.mknod(path, mode, dev);
          return 0
        },
        doReadlink: function (path, buf, bufsize) {
          if (bufsize <= 0) return -ERRNO_CODES.EINVAL;
          var ret = FS.readlink(path);
          var len = Math.min(bufsize, lengthBytesUTF8(ret));
          var endChar = HEAP8[buf + len];
          stringToUTF8(ret, buf, bufsize + 1);
          HEAP8[buf + len] = endChar;
          return len
        },
        doAccess: function (path, amode) {
          if (amode & ~7) {
            return -ERRNO_CODES.EINVAL
          }
          var node;
          var lookup = FS.lookupPath(path, {
            follow: true
          });
          node = lookup.node;
          var perms = "";
          if (amode & 4) perms += "r";
          if (amode & 2) perms += "w";
          if (amode & 1) perms += "x";
          if (perms && FS.nodePermissions(node, perms)) {
            return -ERRNO_CODES.EACCES
          }
          return 0
        },
        doDup: function (path, flags, suggestFD) {
          var suggest = FS.getStream(suggestFD);
          if (suggest) FS.close(suggest);
          return FS.open(path, flags, 0, suggestFD, suggestFD)
            .fd
        },
        doReadv: function (stream, iov, iovcnt, offset) {
          var ret = 0;
          for (var i = 0; i < iovcnt; i++) {
            var ptr = HEAP32[iov + i * 8 >> 2];
            var len = HEAP32[iov + (i * 8 + 4) >> 2];
            var curr = FS.read(stream, HEAP8, ptr, len, offset);
            if (curr < 0) return -1;
            ret += curr;
            if (curr < len) break
          }
          return ret
        },
        doWritev: function (stream, iov, iovcnt, offset) {
          var ret = 0;
          for (var i = 0; i < iovcnt; i++) {
            var ptr = HEAP32[iov + i * 8 >> 2];
            var len = HEAP32[iov + (i * 8 + 4) >> 2];
            var curr = FS.write(stream, HEAP8, ptr, len, offset);
            if (curr < 0) return -1;
            ret += curr
          }
          return ret
        },
        varargs: 0,
        get: function (varargs) {
          SYSCALLS.varargs += 4;
          var ret = HEAP32[SYSCALLS.varargs - 4 >> 2];
          return ret
        },
        getStr: function () {
          var ret = UTF8ToString(SYSCALLS.get());
          return ret
        },
        getStreamFromFD: function () {
          var stream = FS.getStream(SYSCALLS.get());
          if (!stream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
          return stream
        },
        getSocketFromFD: function () {
          var socket = SOCKFS.getSocket(SYSCALLS.get());
          if (!socket) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
          return socket
        },
        getSocketAddress: function (allowNull) {
          var addrp = SYSCALLS.get(),
            addrlen = SYSCALLS.get();
          if (allowNull && addrp === 0) return null;
          var info = __read_sockaddr(addrp, addrlen);
          if (info.errno) throw new FS.ErrnoError(info.errno);
          info.addr = DNS.lookup_addr(info.addr) || info.addr;
          return info
        },
        get64: function () {
          var low = SYSCALLS.get(),
            high = SYSCALLS.get();
          return low
        },
        getZero: function () {
          SYSCALLS.get()
        }
      };

      function ___syscall140(which, varargs) {
        SYSCALLS.varargs = varargs;
        try {
          var stream = SYSCALLS.getStreamFromFD(),
            offset_high = SYSCALLS.get(),
            offset_low = SYSCALLS.get(),
            result = SYSCALLS.get(),
            whence = SYSCALLS.get();
          var offset = offset_low;
          FS.llseek(stream, offset, whence);
          HEAP32[result >> 2] = stream.position;
          if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null;
          return 0
        } catch (e) {
          if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
          return -e.errno
        }
      }

      function ___syscall145(which, varargs) {
        SYSCALLS.varargs = varargs;
        try {
          var stream = SYSCALLS.getStreamFromFD(),
            iov = SYSCALLS.get(),
            iovcnt = SYSCALLS.get();
          return SYSCALLS.doReadv(stream, iov, iovcnt)
        } catch (e) {
          if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
          return -e.errno
        }
      }

      function ___syscall146(which, varargs) {
        SYSCALLS.varargs = varargs;
        try {
          var stream = SYSCALLS.getStreamFromFD(),
            iov = SYSCALLS.get(),
            iovcnt = SYSCALLS.get();
          return SYSCALLS.doWritev(stream, iov, iovcnt)
        } catch (e) {
          if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
          return -e.errno
        }
      }

      function ___syscall221(which, varargs) {
        SYSCALLS.varargs = varargs;
        try {
          var stream = SYSCALLS.getStreamFromFD(),
            cmd = SYSCALLS.get();
          switch (cmd) {
            case 0:
              {
                var arg = SYSCALLS.get();
                if (arg < 0) {
                  return -ERRNO_CODES.EINVAL
                }
                var newStream; newStream = FS.open(stream.path, stream.flags, 0, arg);
                return newStream.fd
              }
            case 1:
            case 2:
              return 0;
            case 3:
              return stream.flags;
            case 4:
              {
                var arg = SYSCALLS.get(); stream.flags |= arg;
                return 0
              }
            case 12:
              {
                var arg = SYSCALLS.get();
                var offset = 0; HEAP16[arg + offset >> 1] = 2;
                return 0
              }
            case 13:
            case 14:
              return 0;
            case 16:
            case 8:
              return -ERRNO_CODES.EINVAL;
            case 9:
              ___setErrNo(ERRNO_CODES.EINVAL);
              return -1;
            default:
              {
                return -ERRNO_CODES.EINVAL
              }
          }
        } catch (e) {
          if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
          return -e.errno
        }
      }

      function ___syscall5(which, varargs) {
        SYSCALLS.varargs = varargs;
        try {
          var pathname = SYSCALLS.getStr(),
            flags = SYSCALLS.get(),
            mode = SYSCALLS.get();
          var stream = FS.open(pathname, flags, mode);
          return stream.fd
        } catch (e) {
          if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
          return -e.errno
        }
      }

      function ___syscall54(which, varargs) {
        SYSCALLS.varargs = varargs;
        try {
          var stream = SYSCALLS.getStreamFromFD(),
            op = SYSCALLS.get();
          switch (op) {
            case 21509:
            case 21505:
              {
                if (!stream.tty) return -ERRNO_CODES.ENOTTY;
                return 0
              }
            case 21510:
            case 21511:
            case 21512:
            case 21506:
            case 21507:
            case 21508:
              {
                if (!stream.tty) return -ERRNO_CODES.ENOTTY;
                return 0
              }
            case 21519:
              {
                if (!stream.tty) return -ERRNO_CODES.ENOTTY;
                var argp = SYSCALLS.get(); HEAP32[argp >> 2] = 0;
                return 0
              }
            case 21520:
              {
                if (!stream.tty) return -ERRNO_CODES.ENOTTY;
                return -ERRNO_CODES.EINVAL
              }
            case 21531:
              {
                var argp = SYSCALLS.get();
                return FS.ioctl(stream, op, argp)
              }
            case 21523:
              {
                if (!stream.tty) return -ERRNO_CODES.ENOTTY;
                return 0
              }
            case 21524:
              {
                if (!stream.tty) return -ERRNO_CODES.ENOTTY;
                return 0
              }
            default:
              abort("bad ioctl syscall " + op)
          }
        } catch (e) {
          if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
          return -e.errno
        }
      }

      function ___syscall6(which, varargs) {
        SYSCALLS.varargs = varargs;
        try {
          var stream = SYSCALLS.getStreamFromFD();
          FS.close(stream);
          return 0
        } catch (e) {
          if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
          return -e.errno
        }
      }

      function ___unlock() { }

      function _abort() {
        Module["abort"]()
      }

      function _atexit(func, arg) {
        __ATEXIT__.unshift({
          func: func,
          arg: arg
        })
      }

      function _emscripten_exit_with_live_runtime() {
        Module["noExitRuntime"] = true;
        throw "SimulateInfiniteLoop"
      }

      function _emscripten_get_heap_size() {
        return HEAP8.length
      }

      function abortOnCannotGrowMemory(requestedSize) {
        abort("OOM")
      }

      function emscripten_realloc_buffer(size) {
        var PAGE_MULTIPLE = 65536;
        size = alignUp(size, PAGE_MULTIPLE);
        var oldSize = buffer.byteLength;
        try {
          var result = wasmMemory.grow((size - oldSize) / 65536);
          if (result !== (-1 | 0)) {
            return buffer = wasmMemory.buffer
          } else {
            return null
          }
        } catch (e) {
          return null
        }
      }

      function _emscripten_resize_heap(requestedSize) {
        var oldSize = _emscripten_get_heap_size();
        var PAGE_MULTIPLE = 65536;
        var LIMIT = 2147483648 - PAGE_MULTIPLE;
        if (requestedSize > LIMIT) {
          return false
        }
        var MIN_TOTAL_MEMORY = 16777216;
        var newSize = Math.max(oldSize, MIN_TOTAL_MEMORY);
        while (newSize < requestedSize) {
          if (newSize <= 536870912) {
            newSize = alignUp(2 * newSize, PAGE_MULTIPLE)
          } else {
            newSize = Math.min(alignUp((3 * newSize + 2147483648) / 4, PAGE_MULTIPLE), LIMIT)
          }
        }
        var replacement = emscripten_realloc_buffer(newSize);
        if (!replacement || replacement.byteLength != newSize) {
          return false
        }
        updateGlobalBufferViews();
        return true
      }

      function _exit(status) {
        exit(status)
      }

      function _getenv(name) {
        if (name === 0) return 0;
        name = UTF8ToString(name);
        if (!ENV.hasOwnProperty(name)) return 0;
        if (_getenv.ret) _free(_getenv.ret);
        _getenv.ret = allocateUTF8(ENV[name]);
        return _getenv.ret
      }

      function _llvm_trap() {
        abort("trap!")
      }
      var ___tm_current = 338256;
      var ___tm_timezone = (stringToUTF8("GMT", 338304, 4), 338304);

      function _tzset() {
        if (_tzset.called) return;
        _tzset.called = true;
        HEAP32[__get_timezone() >> 2] = (new Date)
          .getTimezoneOffset() * 60;
        var winter = new Date(2e3, 0, 1);
        var summer = new Date(2e3, 6, 1);
        HEAP32[__get_daylight() >> 2] = Number(winter.getTimezoneOffset() != summer.getTimezoneOffset());

        function extractZone(date) {
          var match = date.toTimeString()
            .match(/\(([A-Za-z ]+)\)$/);
          return match ? match[1] : "GMT"
        }
        var winterName = extractZone(winter);
        var summerName = extractZone(summer);
        var winterNamePtr = allocate(intArrayFromString(winterName), "i8", ALLOC_NORMAL);
        var summerNamePtr = allocate(intArrayFromString(summerName), "i8", ALLOC_NORMAL);
        if (summer.getTimezoneOffset() < winter.getTimezoneOffset()) {
          HEAP32[__get_tzname() >> 2] = winterNamePtr;
          HEAP32[__get_tzname() + 4 >> 2] = summerNamePtr
        } else {
          HEAP32[__get_tzname() >> 2] = summerNamePtr;
          HEAP32[__get_tzname() + 4 >> 2] = winterNamePtr
        }
      }

      function _localtime_r(time, tmPtr) {
        _tzset();
        var date = new Date(HEAP32[time >> 2] * 1e3);
        HEAP32[tmPtr >> 2] = date.getSeconds();
        HEAP32[tmPtr + 4 >> 2] = date.getMinutes();
        HEAP32[tmPtr + 8 >> 2] = date.getHours();
        HEAP32[tmPtr + 12 >> 2] = date.getDate();
        HEAP32[tmPtr + 16 >> 2] = date.getMonth();
        HEAP32[tmPtr + 20 >> 2] = date.getFullYear() - 1900;
        HEAP32[tmPtr + 24 >> 2] = date.getDay();
        var start = new Date(date.getFullYear(), 0, 1);
        var yday = (date.getTime() - start.getTime()) / (1e3 * 60 * 60 * 24) | 0;
        HEAP32[tmPtr + 28 >> 2] = yday;
        HEAP32[tmPtr + 36 >> 2] = -(date.getTimezoneOffset() * 60);
        var summerOffset = new Date(2e3, 6, 1)
          .getTimezoneOffset();
        var winterOffset = start.getTimezoneOffset();
        var dst = (summerOffset != winterOffset && date.getTimezoneOffset() == Math.min(winterOffset, summerOffset)) | 0;
        HEAP32[tmPtr + 32 >> 2] = dst;
        var zonePtr = HEAP32[__get_tzname() + (dst ? 4 : 0) >> 2];
        HEAP32[tmPtr + 40 >> 2] = zonePtr;
        return tmPtr
      }

      function _localtime(time) {
        return _localtime_r(time, ___tm_current)
      }

      function _emscripten_memcpy_big(dest, src, num) {
        HEAPU8.set(HEAPU8.subarray(src, src + num), dest)
      }

      function _time(ptr) {
        var ret = Date.now() / 1e3 | 0;
        if (ptr) {
          HEAP32[ptr >> 2] = ret
        }
        return ret
      }
      FS.staticInit();
      Module["FS_createFolder"] = FS.createFolder;
      Module["FS_createPath"] = FS.createPath;
      Module["FS_createDataFile"] = FS.createDataFile;
      Module["FS_createPreloadedFile"] = FS.createPreloadedFile;
      Module["FS_createLazyFile"] = FS.createLazyFile;
      Module["FS_createLink"] = FS.createLink;
      Module["FS_createDevice"] = FS.createDevice;
      Module["FS_unlink"] = FS.unlink;
      if (ENVIRONMENT_IS_NODE) {
        var fs = require("fs");
        var NODEJS_PATH = require("path");
        NODEFS.staticInit()
      }
      Module["requestFullScreen"] = function Module_requestFullScreen(lockPointer, resizeCanvas, vrDevice) {
        err("Module.requestFullScreen is deprecated. Please call Module.requestFullscreen instead.");
        Module["requestFullScreen"] = Module["requestFullscreen"];
        Browser.requestFullScreen(lockPointer, resizeCanvas, vrDevice)
      };
      Module["requestFullscreen"] = function Module_requestFullscreen(lockPointer, resizeCanvas, vrDevice) {
        Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice)
      };
      Module["requestAnimationFrame"] = function Module_requestAnimationFrame(func) {
        Browser.requestAnimationFrame(func)
      };
      Module["setCanvasSize"] = function Module_setCanvasSize(width, height, noUpdates) {
        Browser.setCanvasSize(width, height, noUpdates)
      };
      Module["pauseMainLoop"] = function Module_pauseMainLoop() {
        Browser.mainLoop.pause()
      };
      Module["resumeMainLoop"] = function Module_resumeMainLoop() {
        Browser.mainLoop.resume()
      };
      Module["getUserMedia"] = function Module_getUserMedia() {
        Browser.getUserMedia()
      };
      Module["createContext"] = function Module_createContext(canvas, useWebGL, setInModule, webGLContextAttributes) {
        return Browser.createContext(canvas, useWebGL, setInModule, webGLContextAttributes)
      };
      if (ENVIRONMENT_IS_NODE) {
        _emscripten_get_now = function _emscripten_get_now_actual() {
          var t = process["hrtime"]();
          return t[0] * 1e3 + t[1] / 1e6
        }
      } else if (typeof dateNow !== "undefined") {
        _emscripten_get_now = dateNow
      } else if (typeof performance === "object" && performance && typeof performance["now"] === "function") {
        _emscripten_get_now = function () {
          return performance["now"]()
        }
      } else {
        _emscripten_get_now = Date.now
      }
      var GLctx;
      GL.init();

      function intArrayFromString(stringy, dontAddNull, length) {
        var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
        var u8array = new Array(len);
        var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
        if (dontAddNull) u8array.length = numBytesWritten;
        return u8array
      }
      var asmGlobalArg = {};
      var asmLibraryArg = {
        "c": abort,
        "P": _SDL_Flip,
        "p": _SDL_GetError,
        "F": _SDL_Init,
        "x": _SDL_InitSubSystem,
        "j": _SDL_LockAudio,
        "v": _SDL_LockSurface,
        "u": _SDL_OpenAudio,
        "t": _SDL_PauseAudio,
        "i": _SDL_PollEvent,
        "s": _SDL_Quit,
        "O": _SDL_SetVideoMode,
        "r": _SDL_UnlockAudio,
        "N": _SDL_UnlockSurface,
        "b": ___assert_fail,
        "M": ___buildEnvironment,
        "L": ___cxa_pure_virtual,
        "K": ___lock,
        "q": ___setErrNo,
        "J": ___syscall140,
        "I": ___syscall145,
        "o": ___syscall146,
        "f": ___syscall221,
        "H": ___syscall5,
        "n": ___syscall54,
        "m": ___syscall6,
        "h": ___unlock,
        "g": _abort,
        "G": _atexit,
        "l": _emscripten_asm_const_i,
        "E": _emscripten_exit_with_live_runtime,
        "D": _emscripten_get_heap_size,
        "C": _emscripten_memcpy_big,
        "B": _emscripten_resize_heap,
        "A": _emscripten_set_main_loop,
        "e": _exit,
        "k": _getenv,
        "z": _llvm_trap,
        "y": _localtime,
        "d": _time,
        "w": abortOnCannotGrowMemory,
        "a": DYNAMICTOP_PTR
      };
      var asm = Module["asm"](asmGlobalArg, asmLibraryArg, buffer);
      Module["asm"] = asm;
      var _S9xAutoSaveSRAM = Module["_S9xAutoSaveSRAM"] = function () {
        return Module["asm"]["Q"].apply(null, arguments)
      };
      var _S9xInitInputDevices = Module["_S9xInitInputDevices"] = function () {
        return Module["asm"]["R"].apply(null, arguments)
      };
      var ___errno_location = Module["___errno_location"] = function () {
        return Module["asm"]["S"].apply(null, arguments)
      };
      var __get_daylight = Module["__get_daylight"] = function () {
        return Module["asm"]["T"].apply(null, arguments)
      };
      var __get_timezone = Module["__get_timezone"] = function () {
        return Module["asm"]["U"].apply(null, arguments)
      };
      var __get_tzname = Module["__get_tzname"] = function () {
        return Module["asm"]["V"].apply(null, arguments)
      };
      var _free = Module["_free"] = function () {
        return Module["asm"]["W"].apply(null, arguments)
      };
      var _main = Module["_main"] = function () {
        return Module["asm"]["X"].apply(null, arguments)
      };
      var _malloc = Module["_malloc"] = function () {
        return Module["asm"]["Y"].apply(null, arguments)
      };
      var _memcpy = Module["_memcpy"] = function () {
        return Module["asm"]["Z"].apply(null, arguments)
      };
      var _memset = Module["_memset"] = function () {
        return Module["asm"]["_"].apply(null, arguments)
      };
      var _run = Module["_run"] = function () {
        return Module["asm"]["$"].apply(null, arguments)
      };
      var _set_frameskip = Module["_set_frameskip"] = function () {
        return Module["asm"]["aa"].apply(null, arguments)
      };
      var _set_transparency = Module["_set_transparency"] = function () {
        return Module["asm"]["ba"].apply(null, arguments)
      };
      var _toggle_display_framerate = Module["_toggle_display_framerate"] = function () {
        return Module["asm"]["ca"].apply(null, arguments)
      };
      var globalCtors = Module["globalCtors"] = function () {
        return Module["asm"]["ga"].apply(null, arguments)
      };
      var stackAlloc = Module["stackAlloc"] = function () {
        return Module["asm"]["ha"].apply(null, arguments)
      };
      var stackRestore = Module["stackRestore"] = function () {
        return Module["asm"]["ia"].apply(null, arguments)
      };
      var stackSave = Module["stackSave"] = function () {
        return Module["asm"]["ja"].apply(null, arguments)
      };
      var dynCall_v = Module["dynCall_v"] = function () {
        return Module["asm"]["da"].apply(null, arguments)
      };
      var dynCall_vi = Module["dynCall_vi"] = function () {
        return Module["asm"]["ea"].apply(null, arguments)
      };
      var dynCall_viii = Module["dynCall_viii"] = function () {
        return Module["asm"]["fa"].apply(null, arguments)
      };
      Module["asm"] = asm;
      Module["ccall"] = ccall;
      Module["cwrap"] = cwrap;
      Module["getMemory"] = getMemory;
      Module["addRunDependency"] = addRunDependency;
      Module["removeRunDependency"] = removeRunDependency;
      Module["FS_createFolder"] = FS.createFolder;
      Module["FS_createPath"] = FS.createPath;
      Module["FS_createDataFile"] = FS.createDataFile;
      Module["FS_createPreloadedFile"] = FS.createPreloadedFile;
      Module["FS_createLazyFile"] = FS.createLazyFile;
      Module["FS_createLink"] = FS.createLink;
      Module["FS_createDevice"] = FS.createDevice;
      Module["FS_unlink"] = FS.unlink;
      Module["then"] = function (func) {
        if (Module["calledRun"]) {
          func(Module)
        } else {
          var old = Module["onRuntimeInitialized"];
          Module["onRuntimeInitialized"] = function () {
            if (old) old();
            func(Module)
          }
        }
        return Module
      };

      function ExitStatus(status) {
        this.name = "ExitStatus";
        this.message = "Program terminated with exit(" + status + ")";
        this.status = status
      }
      ExitStatus.prototype = new Error;
      ExitStatus.prototype.constructor = ExitStatus;
      var calledMain = false;
      dependenciesFulfilled = function runCaller() {
        if (!Module["calledRun"]) run();
        if (!Module["calledRun"]) dependenciesFulfilled = runCaller
      };
      Module["callMain"] = function callMain(args) {
        args = args || [];
        ensureInitRuntime();
        var argc = args.length + 1;
        var argv = stackAlloc((argc + 1) * 4);
        HEAP32[argv >> 2] = allocateUTF8OnStack(Module["thisProgram"]);
        for (var i = 1; i < argc; i++) {
          HEAP32[(argv >> 2) + i] = allocateUTF8OnStack(args[i - 1])
        }
        HEAP32[(argv >> 2) + argc] = 0;
        try {
          var ret = Module["_main"](argc, argv, 0);
          exit(ret, true)
        } catch (e) {
          if (e instanceof ExitStatus) {
            return
          } else if (e == "SimulateInfiniteLoop") {
            Module["noExitRuntime"] = true;
            return
          } else {
            var toLog = e;
            if (e && typeof e === "object" && e.stack) {
              toLog = [e, e.stack]
            }
            err("exception thrown: " + toLog);
            Module["quit"](1, e)
          }
        } finally {
          calledMain = true
        }
      };

      function run(args?) {
        args = args || Module["arguments"];
        if (runDependencies > 0) {
          return
        }
        preRun();
        if (runDependencies > 0) return;
        if (Module["calledRun"]) return;

        function doRun() {
          if (Module["calledRun"]) return;
          Module["calledRun"] = true;
          if (ABORT) return;
          ensureInitRuntime();
          preMain();
          if (Module["onRuntimeInitialized"]) Module["onRuntimeInitialized"]();
          if (Module["_main"] && shouldRunNow) Module["callMain"](args);
          postRun()
        }
        if (Module["setStatus"]) {
          Module["setStatus"]("Running...");
          setTimeout(function () {
            setTimeout(function () {
              Module["setStatus"]("")
            }, 1);
            doRun()
          }, 1)
        } else {
          doRun()
        }
      }
      Module["run"] = run;

      function exit(status, implicit) {
        if (implicit && Module["noExitRuntime"] && status === 0) {
          return
        }
        if (Module["noExitRuntime"]) { } else {
          ABORT = true;
          EXITSTATUS = status;
          exitRuntime();
          if (Module["onExit"]) Module["onExit"](status)
        }
        Module["quit"](status, new ExitStatus(status))
      }

      function abort(what) {
        if (Module["onAbort"]) {
          Module["onAbort"](what)
        }
        if (what !== undefined) {
          out(what);
          err(what);
          what = JSON.stringify(what)
        } else {
          what = ""
        }
        ABORT = true;
        EXITSTATUS = 1;
        throw "abort(" + what + "). Build with -s ASSERTIONS=1 for more info."
      }
      Module["abort"] = abort;
      if (Module["preInit"]) {
        if (typeof Module["preInit"] == "function") Module["preInit"] = [Module["preInit"]];
        while (Module["preInit"].length > 0) {
          Module["preInit"].pop()()
        }
      }
      var shouldRunNow = true;
      if (Module["noInitialRun"]) {
        shouldRunNow = false
      }
      Module["noExitRuntime"] = true;
      run();
      return Module
    }
  );
})();
export default Module;