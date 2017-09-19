# npm-xvi-odooApi
Odoo Web Api wrapper built on top of odoo-xmlrpc module. 
Works full in async, make sure to throttle number of requests sent per seconds to Odoo instance to avoid congestion (if too many requests, actions are queued and executed when possible).
Data is retrieved recursively to avoid pulling too much data at once which could be slow, supports offset/limit (pagination).

```javascript
//Add package
const OdooApi = require('xvi-odooapi');

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
```

Will output:
```
170919-094106 |         debug.OdooApi-test | canStart = true
170919-094106 |         debug.OdooApi-test | getModelByFilters: mail.message, [["message_type","=","comment"],["channel_ids","=",49]]
client normal
170919-094107 |         info.OdooApi-test | Connected to Odoo server.
[ { body: '<p>...</p>',
    channel_ids: [ 49 ],
    date: '2017-08-18 06:56:03',
    author_id: [ 1, '...' ],
    message_type: 'comment',
    id: 110575 },
  { body: '<p>help</p>',
    channel_ids: [ 49 ],
    date: '2017-08-18 06:56:01',
    author_id: [ 2, 'Benoit LAVORATA' ],
    message_type: 'comment',
    id: 110574 } ]
170919-094107 |         debug.OdooApi-test | getModelByFilters: sale.order, []
[ { state: 'sale', id: 1045, name: 'XXX.17-0623' },
  { state: 'sale', id: 1040, name: 'XXX.17-0626' } ]
```