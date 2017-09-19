//Add package
const OdooApi = require('./OdooApi.js');

//Create instance of the scraper
var instance = new OdooApi({
    "nameSuffix": "-test", // used for log
    "callQueueTimer": 250, // processes a request every 250ms
    "maxRecordsPerCall": 200, //how many records max requested per query, if you query more, it will be fetched recursively
    "url": "odoo.com", // domain of your odoo instance
    "port": 80, //port of your odoo instance
    "protocol": "http", //protocol used for odoo instance 
    "db": 'TEST_DB', //db of your odoo instance
    "username": "username", //user to use
    "password": "password" //pass for this user
});

//test function
async function test() {
    try {
        //get models
        var results = await instance.getModelByFilters(
            'sale.order', //data model
            [], //filters for search
            ['id', 'name', 'state'], //fields to retrieve
            0, //offset for records
            2, //limit of records to pull
            false //sorting
        );
        console.log(results);

        var results = await instance.getModelByFilters(
            'mail.message', //data model
            [
                ['message_type', '=', 'comment'],
                ['channel_ids', '=', 49],
            ], //filters for search
            ['author_id', 'date', 'body', 'message_type', 'channel_ids'], //fields to retrieve
            0, //offset for records
            2, //limit of records to pull
            'date desc' //sorting
        );
        console.log(results);
    } catch (err) {
        console.log(err);
    }
}
test();