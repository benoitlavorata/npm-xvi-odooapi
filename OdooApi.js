const Logger = require('xvi-logger');
const Helper = require('xvi-helper');
const OdooCoreApi = require('xvi-odooapi-core');
const readDirFiles = require('read-dir-files');
const moment = require('moment-timezone');
const del = require('del');

class OdooApi {
    constructor({
        name = 'OdooApi',
        loggerInstance = false,
        url = false,
        port = false,
        protocol = false,
        db = false,
        username = false,
        password = false,
        dateFormat = 'YYYYMMDD HH:mm:ss',
        queueTimer = 250,
        maxRecordsPerCall = 200,
        timezone = "Asia/Hong_Kong",
        handler = false,
        cacheFolder = false,
        cacheTimer = 10000,
        cacheLoopTimer = 1000,
        cleanCacheLoop = true,
        cache = false
    }) {
        var self = this;
        self._arguments = arguments[0]; //store arguments
        self._name = name; //name of instance

        self._logger = new Logger({
            name: self._name,
            instance: loggerInstance
        });
        self._helper = new Helper();

        self._callQueueTimer = queueTimer;
        self._maxRecordsPerCall = maxRecordsPerCall;
        self._protocol = protocol;
        self._url = url;
        self._port = port;
        self._db = db;
        self._username = username;
        self._password = password;
        self._dateFormat = dateFormat;
        self._timezone = timezone;
        self._cache = cache;
        self._cacheTimer = cacheTimer;
        self._cacheLoopTimer = 1000;
        self._cacheFolder = cacheFolder;
        self._cleanCacheLoop = cleanCacheLoop;
        self._cacheMemory = {};
        self.exportMethodsToHandler(handler);
    }

    exportMethodsToHandler(handler) {
        var self = this;
        self._logger.func('exportMethodsToHandler');

        handler['gDateFormat'] = function () {
            return self.gDateFormat();
        }
        handler['gTimeZone'] = function () {
            return self.gTimeZone();
        }
        handler['format_many2one'] = function (ids = []) {
            return self.format_many2one(ids);
        }
        handler['updateModel'] = async function (model, item) {
            return self.updateModel(model, item);
        }
        handler['insertModel'] = async function (model, item) {
            return self.insertModel(model, item);
        }
        handler['getModelByFilters'] = async function (model = false, filters = [], fields = ['name'], offset = 0, limit = 100, sorting = false, cached = true, cacheTimer = false) {
            return self.getModelByFilters(model, filters, fields, offset, limit, sorting, cached, cacheTimer);
        }

        handler['executeWorkflow'] = async function (id, model, action, additional = []) {
            return self.executeWorkflow(id, model, action, additional);
        }
        handler['actionModelByFilters'] = async function (action = false, model = false, filters = false, comparefields = false, validateCb = false, compareCb = false) {
            return self.actionModelByFilters(action, model, filters, comparefields, validateCb, compareCb);
        }
    }

    async getCache(key = false) {
        var self = this;

        if (!self._cache)
            return false;

        if (self._cacheFolder) {
            //check for files with this key in this folder
            var path = `${self._cacheFolder}/${key}.json`;
            try {
                var data = await self._helper.readJson(path);
                self._logger.debug('Served Cache: ' + key);
                return JSON.parse(data);
            } catch (err) {
                //console.log(err); //do not block
                return false;
            }
        } else {
            //cache is in memory, check array
            return self._cacheMemory[key] ? self._cacheMemory[key] : false;
        }
        return false;
    }

    async getFileList(path = false) {
        var self = this;
        self._logger.func(`getFileList`);
        if (!path)
            return false;

        return new Promise(res => {
            readDirFiles.list(path, function (err, filenames) {
                if (err) return console.dir(err);
                res(filenames);
            });
        })
    }

    async cleanCacheLoop() {
        var self = this;
        if (!self._cache)
            return false;
        self._logger.func('cleanCacheLoop');

        self._cacheLoop = setInterval(async function () {
            self._logger.info('cleanCacheLoop: check');
            if (self._cacheFolder) {
                try {
                    //get all files cached
                    var files = await self.getFileList(self._cacheFolder);

                    //chck for each if we need to remove
                    for (var index = 0; index < files.length; index++) {
                        var path = files[index]; //`${self._cacheFolder}/${key}.json`;
                        if (self._helper.containsStr('.json', path)) {
                            try {
                                var data = await self._helper.readJson(path);
                                data = JSON.parse(data);

                                //must remove
                                if (moment().diff(moment(data.date), 'ms') > data.expiration) {
                                    await del.sync([path]);
                                    //self._logger.debug('Removed Cache after ' + (data.expiration / 1000) + 's : ' + data.key);
                                }
                            } catch (err) {
                                // console.log(err); //do not block
                                //return false;
                            }
                        }
                    }
                    return true;
                } catch (err) {
                    //console.log(err) //do not block
                    //self._logger.debug('Cannot remove cache: ' + key);
                    return false;
                }
            } else {
                Object.keys(self._cacheMemory).map(k => {
                    try {
                        if (moment().diff(moment(self._cacheMemory[k].date), 'ms') > self._cacheMemory[k].expiration) {
                            // self._logger.debug('Removed Cache after ' + (self._cacheMemory[k].expiration / 1000) + 's : ' + self._cacheMemory[k].key);
                            delete self._cacheMemory[k];
                        }
                    } catch (err) {
                        // console.log(err); //do not block
                    }
                });
                return true;
            }
        }, self._cacheLoopTimer)

        return true;
    }

