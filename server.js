const express = require("express");
const app = express();

const fs = require("fs");

var settings = JSON.parse(fs.readFileSync("./settings.json"));
var cred = JSON.parse(fs.readFileSync("./credentials.json"));

console.log(JSON.stringify(cred));

const url = require("url");
var queryString = require("querystring");

const mongodb = require("mongodb");
var MongoClient = mongodb.MongoClient;

const watchdog = require("./watchdog");
var watchdogs = [];
var cleaners = [];

var dburl = `mongodb://${cred.db.connection.user}:${cred.db.connection.password}@${cred.db.connection.ip}:${cred.db.connection.port}/`;

console.log(dburl)

var data = {};

var database;

MongoClient.connect(dburl, function(err, db) {
    if (err) {
        console.log("Error : "+err);
    }

    var oxymetre = db.db(cred.db.db.name);
    database = oxymetre;

    console.log(cred.db.db.name);

    oxymetre.collection(cred.db.db.ressources.users).find().toArray().then(t => {
        t.forEach(e => {
            //console.log(e.id + " " + e.name);
        });
        data.users = t;
    });

    var wtch = new watchdog.Watchdog(oxymetre.collection(cred.db.db.ressources.users), settings["database.period"], {"id": 1}, settings["database.limit"], object => {
        //console.log("Users : changed !");
    });
    wtch.start();
    watchdogs.push(wtch);

    wtch = new watchdog.Watchdog(oxymetre.collection(cred.db.db.ressources.data), settings["database.period"], {"date": -1}, settings["database.limit"], object => {
        var temp = [];
        var ids = [];
        //console.log("Oxymetre : changed !");
        object.forEach(e => {
            if(ids.includes(e.id)) {
                if(temp[e.id].date < e.date) {
                    temp[e.id] = e;
                }
            } else {
                ids.push(e.id);
                temp[e.id] = e;
            }
        });

        // console.log(temp);

        data.state = temp;
    });
    wtch.start();
    watchdogs.push(wtch);

    console.log(settings["database.cleaner.data.period"])



    var cleaner = new watchdog.cleaner(
        oxymetre.collection(cred.db.db.ressources.data),
        settings["database.cleaner.data.period"],
        {},
        {"count": 15000},
        (object) =>{
            return object.length > 150000},
        (err, obj) => {
            console.log("[data] " + obj.result.n.toString() + " entry deleted")
        }); // 1000 (s) * 1000 = (ms)
    cleaner.start();
    cleaners.push(cleaner);

    wtch = new watchdog.Watchdog(oxymetre.collection(cred.db.db.ressources.OXYalerts), settings["database.period"], {"date": -1}, settings["database.limit"]*1000, object => { // *1000 -> no false errors
        var temp = [];
        var ids = [];
        //console.log("OXYalerts : changed !");
        object.forEach(e => {
            if(ids.includes(e.id)) {
                if(temp[e.id].date < e.date) {
                    temp[e.id] = e;
                }
            } else {
                ids.push(e.id);
                temp[e.id] = e;
            }
        });

        // console.log(temp);

        data.OXYalerts = temp;
    });
    wtch.start();
    watchdogs.push(wtch);

    wtch = new watchdog.Watchdog(oxymetre.collection(cred.db.db.ressources.pulse), settings["database.period"], {"date": -1}, settings["database.limit"]*1000, object => { // *1000 -> no false errors
        var temp = [];
        var ids = [];
        //console.log("OXYalerts : changed !");
        object.forEach(e => {
            if(ids.includes(e.id)) {
                if(temp[e.id].date < e.date) {
                    temp[e.id] = e;
                }
            } else {
                ids.push(e.id);
                temp[e.id] = e;
            }
        });

        // console.log(temp);

        data.pulse = temp;
    });
    wtch.start();
    watchdogs.push(wtch);

    var cleaner = new watchdog.cleaner(
        oxymetre.collection(cred.db.db.ressources.pulse),
        settings["database.cleaner.data.period"],
        {},
        {"count": 15000},
        (object) =>{
            return object.length > 150000},
        (err, obj) => {
            console.log("[data] " + obj.result.n.toString() + " entry deleted")
        }); // 1000 (s) * 1000 = (ms)
    cleaner.start();
    cleaners.push(cleaner);

    wtch = new watchdog.Watchdog(oxymetre.collection(cred.db.db.ressources.PULSEalerts), settings["database.period"], {"date": -1}, settings["database.limit"]*1000, object => { // *1000 -> no false errors
        var temp = [];
        var ids = [];
        //console.log("OXYalerts : changed !");
        object.forEach(e => {
            if(ids.includes(e.id)) {
                if(temp[e.id].date < e.date) {
                    temp[e.id] = e;
                }
            } else {
                ids.push(e.id);
                temp[e.id] = e;
            }
        });

        // console.log(temp);

        data.PULSEalerts = temp;
    });
    wtch.start();
    watchdogs.push(wtch);

    wtch = new watchdog.Watchdog(oxymetre.collection(cred.db.db.ressources.alertsConfig), 10, {}, settings["database.limit"]*1000, object => { // *1000 -> no false errors
        var temp = {"oxy": [], "pulse": []};
        //console.log("OXYalerts : changed !");
        object.forEach(e => {
            switch(e.category) {
                case 1:
                    temp.oxy.push(e);
                    break;
                case 2:
                    temp.pulse.push(e)
            }
        });

        // console.log(temp);

        data.alertProfiles = temp;
    });
    wtch.start();
    watchdogs.push(wtch);
});

