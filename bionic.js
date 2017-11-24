(function () {

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
    $.fn.serializeObjectBionic = function () {

        var self = this,
            json = {},
            push_counters = {},
            patterns = {
                "validate": /^[a-zA-Z][a-zA-Z0-9_]*(?:\[(?:\d*|[a-zA-Z0-9_]+)\])*$/,
                "key": /[a-zA-Z0-9_]+|(?=\[\])/g,
                "push": /^$/,
                "fixed": /^\d+$/,
                "named": /^[a-zA-Z0-9_]+$/
            };


        this.build = function (base, key, value) {
            base[key] = value;
            return base;
        };

        this.push_counter = function (key) {
            if (push_counters[key] === undefined) {
                push_counters[key] = 0;
            }
            return push_counters[key]++;
        };

        $.each($(this).serializeArray(), function () {

            // skip invalid keys
            if (!patterns.validate.test(this.name)) {
                return;
            }

            var k,
                keys = this.name.match(patterns.key),
                merge = this.value,
                reverse_key = this.name;

            while ((k = keys.pop()) !== undefined) {

                // adjust reverse_key
                reverse_key = reverse_key.replace(new RegExp("\\[" + k + "\\]$"), '');

                // push
                if (k.match(patterns.push)) {
                    merge = self.build({}, self.push_counter(reverse_key), merge);
                }

                // fixed
                else if (k.match(patterns.fixed)) {
                    merge = self.build({}, k, merge);
                }

                // named
                else if (k.match(patterns.named)) {
                    merge = self.build({}, k, merge);
                }
            }

            json = $.extend(true, json, merge);
        });

        return json;
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

                                var formData = jForm.serializeObjectBionic();
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
                                var formData = jForm.serializeObjectBionic();
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
                            var formParams = jForm.serializeObjectBionic();
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

                window.bionicActionHandler(jObj, action, params, take);


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

        });
        $(document).on('change.bionic', '.bionic-select', function (e) {
            e.preventDefault();
            handleInteraction($(this));
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
            }, debounceTime);
        });

    });

})();