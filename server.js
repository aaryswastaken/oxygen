const express = require("express");
const app = express();

const fs = require("fs");

var settings = JSON.parse(fs.readFileSync("./settings.json"));
var cred = JSON.parse(fs.readFileSync("./credentials.json"));

console.log(JSON.stringify(cred));

const url = require("url");

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

    wtch = new watchdog.Watchdog(oxymetre.collection(cred.db.db.ressources.alerts), settings["database.period"], {"date": -1}, settings["database.limit"]*1000, object => { // *1000 -> no false errors
        var temp = [];
        var ids = [];
        //console.log("Alerts : changed !");
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

        data.alerts = temp;
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

            object.alerts.forEach(alert => {
                if(alert.id === obj.id) {
                    obj.level = alert.level;
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
            database.collection(cred.db.db.ressources.alerts).find({"id": id}).sort({"date": -1}).toArray().then( a => {
                toSend.alerts = a;
                database.collection(cred.db.db.ressources.notes).find({"id": id}).sort({"date": -1}).toArray().then( a => {
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
}

app.get("/", (req, res) => {
    res.render("index.ejs", {"settings": settings});
});

app.post("/", (req, res) => {
    res.end(JSON.stringify(process(data)));
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
    console.log(JSON.stringify(settings));
})

app.listen(80);