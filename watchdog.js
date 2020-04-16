exports.Watchdog = class {
    constructor(collection, period, sort, limit, callback) {
        this.collection = collection;
        this.object = {};
        this.period = period;
        this.callback = callback;
        this._stop = false;
        this.sort = sort
        this.limit = limit
    }

    start() {
        this._stop = false;
        this.check();
    }

    stop() {
        this._stop = true;
    }

    check = () => {
        if(!this._stop) {
            setTimeout(this.check, this.period);
        }

        this.collection.find().sort(this.sort).limit(this.limit).toArray().then(object => {
            if(JSON.stringify(object) !== JSON.stringify(this.object)) {
                this.callback(object);
                //console.log("Before : "+JSON.stringify(this.object));
                //console.log("After : "+JSON.stringify(object));
            }

            this.object = object;
        });
    }
}

exports.cleaner = class {
    constructor(collection, period, selfilter, delfilter, condition, callback) {
        this.collection = collection
        this.period = period
        this.condition = condition
        this.callback = callback
        this.selfilter = selfilter
        this.delfilter = delfilter
        this._stop = true
    }

    start() {
        this._stop = false
        this.check()
    }

    stop() {
        this._stop = true
    }

    check = () => {
        if(!this._stop) {
            //console.log("Programmed for "+this.period)
            setTimeout(this.check, this.period)
        }

        /*this.collection.find(this.selfilter).toArray().then(object => {
            if(this.condition(object)) {
                this.collection.deleteMany(this.delfilter, this.callback)
            }
        })*/

        var first;

        this.collection.find(this.selfilter).sort({"date": 1}).toArray().then(object => {
            if(this.condition(object)) {
                if (object.length !== 0) {
                    first = object[0].date;
                    // console.log("First ID : " + first.toString())
                    // console.log("this.delfilter.count : "+this.delfilter.count.toString());
                    // console.log("firstId + this.delfilter.count : "+ (first + this.delfilter.count).toString());

                    this.collection.find({"date": {"$lt": first + this.delfilter.count}}).toArray().then(object => {
                        // console.log("object.length : "+object.length.toString());
                        this.collection.deleteMany({"date": {"$lt": first + this.delfilter.count}}, this.callback);
                    });
                } else {
                    console.log("hello ")
                }
            }
        });
    }
}