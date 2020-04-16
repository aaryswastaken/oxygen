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