const Logger = require('xvi-logger');
const Helper = require('xvi-helper');
const OdooCoreApi = require('xvi-odooapi-core');

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
        handler['getModelByFilters'] = async function (model = false, filters = [], fields = ['name'], offset = 0, limit = 100, sorting = false) {
            return self.getModelByFilters(model, filters, fields, offset, limit, sorting);
        }

        handler['executeWorkflow'] = async function (id, model, action, additional = []) {
            return self.executeWorkflow(id, model, action, additional);
        }
        handler['actionModelByFilters'] = async function (action = false, model = false, filters = false, comparefields = false, validateCb = false, compareCb = false) {
            return self.actionModelByFilters(action, model, filters, comparefields, validateCb, compareCb);
        }
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
    async getModelByFilters(model = false, filters = [], fields = ['name'], offset = 0, limit = 100, sorting = false) {
        var self = this;
       // self._logger.func(`getModelByFilters`, `${model}`); //${JSON.stringify(filters)}
        return self._odooApi.getModelByFilters(model, filters, fields, offset, limit, sorting);
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