console.log("Finished");

function process(object) {
    var response = [];

    object.users.forEach(e => {
        if(!(e === null)) {
            var obj = e;

            object.state.forEach(state => {
                if(state.id === obj.id) {
                    obj.concentration = state.concentration;
                    obj.date = state.date;
                }
            });

            object.OXYalerts.forEach(alert => {
                if(alert.id === obj.id) {
                    obj.OXYlevel = alert.level;
                }
            })

            object.pulse.forEach(pulse => {
                if(pulse.id === obj.id) {
                    obj.pulsation = pulse.pulsation;
                }
            })

            object.PULSEalerts.forEach(pulse => {
                if(pulse.id === obj.id) {
                    obj.PULSElevel = pulse.level;
                }
            })

            response.push(obj);
        }
    });

    return response
}

function dumpDBfromURL(url, callback) {
    var split = url.split("?");
    var id = 1;
    if(split.length === 2) {
        id = parseInt(split[1]);
    }
    var toSend = {};
    database.collection(cred.db.db.ressources.users).find({"id": id}).toArray().then( a => {
        toSend.users = a;
        database.collection(cred.db.db.ressources.data).find({"id": id}).sort({"date": -1}).toArray().then( a => {
            toSend.oxymeter = a;
            database.collection(cred.db.db.ressources.pulse).find({"id": id}).sort({"date": -1}).toArray().then( a => {
                toSend.pulse = a;
                database.collection(cred.db.db.ressources.OXYalerts).find({"id": id}).sort({"date": -1}).toArray().then(a => {
                    toSend.OXYalerts = a;
                    database.collection(cred.db.db.ressources.PULSEalerts).find({"id": id}).sort({"date": -1}).toArray().then(a => {
                        toSend.PULSEalerts = a;
                        database.collection(cred.db.db.ressources.alertsConfig).find().toArray().then(a => {
                            toSend.alertsConfig = a;
                            database.collection(cred.db.db.ressources.notes).find({"id": id}).sort({"date": -1}).toArray().then(a => {
                                toSend.notes = a;

                                // console.log(JSON.stringify(toSend));

                                toSend.url = url;
                                toSend.id = id;

                                //res.end(JSON.stringify(toSend));
                                callback(toSend);
                            });
                        });
                    });
                });
            });
        });
    });
}

app.get("/", (req, res) => {
    settings = JSON.parse(fs.readFileSync("./settings.json"));
    res.render("index.ejs", {"settings": settings});
});

app.post("/", (req, res) => {
    res.end(JSON.stringify({"data": process(data), "alertProfiles": data.alertProfiles}));
})

app.get("/patient", (req, res) => {
    dumpDBfromURL(req.url, (toSend) => {
        console.log(settings);
        res.render("patient.ejs", { "data": toSend, "url": req.url, "refresh_rate": settings["patient.refresh_rate"], "settings": settings});
    })
});

app.post("/patient", (req, res) => {
    dumpDBfromURL(req.url, (toSend) => {
        res.end(JSON.stringify(toSend));
    })
});

app.post("/addnote", (req, res) => {
    var split = req.url.split("?");
    if(split.length === 2) {
        // split[1] = split[1].replace(/%22/g, "\"");
        // split[1] = split[1].replace(/%20/g, " ");
        split[1] = decodeURI(split[1]);
        var json = JSON.parse(split[1]);
        console.log(json);
        database.collection(cred.db.db.ressources.notes).insertOne(json);
    }
});

