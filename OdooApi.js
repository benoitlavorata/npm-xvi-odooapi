const Helper = require('xvi-helper');
const Logger = require('xvi-logger');
const OdooXmlrpc = require('odoo-xmlrpc');

class OdooApi {
    constructor(opts = {}) {
        var self = this;
        self._name = 'OdooApi' + (opts.nameSuffix ? opts.nameSuffix : '');

        self._helper = new Helper();
        self._logger = new Logger({
            name: self._name,
            logName: self._name,
            indent: 4,
        });

        self._callQueue = [];
        self._callQueueTimer = opts.callQueueTimer ? opts.callQueueTimer : 250;
        self._maxRecordsPerCall = opts.maxRecordsPerCall ? opts.maxRecordsPerCall : 200;
        self._isConnected = false;
        self._protocol = opts.protocol ? opts.protocol : false;
        self._url = opts.url ? opts.url : false;
        self._port = opts.port ? opts.port : 80;
        self._db = opts.db ? opts.db : false;
        self._username = opts.username ? opts.username : false;
        self._password = opts.password ? opts.password : false;

        if (self.canStart(true)) {
            //odoo web api
            self._odoo = new OdooXmlrpc({
                url: self.protocol + '://' + self._url,
                port: self._port,
                db: self._db,
                username: self._username,
                password: self._password
            });
            self.setCallQueueProcessor();
        } else {
            return self.error(`error.instanceCannotStart`, self._name);
        }
    }

    canStart(init = false) {
        var self = this;
        var can = true;

        if (!self._url || !self._port || !self._db || !self._username || !self._password) {
            can = false;
        }

        if (init) {
            self._logger.debug(`canStart = ${can}`);
        }
        return can;
    }

    async error(messageString = false, p1 = false, p2 = false, p3 = false, locale = false) {
        var self = this;
       // var localizedMessage = self._e(messageString, p1, p2, p3, locale);
        self._logger.error(messageString);
        throw new Error(messageString);
    }

    _e(messageString = false, p1 = false, p2 = false, p3 = false, locale = false) {
        var self = this;
        //return self._localizer._e(messageString, p1, p2, p3, locale);
    }

    setCallQueueProcessor() {
        var self = this;
        //self._logger.func(`setCallQueueProcessor`);
        setInterval(function () {
            if (self._callQueue.length > 0) {
                self.makeCall();
            }
        }, self._callQueueTimer);
    }

    makeCall() {
        var self = this;
        //self._logger.func(`makeCall`);
        if (self._callQueue[0]) {
            if (self[self._callQueue[0].method]) {
                self[self._callQueue[0].method](self._callQueue[0].query, self._callQueue[0].resolve, self._callQueue[0].reject);
            }
            self._callQueue.shift();
        }
    }

    //QUERY BUILDER
    buildOdooQuery(model, fields, filters, method, offset, limit, order, context) {
        var self = this;
        // //self._logger.func('buildOdooQuery');
        var inParams = [];
        inParams.push(filters); //"FP.MI.SLME_0062"
        inParams.push(fields); //fields 'product_qty', 'routing_id', 'fal_is_bom_template',
        inParams.push(offset); //offset
        inParams.push(limit); //limit
        if (order) {
            inParams.push(order); //order
        }
        var params = [];
        params.push(inParams);
        return {
            model: model,
            method: method,
            params: params
        };
    }

    buildOdooCreateQuery(record, model) {
        var self = this;
        // //self._logger.func('buildOdooCreateQuery');
        var inParams = [];
        inParams.push(record);
        var params = [];
        params.push(inParams);

        //self._logger.debugData(params);
        return {
            model: model,
            method: 'create',
            params: params
        };
    }

    buildOdooUpdateQuery(id, record, model) {
        var self = this;
        //self._logger.func('buildOdooUpdateQuery');
        var inParams = [];
        inParams.push([id]); //id to update
        inParams.push(record);
        var params = [];
        params.push(inParams);
        return {
            model: model,
            method: 'write',
            params: params
        };
    }

    async queueQuery(query) {
        var self = this;
        return new Promise(function (resolve, reject) {
            self._callQueue.push({
                query: query,
                method: 'executeQuery',
                resolve: resolve,
                reject: reject
            });
        });
    }

    async executeQuery(query, resolve, reject) {
        var self = this;
        self._odoo.execute_kw(query.model, query.method, query.params, function (err, value) {
            if (err) {
                reject(err);
            } else {
                resolve(value);
            }
        });
    }

