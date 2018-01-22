(function () {



    /*!
  SerializeJSON jQuery plugin.
  https://github.com/marioizquierdo/jquery.serializeJSON
  version 2.8.1 (Dec, 2016)

  Copyright (c) 2012, 2017 Mario Izquierdo
  Dual licensed under the MIT (http://www.opensource.org/licenses/mit-license.php)
  and GPL (http://www.opensource.org/licenses/gpl-license.php) licenses.
*/
    (function (factory) {
        if (typeof define === 'function' && define.amd) { // AMD. Register as an anonymous module.
            define(['jquery'], factory);
        } else if (typeof exports === 'object') { // Node/CommonJS
            var jQuery = require('jquery');
            module.exports = factory(jQuery);
        } else { // Browser globals (zepto supported)
            factory(window.jQuery || window.Zepto || window.$); // Zepto supported on browsers as well
        }

    }(function ($) {
        "use strict";

        // jQuery('form').serializeJSON()
        $.fn.serializeJSON = function (options) {
            var f, $form, opts, formAsArray, serializedObject, name, value, parsedValue, _obj, nameWithNoType, type,
                keys, skipFalsy;
            f = $.serializeJSON;
            $form = this; // NOTE: the set of matched elements is most likely a form, but it could also be a group of inputs
            opts = f.setupOpts(options); // calculate values for options {parseNumbers, parseBoolens, parseNulls, ...} with defaults

            // Use native `serializeArray` function to get an array of {name, value} objects.
            formAsArray = $form.serializeArray();
            f.readCheckboxUncheckedValues(formAsArray, opts, $form); // add objects to the array from unchecked checkboxes if needed

            // Convert the formAsArray into a serializedObject with nested keys
            serializedObject = {};
            $.each(formAsArray, function (i, obj) {
                name = obj.name; // original input name
                value = obj.value; // input value
                _obj = f.extractTypeAndNameWithNoType(name);
                nameWithNoType = _obj.nameWithNoType; // input name with no type (i.e. "foo:string" => "foo")
                type = _obj.type; // type defined from the input name in :type colon notation
                if (!type) type = f.attrFromInputWithName($form, name, 'data-value-type');
                f.validateType(name, type, opts); // make sure that the type is one of the valid types if defined

                if (type !== 'skip') { // ignore inputs with type 'skip'
                    keys = f.splitInputNameIntoKeysArray(nameWithNoType);
                    parsedValue = f.parseValue(value, name, type, opts); // convert to string, number, boolean, null or customType

                    skipFalsy = !parsedValue && f.shouldSkipFalsy($form, name, nameWithNoType, type, opts); // ignore falsy inputs if specified
                    if (!skipFalsy) {
                        f.deepSet(serializedObject, keys, parsedValue, opts);
                    }
                }
            });
            return serializedObject;
        };

        // Use $.serializeJSON as namespace for the auxiliar functions
        // and to define defaults
        $.serializeJSON = {

            defaultOptions: {
                checkboxUncheckedValue: undefined, // to include that value for unchecked checkboxes (instead of ignoring them)

                parseNumbers: false, // convert values like "1", "-2.33" to 1, -2.33
                parseBooleans: false, // convert "true", "false" to true, false
                parseNulls: false, // convert "null" to null
                parseAll: false, // all of the above
                parseWithFunction: null, // to use custom parser, a function like: function(val){ return parsed_val; }

                skipFalsyValuesForTypes: [], // skip serialization of falsy values for listed value types
                skipFalsyValuesForFields: [], // skip serialization of falsy values for listed field names

                customTypes: {}, // override defaultTypes
                defaultTypes: {
                    "string": function (str) {
                        return String(str);
                    },
                    "number": function (str) {
                        return Number(str);
                    },
                    "boolean": function (str) {
                        var falses = ["false", "null", "undefined", "", "0"];
                        return falses.indexOf(str) === -1;
                    },
                    "null": function (str) {
                        var falses = ["false", "null", "undefined", "", "0"];
                        return falses.indexOf(str) === -1 ? str : null;
                    },
                    "array": function (str) {
                        return JSON.parse(str);
                    },
                    "object": function (str) {
                        return JSON.parse(str);
                    },
                    "auto": function (str) {
                        return $.serializeJSON.parseValue(str, null, null, {
                            parseNumbers: true,
                            parseBooleans: true,
                            parseNulls: true
                        });
                    }, // try again with something like "parseAll"
                    "skip": null // skip is a special type that makes it easy to ignore elements
                },

                useIntKeysAsArrayIndex: false // name="foo[2]" value="v" => {foo: [null, null, "v"]}, instead of {foo: ["2": "v"]}
            },

            // Merge option defaults into the options
            setupOpts: function (options) {
                var opt, validOpts, defaultOptions, optWithDefault, parseAll, f;
                f = $.serializeJSON;

                if (options == null) {
                    options = {};
                }   // options ||= {}
                defaultOptions = f.defaultOptions || {}; // defaultOptions

                // Make sure that the user didn't misspell an option
                validOpts = ['checkboxUncheckedValue', 'parseNumbers', 'parseBooleans', 'parseNulls', 'parseAll', 'parseWithFunction', 'skipFalsyValuesForTypes', 'skipFalsyValuesForFields', 'customTypes', 'defaultTypes', 'useIntKeysAsArrayIndex']; // re-define because the user may override the defaultOptions
                for (opt in options) {
                    if (validOpts.indexOf(opt) === -1) {
                        throw new Error("serializeJSON ERROR: invalid option '" + opt + "'. Please use one of " + validOpts.join(', '));
                    }
                }

                // Helper to get the default value for this option if none is specified by the user
                optWithDefault = function (key) {
                    return (options[key] !== false) && (options[key] !== '') && (options[key] || defaultOptions[key]);
                };

                // Return computed options (opts to be used in the rest of the script)
                parseAll = optWithDefault('parseAll');
                return {
                    checkboxUncheckedValue: optWithDefault('checkboxUncheckedValue'),

                    parseNumbers: parseAll || optWithDefault('parseNumbers'),
                    parseBooleans: parseAll || optWithDefault('parseBooleans'),
                    parseNulls: parseAll || optWithDefault('parseNulls'),
                    parseWithFunction: optWithDefault('parseWithFunction'),

                    skipFalsyValuesForTypes: optWithDefault('skipFalsyValuesForTypes'),
                    skipFalsyValuesForFields: optWithDefault('skipFalsyValuesForFields'),
                    typeFunctions: $.extend({}, optWithDefault('defaultTypes'), optWithDefault('customTypes')),

                    useIntKeysAsArrayIndex: optWithDefault('useIntKeysAsArrayIndex')
                };
            },

            // Given a string, apply the type or the relevant "parse" options, to return the parsed value
            parseValue: function (valStr, inputName, type, opts) {
                var f, parsedVal;
                f = $.serializeJSON;
                parsedVal = valStr; // if no parsing is needed, the returned value will be the same

                if (opts.typeFunctions && type && opts.typeFunctions[type]) { // use a type if available
                    parsedVal = opts.typeFunctions[type](valStr);
                } else if (opts.parseNumbers && f.isNumeric(valStr)) { // auto: number
                    parsedVal = Number(valStr);
                } else if (opts.parseBooleans && (valStr === "true" || valStr === "false")) { // auto: boolean
                    parsedVal = (valStr === "true");
                } else if (opts.parseNulls && valStr == "null") { // auto: null
                    parsedVal = null;
                }
                if (opts.parseWithFunction && !type) { // custom parse function (apply after previous parsing options, but not if there's a specific type)
                    parsedVal = opts.parseWithFunction(parsedVal, inputName);
                }

                return parsedVal;
            },

            isObject: function (obj) {
                return obj === Object(obj);
            }, // is it an Object?
            isUndefined: function (obj) {
                return obj === void 0;
            }, // safe check for undefined values
            isValidArrayIndex: function (val) {
                return /^[0-9]+$/.test(String(val));
            }, // 1,2,3,4 ... are valid array indexes
            isNumeric: function (obj) {
                return obj - parseFloat(obj) >= 0;
            }, // taken from jQuery.isNumeric implementation. Not using jQuery.isNumeric to support old jQuery and Zepto versions

            optionKeys: function (obj) {
                if (Object.keys) {
                    return Object.keys(obj);
                } else {
                    var key, keys = [];
                    for (key in obj) {
                        keys.push(key);
                    }
                    return keys;
                }
            }, // polyfill Object.keys to get option keys in IE<9


            // Fill the formAsArray object with values for the unchecked checkbox inputs,
            // using the same format as the jquery.serializeArray function.
            // The value of the unchecked values is determined from the opts.checkboxUncheckedValue
            // and/or the data-unchecked-value attribute of the inputs.
            readCheckboxUncheckedValues: function (formAsArray, opts, $form) {
                var selector, $uncheckedCheckboxes, $el, uncheckedValue, f, name;
                if (opts == null) {
                    opts = {};
                }
                f = $.serializeJSON;

                selector = 'input[type=checkbox][name]:not(:checked):not([disabled])';
                $uncheckedCheckboxes = $form.find(selector).add($form.filter(selector));
                $uncheckedCheckboxes.each(function (i, el) {
                    // Check data attr first, then the option
                    $el = $(el);
                    uncheckedValue = $el.attr('data-unchecked-value');
                    if (uncheckedValue == null) {
                        uncheckedValue = opts.checkboxUncheckedValue;
                    }

                    // If there's an uncheckedValue, push it into the serialized formAsArray
                    if (uncheckedValue != null) {
                        if (el.name && el.name.indexOf("[][") !== -1) { // identify a non-supported
                            throw new Error("serializeJSON ERROR: checkbox unchecked values are not supported on nested arrays of objects like '" + el.name + "'. See https://github.com/marioizquierdo/jquery.serializeJSON/issues/67");
                        }
                        formAsArray.push({name: el.name, value: uncheckedValue});
                    }
                });
            },

            // Returns and object with properties {name_without_type, type} from a given name.
            // The type is null if none specified. Example:
            //   "foo"           =>  {nameWithNoType: "foo",      type:  null}
            //   "foo:boolean"   =>  {nameWithNoType: "foo",      type: "boolean"}
            //   "foo[bar]:null" =>  {nameWithNoType: "foo[bar]", type: "null"}
            extractTypeAndNameWithNoType: function (name) {
                var match;
                if (match = name.match(/(.*):([^:]+)$/)) {
                    return {nameWithNoType: match[1], type: match[2]};
                } else {
                    return {nameWithNoType: name, type: null};
                }
            },


            // Check if this input should be skipped when it has a falsy value,
            // depending on the options to skip values by name or type, and the data-skip-falsy attribute.
            shouldSkipFalsy: function ($form, name, nameWithNoType, type, opts) {
                var f = $.serializeJSON;

                var skipFromDataAttr = f.attrFromInputWithName($form, name, 'data-skip-falsy');
                if (skipFromDataAttr != null) {
                    return skipFromDataAttr !== 'false'; // any value is true, except if explicitly using 'false'
                }

                var optForFields = opts.skipFalsyValuesForFields;
                if (optForFields && (optForFields.indexOf(nameWithNoType) !== -1 || optForFields.indexOf(name) !== -1)) {
                    return true;
                }

                var optForTypes = opts.skipFalsyValuesForTypes;
                if (type == null) type = 'string'; // assume fields with no type are targeted as string
                if (optForTypes && optForTypes.indexOf(type) !== -1) {
                    return true
                }

                return false;
            },

            // Finds the first input in $form with this name, and get the given attr from it.
            // Returns undefined if no input or no attribute was found.
            attrFromInputWithName: function ($form, name, attrName) {
                var escapedName, selector, $input, attrValue;
                escapedName = name.replace(/(:|\.|\[|\]|\s)/g, '\\$1'); // every non-standard character need to be escaped by \\
                selector = '[name="' + escapedName + '"]';
                $input = $form.find(selector).add($form.filter(selector)); // NOTE: this returns only the first $input element if multiple are matched with the same name (i.e. an "array[]"). So, arrays with different element types specified through the data-value-type attr is not supported.
                return $input.attr(attrName);
            },

            // Raise an error if the type is not recognized.
            validateType: function (name, type, opts) {
                var validTypes, f;
                f = $.serializeJSON;
                validTypes = f.optionKeys(opts ? opts.typeFunctions : f.defaultOptions.defaultTypes);
                if (!type || validTypes.indexOf(type) !== -1) {
                    return true;
                } else {
                    throw new Error("serializeJSON ERROR: Invalid type " + type + " found in input name '" + name + "', please use one of " + validTypes.join(', '));
                }
            },


            // Split the input name in programatically readable keys.
            // Examples:
            // "foo"              => ['foo']
            // "[foo]"            => ['foo']
            // "foo[inn][bar]"    => ['foo', 'inn', 'bar']
            // "foo[inn[bar]]"    => ['foo', 'inn', 'bar']
            // "foo[inn][arr][0]" => ['foo', 'inn', 'arr', '0']
            // "arr[][val]"       => ['arr', '', 'val']
            splitInputNameIntoKeysArray: function (nameWithNoType) {
                var keys, f;
                f = $.serializeJSON;
                keys = nameWithNoType.split('['); // split string into array
                keys = $.map(keys, function (key) {
                    return key.replace(/\]/g, '');
                }); // remove closing brackets
                if (keys[0] === '') {
                    keys.shift();
                } // ensure no opening bracket ("[foo][inn]" should be same as "foo[inn]")
                return keys;
            },

            // Set a value in an object or array, using multiple keys to set in a nested object or array:
            //
            // deepSet(obj, ['foo'], v)               // obj['foo'] = v
            // deepSet(obj, ['foo', 'inn'], v)        // obj['foo']['inn'] = v // Create the inner obj['foo'] object, if needed
            // deepSet(obj, ['foo', 'inn', '123'], v) // obj['foo']['arr']['123'] = v //
            //
            // deepSet(obj, ['0'], v)                                   // obj['0'] = v
            // deepSet(arr, ['0'], v, {useIntKeysAsArrayIndex: true})   // arr[0] = v
            // deepSet(arr, [''], v)                                    // arr.push(v)
            // deepSet(obj, ['arr', ''], v)                             // obj['arr'].push(v)
            //
            // arr = [];
            // deepSet(arr, ['', v]          // arr => [v]
            // deepSet(arr, ['', 'foo'], v)  // arr => [v, {foo: v}]
            // deepSet(arr, ['', 'bar'], v)  // arr => [v, {foo: v, bar: v}]
            // deepSet(arr, ['', 'bar'], v)  // arr => [v, {foo: v, bar: v}, {bar: v}]
            //
            deepSet: function (o, keys, value, opts) {
                var key, nextKey, tail, lastIdx, lastVal, f;
                if (opts == null) {
                    opts = {};
                }
                f = $.serializeJSON;
                if (f.isUndefined(o)) {
                    throw new Error("ArgumentError: param 'o' expected to be an object or array, found undefined");
                }
                if (!keys || keys.length === 0) {
                    throw new Error("ArgumentError: param 'keys' expected to be an array with least one element");
                }

                key = keys[0];

                // Only one key, then it's not a deepSet, just assign the value.
                if (keys.length === 1) {
                    if (key === '') {
                        o.push(value); // '' is used to push values into the array (assume o is an array)
                    } else {
                        o[key] = value; // other keys can be used as object keys or array indexes
                    }

                    // With more keys is a deepSet. Apply recursively.
                } else {
                    nextKey = keys[1];

                    // '' is used to push values into the array,
                    // with nextKey, set the value into the same object, in object[nextKey].
                    // Covers the case of ['', 'foo'] and ['', 'var'] to push the object {foo, var}, and the case of nested arrays.
                    if (key === '') {
                        lastIdx = o.length - 1; // asume o is array
                        lastVal = o[lastIdx];
                        if (f.isObject(lastVal) && (f.isUndefined(lastVal[nextKey]) || keys.length > 2)) { // if nextKey is not present in the last object element, or there are more keys to deep set
                            key = lastIdx; // then set the new value in the same object element
                        } else {
                            key = lastIdx + 1; // otherwise, point to set the next index in the array
                        }
                    }

                    // '' is used to push values into the array "array[]"
                    if (nextKey === '') {
                        if (f.isUndefined(o[key]) || !$.isArray(o[key])) {
                            o[key] = []; // define (or override) as array to push values
                        }
                    } else {
                        if (opts.useIntKeysAsArrayIndex && f.isValidArrayIndex(nextKey)) { // if 1, 2, 3 ... then use an array, where nextKey is the index
                            if (f.isUndefined(o[key]) || !$.isArray(o[key])) {
                                o[key] = []; // define (or override) as array, to insert values using int keys as array indexes
                            }
                        } else { // for anything else, use an object, where nextKey is going to be the attribute name
                            if (f.isUndefined(o[key]) || !f.isObject(o[key])) {
                                o[key] = {}; // define (or override) as object, to set nested properties
                            }
                        }
                    }

                    // Recursively set the inner object
                    tail = keys.slice(1);
                    f.deepSet(o[key], tail, value, opts);
                }
            }

        };

    }));


    /**
     * Basically, bionic let you call js functions using only html code.
     * The promise behind this idea is that templates don't need to know javascript
     * to call your apis/js functions.
     */

    window.bionicHooks = {}; // hookName => callback
    window.bionicActionHandler = function () {  // override this function to get started
    };


    //----------------------------------------
    // UTILS
    //----------------------------------------
    // http://locutus.io/php/strings/parse_str/
    function parse_str(str, array) {
        var strArr = String(str).replace(/^&/, '').replace(/&$/, '').split('&')
        var sal = strArr.length
        var i
        var j
        var ct
        var p
        var lastObj
        var obj
        var undef
        var chr
        var tmp
        var key
        var value
        var postLeftBracketPos
        var keys
        var keysLen
        var _fixStr = function (str) {
            return decodeURIComponent(str.replace(/\+/g, '%20'))
        }
        var $global = (typeof window !== 'undefined' ? window : global)
        $global.$locutus = $global.$locutus || {}
        var $locutus = $global.$locutus
        $locutus.php = $locutus.php || {}
        if (!array) {
            array = $global
        }
        for (i = 0; i < sal; i++) {
            tmp = strArr[i].split('=')
            key = _fixStr(tmp[0])
            value = (tmp.length < 2) ? '' : _fixStr(tmp[1])
            while (key.charAt(0) === ' ') {
                key = key.slice(1)
            }
            if (key.indexOf('\x00') > -1) {
                key = key.slice(0, key.indexOf('\x00'))
            }
            if (key && key.charAt(0) !== '[') {
                keys = []
                postLeftBracketPos = 0
                for (j = 0; j < key.length; j++) {
                    if (key.charAt(j) === '[' && !postLeftBracketPos) {
                        postLeftBracketPos = j + 1
                    } else if (key.charAt(j) === ']') {
                        if (postLeftBracketPos) {
                            if (!keys.length) {
                                keys.push(key.slice(0, postLeftBracketPos - 1))
                            }
                            keys.push(key.substr(postLeftBracketPos, j - postLeftBracketPos))
                            postLeftBracketPos = 0
                            if (key.charAt(j + 1) !== '[') {
                                break
                            }
                        }
                    }
                }
                if (!keys.length) {
                    keys = [key]
                }
                for (j = 0; j < keys[0].length; j++) {
                    chr = keys[0].charAt(j)
                    if (chr === ' ' || chr === '.' || chr === '[') {
                        keys[0] = keys[0].substr(0, j) + '_' + keys[0].substr(j + 1)
                    }
                    if (chr === '[') {
                        break
                    }
                }
                obj = array
                for (j = 0, keysLen = keys.length; j < keysLen; j++) {
                    key = keys[j].replace(/^['"]/, '').replace(/['"]$/, '')
                    lastObj = obj
                    if ((key !== '' && key !== ' ') || j === 0) {
                        if (obj[key] === undef) {
                            obj[key] = {}
                        }
                        obj = obj[key]
                    } else {
                        // To insert new dimension
                        ct = -1
                        for (p in obj) {
                            if (obj.hasOwnProperty(p)) {
                                if (+p > ct && p.match(/^\d+$/g)) {
                                    ct = +p
                                }
                            }
                        }
                        key = ct + 1
                    }
                }
                lastObj[key] = value
            }
        }
    }


    function getUriParams() {

        // that's my wrapper
        var queryString = window.location.search;
        if ('' !== queryString) {
            queryString = queryString.substr(1);
        }
        var arr = {};
        parse_str(queryString, arr);
        return arr;
    }


    //----------------------------------------
    // BIONIC CODE
    //----------------------------------------
    // https://stackoverflow.com/questions/1184624/convert-form-data-to-javascript-object-with-jquery
    /**
     * Note: there is a bug with this function:
     * a param starting with the underscore will not be collected (like _step for instance)
     */

    var handleInteractionReturn = null;
    var confirmInteractionMsg = null;
    var downloadAjaxPdf = false;
    var willReload = false;

    /**
     * global utility than one can use.
     * Example of use:
     *
     * In the file where you override "window.bionicActionHandler",
     * do the following:
     *
     * var api = ekomApi.inst(); // ekom is an application module's api...
     *
     * window.ekomRequestOnSuccessAfter = function () { //...and we can hook here to all ekom ajax request's onSuccess action
     *    window.bionicOnActionAfter();
     * };
     *
     *
     */
    window.bionicOnActionAfter = function () {
        if (true === willReload) {
            willReload = false;
            window.location.reload();
        }
    };

    function devError(msg) {
        console.log("bionic error: " + msg);
    }

    function take(paramName, params, defaultValue) {
        if (paramName in params) {
            return params[paramName];
        }
        if ('undefined' !== typeof defaultValue) {
            return defaultValue;
        }
        throw new Error(paramName + " wasn't found in the params array");
    }

    function getHook(hookName) {
        if (hookName in window.bionicHooks) {
            return window.bionicHooks[hookName];
        }
        throw new Error("HookName " + hookName + " was called but not found");
    }

    function handleAction(jObj, callable) {

        var type = jObj.attr('data-type');
        if (!type) {
            type = 'epc';
        }
        if ('epc' === type) {
            var data = collectDataAttr(jObj);
            if ('action' in data) {
                var action = data.action;

                //----------------------------------------
                // handling special actions
                //----------------------------------------
                if ("!" === action.substr(0, 1)) {
                    action = action.substr(1);

                    if ("post" === action) {
                        var jForm = jObj.closest('form');
                        if (jForm.length) {
                            var currentParams = getUriParams();
                            var method = jForm.attr('method');
                            if ('undefined' === typeof method) {
                                method = 'get';
                            }
                            method = method.toLowerCase();

                            if ('get' === method) {

                                var formData = jForm.serializeJSON();
                                if ('merge-with-uri-params' in data && "0" !== data['merge-with-uri-params']) {
                                    formData = $.extend(currentParams, formData);
                                }
                                var queryString = $.param(formData);
                                window.location.href = window.location.pathname + "?" + queryString;
                            }
                            else {
                                devError("This actionFunction does only work with form.get method for now");
                                return;
                            }
                        }
                    }
                    else {
                        devError("Unknown actionFunction: " + action);
                        return;
                    }
                }


                //----------------------------------------
                // regular handling
                //----------------------------------------
                if (false === ('params' in data)) {
                    data.params = {};
                }


                var params = data.params;


                // nin shadow handling
                if ('ninshadow' in data) {
                    var ninShadowTarget = data.ninshadow;
                    if ('$' === ninShadowTarget.substr(0, 1)) {
                        ninShadowTarget = ninShadowTarget.substr(1);
                    }
                    var jContext = jObj.closest('.bionic-context');
                    var jNinShadowTarget = getTargetById(ninShadowTarget, jContext);

                    if (jNinShadowTarget.length) {
                        window.ninShadow = jNinShadowTarget;
                    }
                }


                //----------------------------------------
                // handling intent
                //----------------------------------------
                var markers = collectPageMarkers();
                if (markers.length) {
                    window.ekomIntent = markers;
                }

                //----------------------------------------
                // calling the action
                //----------------------------------------
                callable(jObj, action, params);


            }
            else {
                devError("action is not defined");
                console.log(data);
            }
        }
        else if ('binary' === type) {
            var data = collectDataAttr(jObj);
            if (true === downloadAjaxPdf) {
                downloadAjaxPdf = false;


                var name = "pdf file";
                if ('params' in data && 'name' in data.params) {
                    name = data.params.name;
                }

                if ("ninShadowHelper" in window) {
                    window.ninShadowHelper.start();
                }

                var href = jObj.attr("href");


                // https://stackoverflow.com/questions/12876000/how-to-build-pdf-file-from-binary-string-returned-from-a-web-service-using-javas
                var request = new XMLHttpRequest();
                request.open("GET", href, true);
                request.responseType = "blob";
                request.onload = function (e) {
                    if (this.status === 200) {
                        // `blob` response
                        // create `objectURL` of `this.response` : `.pdf` as `Blob`
                        var file = window.URL.createObjectURL(this.response);
                        var a = document.createElement("a");
                        a.href = file;
                        a.download = this.response.name || name;
                        document.body.appendChild(a);
                        if ("ninShadowHelper" in window) {
                            window.ninShadowHelper.end();
                        }
                        a.click();
                        // remove `a` following `Save As` dialog,
                        // `window` regains `focus`
                        window.onfocus = function () {
                            if (a.parentNode === document.body) {
                                document.body.removeChild(a);
                            }
                        }
                    }
                };
                request.send();
            }
            else {
                devError("Don't know how to handle binary type")
            }
        }
        else {
            devError("not handled yet wit type=" + type);
        }
    }

    function getTargetValue(jTarget, jContext) {

        var isArray = false;
        var name = jTarget.attr('name');
        var value;

        if ('undefined' !== typeof name) {
            if ('[]' === name.substr(name.length - 2)) {
                value = [];
                isArray = true;
                jContext.find('[name="' + name + '"]').each(function () {
                    value.push($(this).val());
                });
            }
        }

        if (false === isArray) {
            value = jTarget.val();
            if ('undefined' === typeof value) {
                value = jTarget.text().trim();
            }
        }

        return value;
    }

    // https://stackoverflow.com/questions/6071158/javascript-dynamically-create-multidimensional-array-from-string
    function constructObject(a, final) {
        var val = a.shift();
        var obj = {};
        if (a.length > 0) {
            obj[val] = constructObject(a, final);
        } else {
            obj[val] = final;
        }
        return obj;
    }

    function getTargetById(targetId, jContext) {
        return jContext.find('.bionic-target[data-id="' + targetId + '"]');
    }


    function collectDataAttr(jObj) {
        var data = {};
        var jContext = null;

        if (jObj.is('select')) {
            var mergeOption = jObj.attr("data-merge-option");
            if (mergeOption) {
                var jOption = jObj.find(':selected');
                if (jOption.length) {
                    data = collectDataAttr(jOption);
                }

            }
        }


        [].forEach.call(jObj[0].attributes, function (attr) {
            if (/^data-/.test(attr.name)) {
                var name = attr.name.substr(5);
                var value = attr.value;

                //----------------------------------------
                // RESOLVE VALUE
                //----------------------------------------
                if ('$this' === value) {
                    jContext = jObj.closest('.bionic-context');
                    if (0 === jContext.length) {
                        devError("jContext not found for attribute " + name + "=" + value);
                        return;
                    }
                    value = getTargetValue(jObj, jContext);
                }
                else if ('$' === value.substr(0, 1)) {
                    var targetId = value.substr(1);
                    if (null === jContext) {
                        jContext = jObj.closest('.bionic-context');
                        if (0 === jContext.length) {
                            devError("jContext not found for attribute " + name + "=" + value);
                            return;
                        }
                    }

                    var jTarget = getTargetById(targetId, jContext);
                    if (jTarget.length) {
                        value = getTargetValue(jTarget, jContext);
                    }
                }
                // bionic valueFunctions
                else if (':' === value.substr(0, 1)) {


                    var argString;
                    var p = value.substr(1).split(':', 2);
                    var funcName = p.shift();
                    if ('formValue' === funcName) {
                        argString = p.shift();
                        var jForm = jObj.closest('form');
                        if (jForm.length) {
                            if (argString) {
                                var key = argString;
                                var formData = jForm.serializeJSON();
                                if (key in formData) {
                                    value = formData[key];
                                }
                            }
                            else {
                                devError("formValue valueFunction problem: argument #1 not specified");
                            }
                        }
                        else {
                            devError("formValue valueFunction problem: the bionic element must be inside a form");
                        }
                    }
                    else if ('json' === funcName) {
                        // note: we use substr because split has problems with quotes
                        argString = value.substr(6);
                        if (argString) {
                            value = JSON.parse(argString);
                        }
                        else {
                            devError("json valueFunction problem: argument #1 not specified");
                        }
                    }
                    else {
                        devError("This function is not supported yet: " + funcName);
                    }
                }


                //----------------------------------------
                // DIRECTIVES
                //----------------------------------------
                if ("directive-" === name.substr(0, 10)) {
                    var directiveName = name.substr(10);

                    if ("form2params" === directiveName) {
                        var jForm = jObj.closest("form");
                        if (jForm.length) {

                            var formParams = jForm.serializeJSON();
                            if (false === ('params' in data)) {
                                data.params = {};
                            }

                            for (var i in formParams) {
                                data.params[i] = formParams[i];
                            }
                        }
                        else {
                            devError("directive " + directiveName + ": parent form not found");
                        }
                    }
                    else if ("stop_propagation" === directiveName) {
                        handleInteractionReturn = false;
                    }
                    else if ("confirm_msg" === directiveName) {
                        var msg = value;
                        confirmInteractionMsg = msg;
                    }
                    else if ("pdfdownload" === directiveName) {
                        downloadAjaxPdf = true;
                    }
                    else if ("reload" === directiveName) {
                        willReload = true;
                    }
                    else {
                        devError("Unknown directiveName: " + directiveName);
                    }
                }

                //----------------------------------------
                // ATTACH THE VALUE TO THE COLLECTED ARRAY
                //----------------------------------------
                if ('param-' === name.substr(0, 6)) {
                    if (false === ('params' in data)) {
                        data.params = {};
                    }
                    var paramName = name.substr(6);

                    //----------------------------------------
                    // DO WE TRY TO CREATE AN ARRAY HERE?
                    //----------------------------------------
                    var p = paramName.split('-');
                    if (p.length > 1) { // yes
                        var arrayName = p.shift();
                        value = constructObject(p, value);
                        if (arrayName in data.params) {
                            value = $.extend(true, data.params[arrayName], value);
                        }
                        data.params[arrayName] = value;
                    }
                    else {
                        data.params[paramName] = value;
                    }
                }
                else {
                    data[name] = value;
                }


            }
        });
        return data;
    }

    // function hookAfter(jBionic, hookName) {
    //     var hookAfter = jBionic.attr("data-hook-after");
    //     if (hookAfter) {
    //         api.once(hookName, function (data) {
    //             getHook(hookAfter)(jBionic, data);
    //         });
    //     }
    // }

    function collectPageMarkers() {
        var markers = [];
        $("body").find(".bionic-marker").each(function () {
            if ('intent' === $(this).attr("data-type")) {
                var value = $(this).attr("data-value");
                if ("undefined" !== typeof value) {
                    markers.push(value);
                }
            }
        });
        return markers;
    }


    function handleInteraction(jBionicElement) {


        handleAction(jBionicElement, function (jObj, action, params) {
            try {


                var execute = true;
                if (null !== confirmInteractionMsg) {
                    execute = confirm(confirmInteractionMsg);
                    confirmInteractionMsg = null;
                }
                if (true === execute) {
                    window.bionicActionHandler(jObj, action, params, take);
                }

            }
            catch (err) {
                devError(err.message);
            }
        });
    }


    $(document).ready(function () {


        var delay = (function () {
            var timer = 0;
            return function (callback, ms) {
                clearTimeout(timer);
                timer = setTimeout(callback, ms);
            };
        })();


        $(document).on('click.bionic', '.bionic-btn', function (e) {
            e.preventDefault();
            handleInteraction($(this));
            if (false === handleInteractionReturn) {
                return false;
            }
            handleInteractionReturn = null; // reset the next interaction
        });
        $(document).on('change.bionic', '.bionic-select', function (e) {
            e.preventDefault();
            handleInteraction($(this));
            if (false === handleInteractionReturn) {
                return false;
            }
            handleInteractionReturn = null; // reset the next interaction
        });
        $(document).on('change.bionic keyup.bionic', '.bionic-number', function (e) {
            e.preventDefault();
            var debounceTime = $(this).attr("data-debounce-time");
            if ('undefined' === typeof debounceTime) {
                debounceTime = 250;
            }
            else {
                debounceTime = parseInt(debounceTime);
            }
            var zis = $(this);
            delay(function () {
                handleInteraction(zis);
                if (false === handleInteractionReturn) {
                    return false;
                }
                handleInteractionReturn = null; // reset the next interaction
            }, debounceTime);
        });

    });

})();