app.get("/settings", (req, res) => {
    settings = JSON.parse(fs.readFileSync("./settings.json"));
    res.end(JSON.stringify(settings));
});

app.post("/settings", (req, res) => {
    settings = JSON.parse(fs.readFileSync("./settings.json"));
    console.log(req.url)
    url.parse(req.url).query.split("&").forEach(e => {
        var split = e.split("=");
        if(split.length === 2) {
            var data;
            var ok = false;
            switch(typeof(settings[split[0]])) {
                case "number":
                    data = parseFloat(split[1]);
                    ok = true;
                    break;
                case "boolean":
                    data = split[1] == "1" || split[1] == "true"
                    ok = true;
                    break;
                case "object":
                    data = JSON.parse(split[1])
                    ok = true;
                    break;
                case "string":
                    data = split[1]
                    ok = true;
                    break;
            }
            if(ok) settings[split[0]] = data;
        }
    });
    fs.writeFileSync("./settings.json", JSON.stringify(settings));
    res.end(JSON.stringify(settings));
    settings = JSON.parse(fs.readFileSync("./settings.json"));
    // console.log(JSON.stringify(settings));
});

app.post("/user", (req, res) => {
    console.log(req.url);
    var id = -1;
    var change = {};
    url.parse(req.url).query.split("&").forEach(e => {
        var split = e.split("=");
        if (split.length === 2) {
            if(split[0] === "id") {
                id = parseInt(split[1]);
            } else {
                var _value;

                _value = parseInt(decodeURI(split[1]))

                if(isNaN(_value)) {
                    _value = decodeURI(split[1])
                }

                change[decodeURI(split[0])] = _value
            }
        }
    });

    console.log("***********************************************************")
    console.log(id);
    console.log(change);

    if(id !== -1) {
        /*database.collection(cred.db.db.ressources.users).updateOne({'id': id}, {name: "test"}, function(err, res) {
            if (err) throw err;
            console.log("1 document updated");
        });*/
        database.collection(cred.db.db.ressources.users).findOneAndUpdate({"id": id}, {"$set": change}, (err, res) => {
            console.log("hello")
        });
    }
});

app.post("/createConfig", (req, res) => {
    var _url = decodeURI(req.url);
    var regex = _url.replace(/\/createConfig\?filter=/, "");
    var split = regex.split("&data=")

    var _filter = JSON.parse(split[0]), filter = {};
    var _update = JSON.parse(split[1]), update = {};

    for(let [key, value] of Object.entries(_filter)) {
        let val = parseInt(value);

        if(isNaN(val))  val = value;

        filter[key] = val;
    }

    for(let [key, value] of Object.entries(_update)) {
        let val = parseInt(value);

        if(isNaN(val))  val = value;

        update[key] = val;
    }

    for(let [key, value] of Object.entries(update["config"])) {
        let val = parseInt(value);

        if(isNaN(val))  val = value;

        update["config"][key] = val;
    }

    console.log(filter);
    console.log(update);

    var toInsert = {};

    for(let [key, value] of Object.entries(filter)) {
        toInsert[key] = value
    }

    for(let [key, value] of Object.entries(update)) {
        toInsert[key] = value
    }

    console.log(toInsert);

    database.collection(cred.db.db.ressources.alertsConfig).insertOne(toInsert);

    res.end();
})

app.post("/alertConfig", (req, res) => {
    var _url = decodeURI(req.url);
    var regex = _url.replace(/\/alertConfig\?filter=/, "");
    var split = regex.split("&data=")

    var _filter = JSON.parse(split[0]), filter = {};
    var _update = JSON.parse(split[1]), update = {};

    for(let [key, value] of Object.entries(_filter)) {
        let val = parseInt(value);

        if(isNaN(val))  val = value;

        filter[key] = val;
    }

    for(let [key, value] of Object.entries(_update)) {
        let val = parseInt(value);

        if(isNaN(val))  val = value;

        update[key] = val;
    }

    for(let [key, value] of Object.entries(update["config"])) {
        let val = parseInt(value);

        if(isNaN(val))  val = value;

        update["config"][key] = val;
    }

    console.log(filter);
    console.log(update);

    var ret = "Error"

    database.collection(cred.db.db.ressources.alertsConfig).findOneAndUpdate(filter, {"$set": update}, (err, res) => {
        ret = "ok"
    });

    res.end(ret);
})

app.listen(80);