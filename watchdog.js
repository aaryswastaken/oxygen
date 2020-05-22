// WATCHDOG CLASS DEFINITION

// Watchdog
exports.Watchdog = class {
    constructor(collection, period, sort, limit, callback) {
        this.collection = collection; // Collection to listen on
        this.object = {}; // AKA "lastValues"
        this.period = period; // Period, in ms o check
        this.callback = callback; // Callback when there is a change
        this._stop = true; // Inversed state of the listening (false -> on ; true -> off)
        this.sort = sort; // Sort used
        this.limit = limit; // Limit to the query
    }

    start() { // Start
        this._stop = false; // Running
        this.check(); // Start the loop
    }

    stop() { // Stop
        this._stop = true; // Stop the loop
    }

    check = () => { // "Runner"
        if(!this._stop) { // If running
            setTimeout(this.check, this.period); // Call itself in [PERIOD]
        }

        this.collection.find().sort(this.sort).limit(this.limit).toArray().then(object => { // Get a dump of the listened collections
            if(JSON.stringify(object) !== JSON.stringify(this.object)) { // Is there any difference from the last values ?
                this.callback(object); // If yes : execute the callback w/ the recent dump
                //console.log("Before : "+JSON.stringify(this.object));
                //console.log("After : "+JSON.stringify(object));
            }

            this.object = object; // Update to be last values next time
        });
    }
}

// Cleaner
exports.cleaner = class {
    constructor(collection, period, selfilter, delfilter, condition, callback) {
        this.collection = collection; // Collection to listen on
        this.period = period; // Period at which he listen
        this.condition = condition; // Boolean function called to know when to delete
        this.callback = callback; // Void function when data is deleted
        this.selfilter = selfilter; // Selection Filter
        this.delfilter = delfilter; // Delete filter
        this._stop = true; // Same as watchdog
    }

    start() { // Start
        this._stop = false; // Running
        this.check(); // Start the loop
    }

    stop() { // Stop
        this._stop = true; // Break the loop
    }

    check = () => { // Runner
        if(!this._stop) { // If running
            setTimeout(this.check, this.period); // Call itself in [PERIOD]
        }

        /*this.collection.find(this.selfilter).toArray().then(object => {
            if(this.condition(object)) {
                this.collection.deleteMany(this.delfilter, this.callback)
            }
        })*/

        var first;

        this.collection.find(this.selfilter).sort({"date": 1}).toArray().then(object => { // Dump all the collection with matching filter
            if(this.condition(object)) {  // Execute boolean function and wait the return
                if (object.length !== 0) { // If exist
                    first = object[0].date; // First #ID
                    // console.log("First ID : " + first.toString())
                    // console.log("this.delfilter.count : "+this.delfilter.count.toString());
                    // console.log("firstId + this.delfilter.count : "+ (first + this.delfilter.count).toString());

                    this.collection.find({"date": {"$lt": first + this.delfilter.count}}).toArray().then(object => { // Find in collection with matching filter
                        // console.log("object.length : "+object.length.toString());
                        this.collection.deleteMany({"date": {"$lt": first + this.delfilter.count}}, this.callback); // Delete
                    });
                }
            }
        });
    }
}