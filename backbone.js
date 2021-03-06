(function (root, factory) {
    //  AMD加载
    if (typeof define === 'function' && define.amd) {
        define(['underscore', 'jquery', 'exports'], function (_, $, exports) {
            root.Backbone = factory(root, exports, _, $);
        });

        //  NodeJs
    } else if (typeof exports !== 'undefined') {
        var _ = require('underscore');
        factory(root, exports, _);

        //  <script>
    } else {
        root.Backbone = factory(root, {}, root._, (root.jQuery || root.Zepto || root.ender || root.$));
    }

}(this, function (root, Backbone, _, $) {

    //  缓存全局变量
    var previousBackbone = root.Backbone;

    //  数组和数组下的slice
    var array = [];
    var slice = array.slice;

    //  设置版本
    Backbone.VERSION = '1.1.2';

    //  把jQuery作为成员属性
    Backbone.$ = $;

    //  noConflict方法
    Backbone.noConflict = function () {
        root.Backbone = previousBackbone;
        return this;
    };

    // Turn on `emulateHTTP` to support legacy HTTP servers. Setting this option
    // will fake `"PATCH"`, `"PUT"` and `"DELETE"` requests via the `_method` parameter and
    // set a `X-Http-Method-Override` header.
    Backbone.emulateHTTP = false;

    // Turn on `emulateJSON` to support legacy servers that can't deal with direct
    // `application/json` requests ... this will encode the body as
    // `application/x-www-form-urlencoded` instead and will send the model in a
    // form param named `model`.
    Backbone.emulateJSON = false;

    //  事件模块
    var Events = Backbone.Events = {

        /**
         *  绑定相关事件
         *  @param name      事件名称
         *  @param callback  事件回调
         *  @param context   上下文执行作用域
         * */
        on: function (name, callback, context) {
            if (!eventsApi(this, 'on', name, [callback, context]) || !callback) return this;
            this._events || (this._events = {});
            var events = this._events[name] || (this._events[name] = []);
            events.push({callback: callback, context: context, ctx: context || this});
            return this;
        },

        //  对相关事件只进行一次监听
        //  name: 事件名称
        //  callback: 事件回调
        //  context: 上下文作用域
        once: function (name, callback, context) {
            if (!eventsApi(this, 'once', name, [callback, context]) || !callback) return this;
            var self = this;
            var once = _.once(function () {
                self.off(name, once);
                callback.apply(this, arguments);
            });
            once._callback = callback;
            return this.on(name, once, context);
        },

        //  移除事件回调,如果context没有被传进来,移除所有事件
        //  如果callback没有被传进来,也移除所有事件
        //  如果没有传入name参数,也移除所有事件
        off: function (name, callback, context) {
            if (!this._events || !eventsApi(this, 'off', name, [callback, context])) return this;

            //  参数都没传,将_evevts设置成undefined
            if (!name && !callback && !context) {
                this._events = void 0;
                return this;
            }

            var names = name ? [name] : _.keys(this._events);
            for (var i = 0, length = names.length; i < length; i++) {
                name = names[i];

                // Bail out if there are no events stored.
                var events = this._events[name];
                if (!events) continue;

                // Remove all callbacks for this event.
                if (!callback && !context) {
                    delete this._events[name];
                    continue;
                }

                // Find any remaining events.
                var remaining = [];
                for (var j = 0, k = events.length; j < k; j++) {
                    var event = events[j];
                    if (
                        callback && callback !== event.callback &&
                        callback !== event.callback._callback ||
                        context && context !== event.context
                    ) {
                        remaining.push(event);
                    }
                }

                // Replace events if there are any remaining.  Otherwise, clean up.
                if (remaining.length) {
                    this._events[name] = remaining;
                } else {
                    delete this._events[name];
                }
            }

            return this;
        },

        //  根据事件名触发绑定的相关事件
        trigger: function (name) {
            if (!this._events) return this;
            var args = slice.call(arguments, 1);
            if (!eventsApi(this, 'trigger', name, args)) return this;
            var events = this._events[name];
            var allEvents = this._events.all;
            if (events) triggerEvents(events, args);
            if (allEvents) triggerEvents(allEvents, arguments);
            return this;
        },

        // Inversion-of-control versions of `on` and `once`. Tell *this* object to
        // listen to an event in another object ... keeping track of what it's
        // listening to.
        listenTo: function (obj, name, callback) {
            var listeningTo = this._listeningTo || (this._listeningTo = {});
            var id = obj._listenId || (obj._listenId = _.uniqueId('l'));
            listeningTo[id] = obj;
            if (!callback && typeof name === 'object') callback = this;
            obj.on(name, callback, this);
            return this;
        },

        listenToOnce: function (obj, name, callback) {
            if (typeof name === 'object') {
                for (var event in name) this.listenToOnce(obj, event, name[event]);
                return this;
            }

            //  传入的事件名中含有空格
            if (eventSplitter.test(name)) {
                //  将事件名称拆分成数组,再遍历,给每个事件监听一次
                var names = name.split(eventSplitter);
                for (var i = 0, length = names.length; i < length; i++) {
                    this.listenToOnce(obj, names[i], callback);
                }
                return this;
            }
            if (!callback) return this;
            var once = _.once(function () {
                this.stopListening(obj, name, once);
                callback.apply(this, arguments);
            });
            once._callback = callback;
            return this.listenTo(obj, name, once);
        },

        // Tell this object to stop listening to either specific events ... or
        // to every object it's currently listening to.
        stopListening: function (obj, name, callback) {
            var listeningTo = this._listeningTo;
            if (!listeningTo) return this;
            var remove = !name && !callback;
            if (!callback && typeof name === 'object') callback = this;
            if (obj)(listeningTo = {})[obj._listenId] = obj;
            for (var id in listeningTo) {
                obj = listeningTo[id];
                obj.off(name, callback, this);
                if (remove || _.isEmpty(obj._events)) delete this._listeningTo[id];
            }
            return this;
        }

    };

    //  事件名分隔符
    var eventSplitter = /\s+/;

    // Implement fancy features of the Events API such as multiple event
    // names `"change blur"` and jQuery-style event maps `{change: action}`
    // in terms of the existing API.
    var eventsApi = function (obj, action, name, rest) {
        //  只传入了两个参数
        if (!name) return true;

        //  name参数是一个对象,就枚举该对象,并且调用相关方法
        if (typeof name === 'object') {
            for (var key in name) {
                obj[action].apply(obj, [key, name[key]].concat(rest));
            }
            return false;
        }

        //  事件名中含有空格,就把事件名拆分成数组,依次调用相关方法
        if (eventSplitter.test(name)) {
            var names = name.split(eventSplitter);
            for (var i = 0, length = names.length; i < length; i++) {
                obj[action].apply(obj, [names[i]].concat(rest));
            }
            return false;
        }

        return true;
    };

    /**
     *  据说3个以内的参数用这种方法可以提高执行效率
     *  @param  events  事件对象
     *  @param  args    参数列表
     * */
    var triggerEvents = function (events, args) {
        var ev, i = -1,
            l = events.length,
            a1 = args[0],
            a2 = args[1],
            a3 = args[2];
        //  根据参数个数来判断调用
        switch (args.length) {
            case 0:
                while (++i < l)(ev = events[i]).callback.call(ev.ctx);
                return;
            case 1:
                while (++i < l)(ev = events[i]).callback.call(ev.ctx, a1);
                return;
            case 2:
                while (++i < l)(ev = events[i]).callback.call(ev.ctx, a1, a2);
                return;
            case 3:
                while (++i < l)(ev = events[i]).callback.call(ev.ctx, a1, a2, a3);
                return;
            default:
                while (++i < l)(ev = events[i]).callback.apply(ev.ctx, args);
                return;
        }
    };

    //  设置相关别名
    Events.bind = Events.on;
    Events.unbind = Events.off;

    //  往Backbone对象上绑定Event模块
    _.extend(Backbone, Events);

    //  Backbone中的模型
    var Model = Backbone.Model = function (attributes, options) {
        var attrs = attributes || {};
        options || (options = {});
        this.cid = _.uniqueId('c');
        this.attributes = {};
        if (options.collection) this.collection = options.collection;
        if (options.parse) attrs = this.parse(attrs, options) || {};
        attrs = _.defaults({}, attrs, _.result(this, 'defaults'));
        this.set(attrs, options);
        this.changed = {};
        this.initialize.apply(this, arguments);
    };

    //  往Model原型下拓展相关事件
    _.extend(Model.prototype, Events, {

        //  标记是否发生改变
        changed: null,

        //  验证错误
        validationError: null,

        //  id属性
        idAttribute: 'id',

        //  初始化方法
        initialize: function () {
        },

        //  toJSON方法
        toJSON: function (options) {
            return _.clone(this.attributes);
        },

        //  代理调用Backbone.sync方法
        sync: function () {
            return Backbone.sync.apply(this, arguments);
        },

        //  属性attributes下相关属性值
        get: function (attr) {
            return this.attributes[attr];
        },

        //  对HTML进行转义
        escape: function (attr) {
            return _.escape(this.get(attr));
        },

        //  是否有某个属性值
        has: function (attr) {
            return this.get(attr) != null;
        },

        //  代理执行underscore下的_.matches方法,返回一个断言函数
        matches: function (attrs) {
            return _.matches(attrs)(this.attributes);
        },

        //  往Model实例中塞值
        set: function (key, val, options) {
            var attr, attrs, unset, changes, silent, changing, prev, current;

            //  如果一个参数都没传,返回
            if (key == null) return this;

            //  第一个参数是对象
            if (typeof key === 'object') {
                attrs = key;
                options = val;
            } else {
                (attrs = {})[key] = val;
            }

            options || (options = {});

            //  验证
            if (!this._validate(attrs, options)) return false;

            // Extract attributes and options.
            unset = options.unset;
            silent = options.silent;
            changes = [];
            changing = this._changing;
            this._changing = true;

            if (!changing) {
                this._previousAttributes = _.clone(this.attributes);
                this.changed = {};
            }
            current = this.attributes, prev = this._previousAttributes;

            // Check for changes of `id`.
            if (this.idAttribute in attrs) this.id = attrs[this.idAttribute];

            // For each `set` attribute, update or delete the current value.
            for (attr in attrs) {
                val = attrs[attr];
                if (!_.isEqual(current[attr], val)) changes.push(attr);
                if (!_.isEqual(prev[attr], val)) {
                    this.changed[attr] = val;
                } else {
                    delete this.changed[attr];
                }
                unset ? delete current[attr] : current[attr] = val;
            }

            // Trigger all relevant attribute changes.
            if (!silent) {
                if (changes.length) this._pending = options;
                for (var i = 0, length = changes.length; i < length; i++) {
                    this.trigger('change:' + changes[i], this, current[changes[i]], options);
                }
            }

            // You might be wondering why there's a `while` loop here. Changes can
            // be recursively nested within `"change"` events.
            if (changing) return this;
            if (!silent) {
                while (this._pending) {
                    options = this._pending;
                    this._pending = false;
                    this.trigger('change', this, options);
                }
            }
            this._pending = false;
            this._changing = false;
            return this;
        },

        // Remove an attribute from the model, firing `"change"`. `unset` is a noop
        // if the attribute doesn't exist.
        unset: function (attr, options) {
            return this.set(attr, void 0, _.extend({}, options, {unset: true}));
        },

        // Clear all attributes on the model, firing `"change"`.
        clear: function (options) {
            var attrs = {};
            for (var key in this.attributes) attrs[key] = void 0;
            return this.set(attrs, _.extend({}, options, {unset: true}));
        },

        // Determine if the model has changed since the last `"change"` event.
        // If you specify an attribute name, determine if that attribute has changed.
        hasChanged: function (attr) {
            if (attr == null) return !_.isEmpty(this.changed);
            return _.has(this.changed, attr);
        },

        //  对比相应属性是否发生改变并且返回改变后的属性值
        changedAttributes: function (diff) {
            if (!diff) return this.hasChanged() ? _.clone(this.changed) : false;
            var val, changed = false;
            var old = this._changing ? this._previousAttributes : this.attributes;
            for (var attr in diff) {
                if (_.isEqual(old[attr], (val = diff[attr]))) continue;
                (changed || (changed = {}))[attr] = val;
            }
            return changed;
        },

        //  取得前一个
        previous: function (attr) {
            if (attr == null || !this._previousAttributes) return null;
            return this._previousAttributes[attr];
        },

        // Get all of the attributes of the model at the time of the previous
        // `"change"` event.
        previousAttributes: function () {
            return _.clone(this._previousAttributes);
        },

        // Fetch the model from the server. If the server's representation of the
        // model differs from its current attributes, they will be overridden,
        // triggering a `"change"` event.
        fetch: function (options) {
            options = options ? _.clone(options) : {};
            if (options.parse === void 0) options.parse = true;
            var model = this;
            var success = options.success;
            options.success = function (resp) {
                if (!model.set(model.parse(resp, options), options)) return false;
                if (success) success(model, resp, options);
                model.trigger('sync', model, resp, options);
            };
            wrapError(this, options);
            return this.sync('read', this, options);
        },

        // Set a hash of model attributes, and sync the model to the server.
        // If the server returns an attributes hash that differs, the model's
        // state will be `set` again.
        save: function (key, val, options) {
            var attrs, method, xhr, attributes = this.attributes;

            // Handle both `"key", value` and `{key: value}` -style arguments.
            if (key == null || typeof key === 'object') {
                attrs = key;
                options = val;
            } else {
                (attrs = {})[key] = val;
            }

            options = _.extend({validate: true}, options);

            // If we're not waiting and attributes exist, save acts as
            // `set(attr).save(null, opts)` with validation. Otherwise, check if
            // the model will be valid when the attributes, if any, are set.
            if (attrs && !options.wait) {
                if (!this.set(attrs, options)) return false;
            } else {
                if (!this._validate(attrs, options)) return false;
            }

            // Set temporary attributes if `{wait: true}`.
            if (attrs && options.wait) {
                this.attributes = _.extend({}, attributes, attrs);
            }

            // After a successful server-side save, the client is (optionally)
            // updated with the server-side state.
            if (options.parse === void 0) options.parse = true;
            var model = this;
            var success = options.success;
            options.success = function (resp) {
                // Ensure attributes are restored during synchronous saves.
                model.attributes = attributes;
                var serverAttrs = model.parse(resp, options);
                if (options.wait) serverAttrs = _.extend(attrs || {}, serverAttrs);
                if (_.isObject(serverAttrs) && !model.set(serverAttrs, options)) {
                    return false;
                }
                if (success) success(model, resp, options);
                model.trigger('sync', model, resp, options);
            };
            wrapError(this, options);

            method = this.isNew() ? 'create' : (options.patch ? 'patch' : 'update');
            if (method === 'patch' && !options.attrs) options.attrs = attrs;
            xhr = this.sync(method, this, options);

            // Restore attributes.
            if (attrs && options.wait) this.attributes = attributes;

            return xhr;
        },

        // Destroy this model on the server if it was already persisted.
        // Optimistically removes the model from its collection, if it has one.
        // If `wait: true` is passed, waits for the server to respond before removal.
        destroy: function (options) {
            options = options ? _.clone(options) : {};
            var model = this;
            var success = options.success;

            var destroy = function () {
                model.stopListening();
                model.trigger('destroy', model, model.collection, options);
            };

            options.success = function (resp) {
                if (options.wait || model.isNew()) destroy();
                if (success) success(model, resp, options);
                if (!model.isNew()) model.trigger('sync', model, resp, options);
            };

            if (this.isNew()) {
                options.success();
                return false;
            }
            wrapError(this, options);

            var xhr = this.sync('delete', this, options);
            if (!options.wait) destroy();
            return xhr;
        },

        // Default URL for the model's representation on the server -- if you're
        // using Backbone's restful methods, override this to change the endpoint
        // that will be called.
        url: function () {
            var base =
                _.result(this, 'urlRoot') ||
                _.result(this.collection, 'url') ||
                urlError();
            if (this.isNew()) return base;
            return base.replace(/([^\/])$/, '$1/') + encodeURIComponent(this.id);
        },

        // **parse** converts a response into the hash of attributes to be `set` on
        // the model. The default implementation is just to pass the response along.
        parse: function (resp, options) {
            return resp;
        },

        // Create a new model with identical attributes to this one.
        clone: function () {
            return new this.constructor(this.attributes);
        },

        // A model is new if it has never been saved to the server, and lacks an id.
        isNew: function () {
            return !this.has(this.idAttribute);
        },

        // Check if the model is currently in a valid state.
        isValid: function (options) {
            return this._validate({}, _.extend(options || {}, {validate: true}));
        },

        // Run validation against the next complete set of model attributes,
        // returning `true` if all is well. Otherwise, fire an `"invalid"` event.
        _validate: function (attrs, options) {
            if (!options.validate || !this.validate) return true;
            attrs = _.extend({}, this.attributes, attrs);
            var error = this.validationError = this.validate(attrs, options) || null;
            if (!error) return true;
            this.trigger('invalid', this, error, _.extend(options, {validationError: error}));
            return false;
        }

    });

    //  被代理的方法列表
    var modelMethods = ['keys', 'values', 'pairs', 'invert', 'pick', 'omit', 'chain', 'isEmpty'];

    //  Model下代理underscore相关方法
    _.each(modelMethods, function (method) {
        if (!_[method]) return;
        Model.prototype[method] = function () {
            var args = slice.call(arguments);
            args.unshift(this.attributes);
            return _[method].apply(_, args);
        };
    });

    /**
     *  Collection模块
     *  @param  models  model实例
     *  @params options 参数(Object)
     * */
    var Collection = Backbone.Collection = function (models, options) {
        //  没有传入options,就指定options为空对象
        options || (options = {});

        //  options中指定了model
        if (options.model) this.model = options.model;

        //  传入了comparator,void 0指代undefined,这样避免undefined被重写
        if (options.comparator !== void 0) this.comparator = options.comparator;

        //  解绑和成员属性的一些关联
        this._reset();

        //  初始化方法
        this.initialize.apply(this, arguments);

        //  在调用model.set或者collection.add等事件时,会默认触发一个函数,可以通过silent: true来进行组织
        if (models) this.reset(models, _.extend({silent: true}, options));
    };

    //  model.set的参数、collection.add的参数
    var setOptions = {add: true, remove: true, merge: true};
    var addOptions = {add: true, remove: false};

    //  拓展Collection原型属性下相关事件
    _.extend(Collection.prototype, Events, {

        //  collection中的model属性
        model: Model,

        /**
         *  初始化函数
         * */
        initialize: function () {
        },

        /**
         *  取得每一个Model下的attributes中相关的值,组成一个
         *  @param options  无用参数
         * */
        toJSON: function (options) {
            return this.map(function (model) {
                return model.toJSON(options);
            });
        },

        /**
         *  代理执行Backbone.sync方法
         * */
        sync: function () {
            return Backbone.sync.apply(this, arguments);
        },

        /**
         *  添加一个model实例到当前collection
         *  @param  models  model实例或者一个由model实例组成的list
         *  @param options  相关选项参数
         * */
        add: function (models, options) {
            return this.set(models, _.extend({merge: false}, options, addOptions));
        },

        /**
         * 删除当前collection中的一个model或者一个由model组成的list
         * @param  models  model实例或者一个由model实例组成的list
         * @param options  相关选项参数
         * */
        remove: function (models, options) {
            //  是否只有一个model,如果models不是一个数组,就认定为只有一个model,而不是list
            var singular = !_.isArray(models);

            //  根据是否为单一的对传入的models进行处理
            models = singular ? [models] : _.clone(models);

            //  options的处理
            options || (options = {});

            //  遍历整个models
            for (var i = 0, length = models.length; i < length; i++) {
                //  获取当前model
                var model = models[i] = this.get(models[i]);

                //  如果当前model不存在当前collection的实例中
                if (!model) continue;

                //  获取当前model的id
                var id = this.modelId(model.attributes);

                //  当前id存在
                if (id != null) delete this._byId[id];
                delete this._byId[model.cid];

                //  获取当前model在collection数组中的位置
                var index = this.indexOf(model);

                //  删除该元素并且把数组长度减一
                this.models.splice(index, 1);
                this.length--;
                if (!options.silent) {
                    options.index = index;
                    //  触发collection的remove事件
                    model.trigger('remove', model, this, options);
                }

                //  删除相关引用
                this._removeReference(model, options);
            }

            //  返回相关删除的model或者由model组成list
            return singular ? models[0] : models;
        },

        /**
         * 往当前collection中添加/更新一个或者多个model实例
         * @param models      model实例或者一个由model实例组成的list
         * @param options     相关选项参数
         */
        set: function (models, options) {
            //  合并默认的set参数传入的set参数
            options = _.defaults({}, options, setOptions);
            if (options.parse) models = this.parse(models, options);

            //  是否是单个model实例
            var singular = !_.isArray(models);

            //  判断model是否存在,如果存在,根据是否为一个
            models = singular ? (models ? [models] : []) : models.slice();

            var id, model, attrs, existing, sort;
            var at = options.at;
            if (at != null) at = +at;
            if (at < 0) at += this.length + 1;
            var sortable = this.comparator && (at == null) && options.sort !== false;
            var sortAttr = _.isString(this.comparator) ? this.comparator : null;
            var toAdd = [],
                toRemove = [],
                modelMap = {};
            var add = options.add,
                merge = options.merge,
                remove = options.remove;
            var order = !sortable && add && remove ? [] : false;
            var orderChanged = false;

            // Turn bare objects into model references, and prevent invalid models
            // from being added.
            for (var i = 0, length = models.length; i < length; i++) {
                attrs = models[i];

                // If a duplicate is found, prevent it from being added and
                // optionally merge it into the existing model.
                if (existing = this.get(attrs)) {
                    if (remove) modelMap[existing.cid] = true;
                    if (merge && attrs !== existing) {
                        attrs = this._isModel(attrs) ? attrs.attributes : attrs;
                        if (options.parse) attrs = existing.parse(attrs, options);
                        existing.set(attrs, options);
                        if (sortable && !sort && existing.hasChanged(sortAttr)) sort = true;
                    }
                    models[i] = existing;

                    // If this is a new, valid model, push it to the `toAdd` list.
                } else if (add) {
                    model = models[i] = this._prepareModel(attrs, options);
                    if (!model) continue;
                    toAdd.push(model);
                    this._addReference(model, options);
                }

                // Do not add multiple models with the same `id`.
                model = existing || model;
                if (!model) continue;
                id = this.modelId(model.attributes);
                if (order && (model.isNew() || !modelMap[id])) {
                    order.push(model);

                    // Check to see if this is actually a new model at this index.
                    orderChanged = orderChanged || !this.models[i] || model.cid !== this.models[i].cid;
                }

                modelMap[id] = true;
            }

            // Remove nonexistent models if appropriate.
            if (remove) {
                for (var i = 0, length = this.length; i < length; i++) {
                    if (!modelMap[(model = this.models[i]).cid]) toRemove.push(model);
                }
                if (toRemove.length) this.remove(toRemove, options);
            }

            // See if sorting is needed, update `length` and splice in new models.
            if (toAdd.length || orderChanged) {
                if (sortable) sort = true;
                this.length += toAdd.length;
                if (at != null) {
                    for (var i = 0, length = toAdd.length; i < length; i++) {
                        this.models.splice(at + i, 0, toAdd[i]);
                    }
                } else {
                    if (order) this.models.length = 0;
                    var orderedModels = order || toAdd;
                    for (var i = 0, length = orderedModels.length; i < length; i++) {
                        this.models.push(orderedModels[i]);
                    }
                }
            }

            // Silently sort the collection if appropriate.
            if (sort) this.sort({silent: true});

            // Unless silenced, it's time to fire all appropriate add/sort events.
            if (!options.silent) {
                var addOpts = at != null ? _.clone(options) : options;
                for (var i = 0, length = toAdd.length; i < length; i++) {
                    if (at != null) addOpts.index = at + i;
                    (model = toAdd[i]).trigger('add', model, this, addOpts);
                }
                if (sort || orderChanged) this.trigger('sort', this, options);
            }

            // Return the added (or merged) model (or models).
            return singular ? models[0] : models;
        },

        // When you have more items than you want to add or remove individually,
        // you can reset the entire set with a new list of models, without firing
        // any granular `add` or `remove` events. Fires `reset` when finished.
        // Useful for bulk operations and optimizations.
        /**
         *  重置当前collection为指定的model
         *  @param  models      一个由model实例组成的list
         *  @param  options     相关选项参数
         *  @return {Array}     一个由model实例组成的list
         * */
        reset: function (models, options) {
            //  options参数的合并
            options = options ? _.clone(options) : {};

            //  遍历原collection对象下的model,解除相关引用
            for (var i = 0, length = this.models.length; i < length; i++) {
                this._removeReference(this.models[i], options);
            }
            options.previousModels = this.models;

            //  把collection中的一些
            this._reset();

            //  把models添加到当前collection中
            models = this.add(models, _.extend({silent: true}, options));

            //  如果options里面没有传入slient或者slient是false,触发相应的reset方法,通知View层更新视图
            if (!options.silent) this.trigger('reset', this, options);
            return models;
        },

        /**
         *  往当前collection中追加一个model实例
         *  @param  model       model实例
         *  @param  options     相关选项参数
         * */
        push: function (model, options) {
            return this.add(model, _.extend({at: this.length}, options));
        },

        /**
         *  移除最后一个model
         *  @param  options     相关选项参数
         * */
        pop: function (options) {
            //  取得最后一个model
            var model = this.at(this.length - 1);
            this.remove(model, options);
            return model;
        },

        /**
         *  往当前collection中第一个位置插入一个model实例
         *  @param  model       model实例
         *  @param  options     相关选项参数
         * */
        unshift: function (model, options) {
            return this.add(model, _.extend({at: 0}, options));
        },

        /**
         *  删除当前collection中第一个model实例
         *  @param  options     相关选项参数
         * */
        shift: function (options) {
            var model = this.at(0);
            this.remove(model, options);
            return model;
        },

        /**
         *  代理执行Array.prototype.slice方法
         * */
        slice: function () {
            return slice.apply(this.models, arguments);
        },

        // Get a model from the set by id.
        get: function (obj) {
            if (obj == null) return void 0;
            var id = this.modelId(this._isModel(obj) ? obj.attributes : obj);
            return this._byId[obj] || this._byId[id] || this._byId[obj.cid];
        },

        /**
         *  获取指定位置的model实例
         *  @param index    具体的下标
         * */
        at: function (index) {
            if (index < 0) index += this.length;
            return this.models[index];
        },

        /**
         *  获取满足指定匹配条件的models
         *  @param  attrs    属性
         *  @param  first    不知道干啥的
         * */
        where: function (attrs, first) {
            var matches = _.matches(attrs);
            return this[first ? 'find' : 'filter'](function (model) {
                return matches(model.attributes);
            });
        },

        /**
         *  代理执行
         * */
        findWhere: function (attrs) {
            return this.where(attrs, true);
        },

        // Force the collection to re-sort itself. You don't need to call this under
        // normal circumstances, as the set will maintain sort order as each item
        // is added.
        sort: function (options) {
            if (!this.comparator) throw new Error('Cannot sort a set without a comparator');
            options || (options = {});

            // Run sort based on type of `comparator`.
            if (_.isString(this.comparator) || this.comparator.length === 1) {
                this.models = this.sortBy(this.comparator, this);
            } else {
                this.models.sort(_.bind(this.comparator, this));
            }

            if (!options.silent) this.trigger('sort', this, options);
            return this;
        },

        /**
         * 获取集合中每个model的特定属性
         * @param attr  属性名
         * @return {Array}
         * */
        pluck: function (attr) {
            return _.invoke(this.models, 'get', attr);
        },

        /**
         * 集合对象下的fetch方法,从后端取得数据
         * @param options   相关配置参数
         * */
        fetch: function (options) {
            options = options ? _.clone(options) : {};
            //  options下parse没传,默认改成true
            if (options.parse === void 0) options.parse = true;
            //  option中传入的success回调
            var success = options.success;
            var collection = this;
            options.success = function (resp) {
                //  判断是否传入了reset
                var method = options.reset ? 'reset' : 'set';
                //  调用相关方法
                collection[method](resp, options);
                //  运行传入的成功回调
                if (success) {
                    success(collection, resp, options);
                }
                //  开始进行请求
                collection.trigger('sync', collection, resp, options);
            };
            wrapError(this, options);
            return this.sync('read', this, options);
        },

        // Create a new instance of a model in this collection. Add the model to the
        // collection immediately, unless `wait: true` is passed, in which case we
        // wait for the server to agree.
        create: function (model, options) {
            options = options ? _.clone(options) : {};
            if (!(model = this._prepareModel(model, options))) return false;
            if (!options.wait) this.add(model, options);
            var collection = this;
            var success = options.success;
            options.success = function (model, resp) {
                if (options.wait) collection.add(model, options);
                if (success) success(model, resp, options);
            };
            model.save(null, options);
            return model;
        },

        // **parse** converts a response into a list of models to be added to the
        // collection. The default implementation is just to pass it through.
        parse: function (resp, options) {
            return resp;
        },

        /**
         * 克隆当前Collection
         * @returns {Function}
         */
        clone: function () {
            return new this.constructor(this.models, {
                model: this.model,
                comparator: this.comparator
            });
        },

        /**
         * 获取该模型的id
         * @param attrs 属性列表
         * @returns {*}
         */
        modelId: function (attrs) {
            return attrs[this.model.prototype.idAttribute || 'id'];
        },

        /**
         * Collection下的reset,重置对象下的一些静态属性
         * @private
         */
        _reset: function () {
            this.length = 0;
            this.models = [];
            this._byId = {};
        },

        /**
         * 准备创建一个model实例
         * @param attrs     属性
         * @param options   选项参数
         * */
        _prepareModel: function (attrs, options) {
            //  如果是Model实例
            if (this._isModel(attrs)) {
                //  设置collection,与集合绑定
                if (!attrs.collection) attrs.collection = this;
                return attrs;
            }

            //  如果是一个属性列表
            options = options ? _.clone(options) : {};

            //  指定与集合的联系
            options.collection = this;

            //  创建当前Model的实例
            var model = new this.model(attrs, options);

            //  创建失败,触发collection的invalida事件,并返回false
            if (!model.validationError) return model;
            this.trigger('invalid', this, model.validationError, options);
            return false;
        },

        /**
         * 判断是否是一个Model的实例
         * */
        _isModel: function (model) {
            return model instanceof Model;
        },

        /**
         * 绑定与某个model,并且监听该model的所有事件
         * @param model
         * */
        _addReference: function (model, options) {
            this._byId[model.cid] = model;
            var id = this.modelId(model.attributes);
            if (id != null) this._byId[id] = model;
            model.on('all', this._onModelEvent, this);
        },

        /**
         * 删除某个model与集合的联系,主要是删除相关事件的监听
         * @param model     model实例
         * @param options   选项参数
         * */
        _removeReference: function (model, options) {
            if (this === model.collection) delete model.collection;
            //  解除所以事件
            model.off('all', this._onModelEvent, this);
        },

        /**
         * model上的一些事件
         * */
        _onModelEvent: function (event, model, collection, options) {
            if ((event === 'add' || event === 'remove') && collection !== this) return;
            if (event === 'destroy') this.remove(model, options);
            if (event === 'change') {
                var prevId = this.modelId(model.previousAttributes());
                var id = this.modelId(model.attributes);
                if (prevId !== id) {
                    if (prevId != null) delete this._byId[prevId];
                    if (id != null) this._byId[id] = model;
                }
            }
            this.trigger.apply(this, arguments);
        }

    });

    //  数组指定方法,指定对应的方法就是underscore下相应的方法
    var methods = ['forEach', 'each', 'map', 'collect', 'reduce', 'foldl',
        'inject', 'reduceRight', 'foldr', 'find', 'detect', 'filter', 'select',
        'reject', 'every', 'all', 'some', 'any', 'include', 'contains', 'invoke',
        'max', 'min', 'toArray', 'size', 'first', 'head', 'take', 'initial', 'rest',
        'tail', 'drop', 'last', 'without', 'difference', 'indexOf', 'shuffle',
        'lastIndexOf', 'isEmpty', 'chain', 'sample', 'partition'
    ];

    //  代理underscore下相关方法到collection原型
    _.each(methods, function (method) {
        //  如果underscore下不存在该方法
        if (!_[method]) return;
        Collection.prototype[method] = function () {
            var args = slice.call(arguments);
            args.unshift(this.models);
            return _[method].apply(_, args);
        };
    });

    //  属性方法
    var attributeMethods = ['groupBy', 'countBy', 'sortBy', 'indexBy'];

    //  指定Collection原型下的相关属性方法(同样代理执行underscore下相关方法)
    _.each(attributeMethods, function (method) {
        if (!_[method]) return;
        Collection.prototype[method] = function (value, context) {
            var iterator = _.isFunction(value) ? value : function (model) {
                return model.get(value);
            };
            return _[method](this.models, iterator, context);
        };
    });

    var View = Backbone.View = function (options) {
        this.cid = _.uniqueId('view');
        options || (options = {});
        _.extend(this, _.pick(options, viewOptions));
        this._ensureElement();
        this.initialize.apply(this, arguments);
    };

    // Cached regex to split keys for `delegate`.
    var delegateEventSplitter = /^(\S+)\s*(.*)$/;

    //  view实例的相关属性
    var viewOptions = ['model', 'collection', 'el', 'id', 'attributes', 'className', 'tagName', 'events'];

    //  拓展view下的事件模块
    _.extend(View.prototype, Events, {

        //  标签名
        tagName: 'div',

        /**
         *  代理执行jQuery中的find方法,缩小查找的context
         * */
        $: function (selector) {
            return this.$el.find(selector);
        },

        /**
         *  初始化方法
         * */
        initialize: function () {
        },

        /**
         *  渲染视图
         * */
        render: function () {
            return this;
        },

        /**
         *  从DOM中删除该视图,移除model/collection上的事件监听
         * */
        remove: function () {
            this._removeElement();
            this.stopListening();
            return this;
        },

        /**
         *  删除当前视图中对应的元素
         * */
        _removeElement: function () {
            this.$el.remove();
        },

        /**
         *  设置相关元素的事件
         *  @param  element     元素对象
         * */
        setElement: function (element) {
            //  解绑相关事件
            this.undelegateEvents();
            //  处理相关元素
            this._setElement(element);
            //  代理相关事件
            this.delegateEvents();
            return this;
        },

        /**
         *  处理相关元素
         *  @param  el     元素对象
         * */
        _setElement: function (el) {
            //  判断当前元素是否是一个jQuery实例
            this.$el = el instanceof Backbone.$ ? el : Backbone.$(el);
            this.el = this.$el[0];
        },

        /**
         *  事件代理
         *  @param  events  对象(key:"eventName selector",value:callback)
         * */
        delegateEvents: function (events) {
            if (!(events || (events = _.result(this, 'events')))) return this;
            //  解绑相关事件
            this.undelegateEvents();
            //  遍历该事件对象
            for (var key in events) {
                var method = events[key];
                //  判断key对应的value是否是方法,如果不是,跳出本次遍历
                if (!_.isFunction(method)) method = this[events[key]];
                if (!method) continue;
                var match = key.match(delegateEventSplitter);
                //  代理事件
                this.delegate(match[1], match[2], _.bind(method, this));
            }
            return this;
        },

        /**
         *  通过选择器绑定事件
         *  @param  eventName   事件名
         *  @param  selector    选择器
         *  @param  listener    事件对应的回调
         * */
        delegate: function (eventName, selector, listener) {
            this.$el.on(eventName + '.delegateEvents' + this.cid, selector, listener);
        },

        /**
         *  解绑当前元素上所有事件
         * */
        undelegateEvents: function () {
            if (this.$el) this.$el.off('.delegateEvents' + this.cid);
            return this;
        },

        /**
         *  解除相关事件绑定
         *  @param  eventName   事件名
         *  @param  selector    选择器
         *  @param  listener    事件对应的回调
         * */
        undelegate: function (eventName, selector, listener) {
            this.$el.off(eventName + '.delegateEvents' + this.cid, selector, listener);
        },

        /**
         *  创建元素
         *  @param  tagName     标签名
         * */
        _createElement: function (tagName) {
            return document.createElement(tagName);
        },

        /**
         *  设置视图对应的元素的相关属性
         * */
        _ensureElement: function () {
            if (!this.el) {
                var attrs = _.extend({}, _.result(this, 'attributes'));
                if (this.id) attrs.id = _.result(this, 'id');
                if (this.className) attrs['class'] = _.result(this, 'className');
                this.setElement(this._createElement(_.result(this, 'tagName')));
                this._setAttributes(attrs);
            } else {
                this.setElement(_.result(this, 'el'));
            }
        },

        /**
         *  设置元素的属性
         * */
        _setAttributes: function (attributes) {
            this.$el.attr(attributes);
        }

    });

    //  异步请求
    Backbone.sync = function (method, model, options) {
        var type = methodMap[method];

        _.defaults(options || (options = {}), {
            emulateHTTP: Backbone.emulateHTTP,
            emulateJSON: Backbone.emulateJSON
        });

        var params = {type: type, dataType: 'json'};

        //  确保传入了url,否则抛出异常
        if (!options.url) {
            params.url = _.result(model, 'url') || urlError();
        }

        //
        if (options.data == null && model && (method === 'create' || method === 'update' || method === 'patch')) {
            params.contentType = 'application/json';
            params.data = JSON.stringify(options.attrs || model.toJSON(options));
        }

        //  JSON仿真
        if (options.emulateJSON) {
            params.contentType = 'application/x-www-form-urlencoded';
            params.data = params.data ? {model: params.data} : {};
        }

        //
        if (options.emulateHTTP && (type === 'PUT' || type === 'DELETE' || type === 'PATCH')) {
            params.type = 'POST';
            if (options.emulateJSON) params.data._method = type;
            var beforeSend = options.beforeSend;
            options.beforeSend = function (xhr) {
                xhr.setRequestHeader('X-HTTP-Method-Override', type);
                if (beforeSend) return beforeSend.apply(this, arguments);
            };
        }

        // Don't process data on a non-GET request.
        if (params.type !== 'GET' && !options.emulateJSON) {
            params.processData = false;
        }

        //
        var error = options.error;
        options.error = function (xhr, textStatus, errorThrown) {
            options.textStatus = textStatus;
            options.errorThrown = errorThrown;
            if (error) error.apply(this, arguments);
        };

        //  发送请求
        var xhr = options.xhr = Backbone.ajax(_.extend(params, options));
        model.trigger('request', model, xhr, options);
        return xhr;
    };

    //  几个RESTFUL风格的ajax请求方式
    var methodMap = {
        'create': 'POST',
        'update': 'PUT',
        'patch': 'PATCH',
        'delete': 'DELETE',
        'read': 'GET'
    };

    //  ajax(代理调用jQuery/zepto)下的ajax
    Backbone.ajax = function () {
        return Backbone.$.ajax.apply(Backbone.$, arguments);
    };

    // 路由模块
    var Router = Backbone.Router = function (options) {
        options || (options = {});
        if (options.routes) this.routes = options.routes;
        this._bindRoutes();
        this.initialize.apply(this, arguments);
    };

    // Cached regular expressions for matching named param parts and splatted
    // parts of route strings.
    var optionalParam = /\((.*?)\)/g;
    var namedParam = /(\(\?)?:\w+/g;
    var splatParam = /\*\w+/g;
    var escapeRegExp = /[\-{}\[\]+?.,\\\^$|#\s]/g;

    //  拓展路由模块的事件对象
    _.extend(Router.prototype, Events, {

        /**
         *  初始化方法
         * */
        initialize: function () {
        },
        /**
         * 配置路由方法
         * @param route         路由
         * @param name          路由名称/回调
         * @param callback      回调
         * @returns {Router}
         */
        route: function (route, name, callback) {
            //  将路由转换成正则表达式
            if (!_.isRegExp(route)) route = this._routeToRegExp(route);

            //  判断第二个参数是否是一个方法,修改参数
            if (_.isFunction(name)) {
                callback = name;
                name = '';
            }

            //  没有传入参数
            if (!callback) callback = this[name];
            var router = this;
            Backbone.history.route(route, function (fragment) {
                var args = router._extractParameters(route, fragment);
                if (router.execute(callback, args, name) !== false) {
                    router.trigger.apply(router, ['route:' + name].concat(args));
                    router.trigger('route', name, args);
                    Backbone.history.trigger('route', router, name, args);
                }
            });
            return this;
        },

        /**
         * 执行某个方法
         * @param callback  回调函数
         * @param args      参数(Array)
         * @param name      名称
         */
        execute: function (callback, args, name) {
            if (callback) callback.apply(this, args);
        },

        /**
         *  导航到指定路由
         * */
        navigate: function (fragment, options) {
            Backbone.history.navigate(fragment, options);
            return this;
        },

        /**
         * 从后往前绑定路由
         * @private
         */
        _bindRoutes: function () {
            if (!this.routes) return;
            this.routes = _.result(this, 'routes');
            var route, routes = _.keys(this.routes);
            while ((route = routes.pop()) != null) {
                this.route(route, this.routes[route]);
            }
        },

        /**
         * 将路由转换成一个正则表达式
         * @param route     路由
         * @returns {RegExp}
         * @private
         */
        _routeToRegExp: function (route) {
            route = route.replace(escapeRegExp, '\\$&')
                .replace(optionalParam, '(?:$1)?')
                .replace(namedParam, function (match, optional) {
                    return optional ? match : '([^/?]+)';
                })
                .replace(splatParam, '([^?]*?)');
            return new RegExp('^' + route + '(?:\\?([\\s\\S]*))?$');
        },

        /**
         * 提取路由参数
         * @param route     路由
         * @param fragment  页面对象
         * @private
         */
        _extractParameters: function (route, fragment) {
            var params = route.exec(fragment).slice(1);
            return _.map(params, function (param, i) {
                if (i === params.length - 1) return param || null;
                return param ? decodeURIComponent(param) : null;
            });
        }

    });

    //  History模块
    var History = Backbone.History = function () {
        this.handlers = [];
        _.bindAll(this, 'checkUrl');

        /**
         *  判断当前执行环境是不是浏览器
         * */
        if (typeof window !== 'undefined') {
            this.location = window.location;
            this.history = window.history;
        }
    };

    // Cached regex for stripping a leading hash/slash and trailing space.
    var routeStripper = /^[#\/]|\s+$/g;

    // Cached regex for stripping leading and trailing slashes.
    var rootStripper = /^\/+|\/+$/g;

    // Cached regex for stripping urls of hash.
    var pathStripper = /#.*$/;

    //  标识history是否已经开始
    History.started = false;

    //  拓展History模块下的事件原型
    _.extend(History.prototype, Events, {

        //  定时器,轮询hash的改变
        interval: 50,

        /**
         * 是否在首页的位置
         * @returns {boolean}
         */
        atRoot: function () {
            var path = this.location.pathname.replace(/[^\/]$/, '$&/');
            return path === this.root && !this.getSearch();
        },

        /**
         *  判断url中是否含有查询字符串
         * */
        getSearch: function () {
            var match = this.location.href.replace(/#.*/, '').match(/\?.+/);
            return match ? match[0] : '';
        },

        /**
         * 获取当前url中的hash值
         * @param window    window对象
         * @returns {*}
         */
        getHash: function (window) {
            var match = (window || this).location.href.match(/#(.*)$/);
            return match ? match[1] : '';
        },

        /**
         * 获取当前url的路径
         * @returns {string}
         */
        getPath: function () {
            var path = decodeURI(this.location.pathname + this.getSearch());
            var root = this.root.slice(0, -1);
            if (!path.indexOf(root)) path = path.slice(root.length);
            return path.charAt(0) === '/' ? path.slice(1) : path;
        },

        // Get the cross-browser normalized URL fragment from the path or hash.
        getFragment: function (fragment) {
            if (fragment == null) {
                if (this._hasPushState || !this._wantsHashChange) {
                    fragment = this.getPath();
                } else {
                    fragment = this.getHash();
                }
            }
            return fragment.replace(routeStripper, '');
        },

        // Start the hash change handling, returning `true` if the current URL matches
        // an existing route, and `false` otherwise.
        start: function (options) {
            if (History.started) throw new Error('Backbone.history has already been started');
            History.started = true;

            // Figure out the initial configuration. Do we need an iframe?
            // Is pushState desired ... is it available?
            this.options = _.extend({root: '/'}, this.options, options);
            this.root = this.options.root;
            this._wantsHashChange = this.options.hashChange !== false;
            this._hasHashChange = 'onhashchange' in window;
            this._wantsPushState = !!this.options.pushState;
            this._hasPushState = !!(this.options.pushState && this.history && this.history.pushState);
            this.fragment = this.getFragment();

            // Normalize root to always include a leading and trailing slash.
            this.root = ('/' + this.root + '/').replace(rootStripper, '/');

            // Transition from hashChange to pushState or vice versa if both are
            // requested.
            if (this._wantsHashChange && this._wantsPushState) {

                // If we've started off with a route from a `pushState`-enabled
                // browser, but we're currently in a browser that doesn't support it...
                if (!this._hasPushState && !this.atRoot()) {
                    var root = this.root.slice(0, -1) || '/';
                    this.location.replace(root + '#' + this.getPath());
                    // Return immediately as browser will do redirect to new url
                    return true;

                    // Or if we've started out with a hash-based route, but we're currently
                    // in a browser where it could be `pushState`-based instead...
                } else if (this._hasPushState && this.atRoot()) {
                    this.navigate(this.getHash(), {replace: true});
                }

            }

            // Proxy an iframe to handle location events if the browser doesn't
            // support the `hashchange` event, HTML5 history, or the user wants
            // `hashChange` but not `pushState`.
            if (!this._hasHashChange && this._wantsHashChange && (!this._wantsPushState || !this._hasPushState)) {
                var iframe = document.createElement('iframe');
                iframe.src = 'javascript:0';
                iframe.style.display = 'none';
                iframe.tabIndex = -1;
                var body = document.body;
                // Using `appendChild` will throw on IE < 9 if the document is not ready.
                this.iframe = body.insertBefore(iframe, body.firstChild).contentWindow;
                this.iframe.document.open().close();
                this.iframe.location.hash = '#' + this.fragment;
            }

            // Add a cross-platform `addEventListener` shim for older browsers.
            var addEventListener = window.addEventListener || function (eventName, listener) {
                    return attachEvent('on' + eventName, listener);
                };

            // Depending on whether we're using pushState or hashes, and whether
            // 'onhashchange' is supported, determine how we check the URL state.
            if (this._hasPushState) {
                addEventListener('popstate', this.checkUrl, false);
            } else if (this._wantsHashChange && this._hasHashChange && !this.iframe) {
                addEventListener('hashchange', this.checkUrl, false);
            } else if (this._wantsHashChange) {
                this._checkUrlInterval = setInterval(this.checkUrl, this.interval);
            }

            if (!this.options.silent) return this.loadUrl();
        },

        // Disable Backbone.history, perhaps temporarily. Not useful in a real app,
        // but possibly useful for unit testing Routers.
        stop: function () {
            // Add a cross-platform `removeEventListener` shim for older browsers.
            var removeEventListener = window.removeEventListener || function (eventName, listener) {
                    return detachEvent('on' + eventName, listener);
                };

            // Remove window listeners.
            if (this._hasPushState) {
                removeEventListener('popstate', this.checkUrl, false);
            } else if (this._wantsHashChange && this._hasHashChange && !this.iframe) {
                removeEventListener('hashchange', this.checkUrl, false);
            }

            // Clean up the iframe if necessary.
            if (this.iframe) {
                document.body.removeChild(this.iframe.frameElement);
                this.iframe = null;
            }

            // Some environments will throw when clearing an undefined interval.
            if (this._checkUrlInterval) clearInterval(this._checkUrlInterval);
            History.started = false;
        },

        /**
         * 当页面显示内容发生变化,往路由前面插入一项
         * @param route     路由
         * @param callback  回调函数
         */
        route: function (route, callback) {
            this.handlers.unshift({route: route, callback: callback});
        },

        // Checks the current URL to see if it has changed, and if it has,
        // calls `loadUrl`, normalizing across the hidden iframe.
        checkUrl: function (e) {
            var current = this.getFragment();

            //  用户点击了后退按钮,iframe的hash也会随之发生变化,所以应该进行比较
            if (current === this.fragment && this.iframe) {
                current = this.getHash(this.iframe);
            }

            if (current === this.fragment) return false;
            if (this.iframe) this.navigate(current);
            this.loadUrl();
        },

        // Attempt to load the current URL fragment. If a route succeeds with a
        // match, returns `true`. If no defined routes matches the fragment,
        // returns `false`.
        loadUrl: function (fragment) {
            fragment = this.fragment = this.getFragment(fragment);
            return _.any(this.handlers, function (handler) {
                if (handler.route.test(fragment)) {
                    handler.callback(fragment);
                    return true;
                }
            });
        },

        // Save a fragment into the hash history, or replace the URL state if the
        // 'replace' option is passed. You are responsible for properly URL-encoding
        // the fragment in advance.
        //
        // The options object can contain `trigger: true` if you wish to have the
        // route callback be fired (not usually desirable), or `replace: true`, if
        // you wish to modify the current URL without adding an entry to the history.
        navigate: function (fragment, options) {
            if (!History.started) return false;
            if (!options || options === true) options = {trigger: !!options};

            // Normalize the fragment.
            fragment = this.getFragment(fragment || '');

            // Don't include a trailing slash on the root.
            var root = this.root;
            if (fragment === '' || fragment.charAt(0) === '?') {
                root = root.slice(0, -1) || '/';
            }
            var url = root + fragment;

            // Strip the hash and decode for matching.
            fragment = decodeURI(fragment.replace(pathStripper, ''));

            if (this.fragment === fragment) return;
            this.fragment = fragment;

            // If pushState is available, we use it to set the fragment as a real URL.
            if (this._hasPushState) {
                this.history[options.replace ? 'replaceState' : 'pushState']({}, document.title, url);

                // If hash changes haven't been explicitly disabled, update the hash
                // fragment to store history.
            } else if (this._wantsHashChange) {
                this._updateHash(this.location, fragment, options.replace);
                if (this.iframe && (fragment !== this.getHash(this.iframe))) {
                    // Opening and closing the iframe tricks IE7 and earlier to push a
                    // history entry on hash-tag change.  When replace is true, we don't
                    // want this.
                    if (!options.replace) this.iframe.document.open().close();
                    this._updateHash(this.iframe.location, fragment, options.replace);
                }

                // If you've told us that you explicitly don't want fallback hashchange-
                // based history, then `navigate` becomes a page refresh.
            } else {
                return this.location.assign(url);
            }
            if (options.trigger) return this.loadUrl(fragment);
        },

        /**
         * 更新浏览器地址栏的哈希值
         * @param location  location对象
         * @param fragment
         * @param replace   替换字符串
         * @private
         */
        _updateHash: function (location, fragment, replace) {
            if (replace) {
                var href = location.href.replace(/(javascript:|#).*$/, '');
                location.replace(href + '#' + fragment);
            } else {
                //  直接用location.hash修改hash值
                location.hash = '#' + fragment;
            }
        }

    });

    // History模块
    Backbone.history = new History;

    /**
     * 继承
     * @param protoProps    原型属性
     * @param staticProps   静态属性
     * @returns {*}
     */
    var extend = function (protoProps, staticProps) {
        var parent = this;
        var child;

        //  原型属性中包含constructor,修改子类的构造方法
        if (protoProps && _.has(protoProps, 'constructor')) {
            child = protoProps.constructor;
        } else {
            child = function () {
                return parent.apply(this, arguments);
            };
        }

        //  添加静态属性
        _.extend(child, parent, staticProps);

        //  原型继承
        var Surrogate = function () {
            this.constructor = child;
        };
        Surrogate.prototype = parent.prototype;
        child.prototype = new Surrogate;

        //  拓展子类的原型
        if (protoProps) _.extend(child.prototype, protoProps);

        //  指定子类的__spuer__为父类的原型属性
        child.__super__ = parent.prototype;

        return child;
    };

    //  设置Model/Collection/Router/View/History的继承属性
    Model.extend = Collection.extend = Router.extend = View.extend = History.extend = extend;

    //  url异常函数封装
    var urlError = function () {
        throw new Error('A "url" property or function must be specified');
    };

    // 错误信息包装
    var wrapError = function (model, options) {
        var error = options.error;
        options.error = function (resp) {
            if (error) error(model, resp, options);
            model.trigger('error', model, resp, options);
        };
    };

    return Backbone;

}));