    //CALLS TO WEB API
    async connectOdoo() {
        var self = this;
        return new Promise(function (resolve, reject) {
            if (!self._connected) {
                //self._logger.journalEntry('CONNECT-DB', `About to connect to odoo.`, {});
                self._odoo.connect(function (err) {
                    if (err) {
                        self._logger.warn('!! Error when connecting to Odoo server');
                        reject(err);
                    } else {
                        self._logger.info('Connected to Odoo server.');
                        self._connected = true;
                        setTimeout(function () {
                            self._connected = false;
                            self._logger.debug('Odoo connection timeout, will reconnect on next attempt.');
                        }, 1000 * 60 * 1);
                        resolve();
                    }
                });
            } else {
                //self._logger.debug('Already connected to odoo - skip reconnect');
                resolve();
            }
        });
    }

    async updateModel(model, item) {
        var self = this;
        //self._logger.func('updateModel: ' + model);

        try {
            await self.connectOdoo();

            var dataToUpdate = self._helper.deepcopy(item);
            delete dataToUpdate.id;
            var updateQuery = self.buildOdooUpdateQuery(item.id, dataToUpdate, model);

            //execute
            let success = await self.queueQuery(updateQuery);
            self._logger.info('updateModel: updated ' + model + ' ' + item.id);
            return item.id;
        } catch (err) {
            self._logger.warn(`Failed to update model ${model}`);
            throw new Error(err);
        }

    }

    async insertModel(model, item) {
        var self = this;
        //self._logger.func('insertModel: ' + model);

        try {
            await self.connectOdoo();
            var myCreateQuery = self.buildOdooCreateQuery(item, model);
            console.log(myCreateQuery);
            //execute
            let newItemId = await self.queueQuery(myCreateQuery);
            self._logger.info('insertModel: Inserted ' + model + ' ' + newItemId);
            return newItemId;

        } catch (err) {
            self._logger.warn(`Failed to insert model ${model}`);
            throw new Error(err);
        }
    }

    async getModelByFilters(model = false, filters = [], fields = ['name'], offset = 0, limit = 100, sorting = false) {
        var self = this;
        self._logger.func(`getModelByFilters: ${model}, ${JSON.stringify(filters)}`); //${JSON.stringify(fields)}

        var countLoops = Math.ceil(limit / self._maxRecordsPerCall);

        try {
            let results = await self._getModelsByFiltersRecursive(model, filters, fields, offset, limit, sorting, 0, countLoops);
            return results;
        } catch (err) {
            self._logger.warn(`Failed to getModelByFilters ${model}`);
            throw new Error(err);
        }
    }

    async _getModelsByFiltersRecursive(model, filters, fields = ['name'], offset = 0, limit = 10, sorting = false, index = 0, countLoops = 1) {
        var self = this;
        // self._logger.verbose('_getModelsByFiltersRecursive: ' + `model ${model} / filters ${filters} / fields ${fields} / offset ${offset} / limit ${limit} / index ${index} / countLoops ${countLoops}`);

        try {
            if (index < countLoops) {
                var _offset = offset + self._maxRecordsPerCall * index;

                //check if we still have enough records to pull
                var recordsToPullAfterThis = limit - self._maxRecordsPerCall * (index + 1);
                var recordsAlreadyPulled = self._maxRecordsPerCall * (index);
                if (recordsToPullAfterThis < 0) {
                    var _limit = limit - recordsAlreadyPulled;
                } else {
                    var _limit = self._maxRecordsPerCall;
                }

                // self._logger.verbose(`recordsAlreadyPulled ${recordsAlreadyPulled}`);
                // self._logger.verbose(`recordsToPullAfterThis ${recordsToPullAfterThis}`);
                //  self._logger.verbose('Will pull : ' + `model ${model} / _offset ${_offset} / _limit ${_limit}`);

                //connect to odoo
                await self.connectOdoo();
                var myQuery = self.buildOdooQuery(model, fields, filters, 'search_read', _offset, _limit, sorting);

                //execute
                var data = await self.queueQuery(myQuery);

                //  self._logger.verbose('getModelsByFilters: OK (model: ' + model + ')'); //JSON.stringify(filters)

                if (limit > 1) {
                    // self._logger.verbose('Pulled  : ' + data.length + 2);

                    if (data.length === 0) {
                        //we already pulled all
                        return data;
                    } else {
                        //there is more to pull
                        var subData = await self._getModelsByFiltersRecursive(model, filters, fields, offset, limit, sorting, index + 1, countLoops);
                        if (subData) {
                            data = data.concat(subData);
                        }
                        return data;
                    }
                } else {
                    return data;
                }
            } else {
                // self._logger.verbose('Finished all loops');
                return [];
            }
        } catch (err) {
            //self._logger.warn(`Failed to _getModelsByFiltersRecursive ${model}`);
            throw new Error(err);
        }
    }
}

module.exports = OdooApi;