    async cleanAllCache() {
        var self = this;
        if (!self._cache)
            return false;
        self._logger.func('cleanAllCache');

        if (self._cacheFolder) {
            try {
                //get all files cached
                var files = await self.getFileList(self._cacheFolder);
                for (var index = 0; index < files.length; index++) {
                    var path = files[index]; //`${self._cacheFolder}/${key}.json`;
                    if (self._helper.containsStr('.json', path)) {
                        try {
                            await del.sync([path]);
                        } catch (err) {
                            //  console.log(err); //do not block
                            //return false;
                        }
                    }
                }
            } catch (err) {
                //  console.log(err)
            }
        } else {
            self._cacheMemory = {};
        }

        return true;
    }

    async setCache(key, data = false, expiration = false) {
        var self = this;
        if (!self._cache || !data)
            return false;

        var expiration = expiration ? expiration : self._cacheTimer;

        // self._logger.func('setCache', key);
        if (self._cacheFolder) {
            //write in file
            var path = `${self._cacheFolder}/${key}.json`;
            await self._helper.writeJson(path, JSON.stringify({
                date: moment().format(),
                key: key,
                expiration: expiration,
                data: data
            }));
        } else {
            //cache is in memory, check array
            self._cacheMemory[key] = {
                date: moment().format(),
                key: key,
                expiration: expiration,
                data: data
            };
        }
        return true;
    }

    gDateFormat() {
        var self = this;
        return self._dateFormat;
    }

    gTimeZone() {
        var self = this;
        return self._timezone;
    }

    format_many2one(ids = []) {
        return (ids.length > 0) ? [4, ids] : false;
    }

    async initialize() {
        var self = this;
        self._logger.func('initialize')
        self._odooApi = new OdooCoreApi({
            name: `CAPI`,
            loggerInstance: self._logger,
            url: self._url,
            port: self._port,
            protocol: self._protocol,
            db: self._db,
            username: self._username,
            password: self._password,
            dateFormat: self._dateFormat,
            queueTimer: self._queueTimer,
            maxRecordsPerCall: self._maxRecordsPerCall
        });

        if (self._cleanCacheLoop) {
            await self.cleanCacheLoop();
            await self.cleanAllCache();
        }

        await self._odooApi.initialize();
    }

    //METHODS FROM ODOOCORE API
    //UPDATE ANY MODEL IN DB DEPENDING ON USER RIGHTS
    async updateModel(model, item) {
        var self = this;
        // self._logger.func('updateModel', model);
        return self._odooApi.updateModel(model, item);
    }

    //INSERT ANY MODEL IN DB DEPENDING ON USER RIGHTS
    async insertModel(model, item) {
        var self = this;
        //self._logger.func('insertModel', model);
        return self._odooApi.insertModel(model, item);
    }

    //GET ANY MODEL IN DB DEPENDING ON USER RIGHTS
    async getModelByFilters(model = false, filters = [], fields = ['name'], offset = 0, limit = 100, sorting = false, cached = false, cacheTimer = false) {
        var self = this;
        // self._logger.func(`getModelByFilters`, `${model}`); //${JSON.stringify(filters)}
        if (self._cache && cached) {
            var key = self._helper.md5(JSON.stringify({
                model: model,
                filters: filters,
                fields: fields,
                offset: offset,
                limit: limit,
                sorting: sorting
            }));

            var cache = await self.getCache(key);
            if (cache)
                return cache;

            var data = await self._odooApi.getModelByFilters(model, filters, fields, offset, limit, sorting);
            await self.setCache(key, data, cacheTimer);
            return data;
        } else {
            return self._odooApi.getModelByFilters(model, filters, fields, offset, limit, sorting);
        }
    }

    //Execute workflow
    async executeWorkflow(id, model, action, additional = []) {
        var self = this;
        // self._logger.func('execute', `${action} on ${model}#${id}`);
        return self._odooApi.executeWorkflow(id, model, action, additional);
    }

    async actionModelByFilters(action = false, model = false, filters = false, comparefields = false, validateCb = false, compareCb = false) {
        var self = this;
        //self._logger.func(`actionModelByFilters`, `${action} ${model} matching ${JSON.stringify(filters)}`);
        return self._odooApi.actionModelByFilters(action, model, filters, comparefields, validateCb, compareCb)
    }

}

module.exports = OdooApi;