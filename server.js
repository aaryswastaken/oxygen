// TODO : ADD LOGS

// *********** IMPORTS *********
// Express
const express = require("express");
const app = express();

// Settings and Credentials
const fs = require("fs");

var settings = JSON.parse(fs.readFileSync("./settings.json"));
var cred = JSON.parse(fs.readFileSync("./credentials.json"));

// Export
const MONGOxlsx = require("mongo-xlsx");
const MONGOcsv = require("json2csv")

// URL Parsing
const url = require("url");
var queryString = require("querystring");

// Authentication & cookies
const pwd = require("node-php-password");
var auth = fs.readFileSync("./authentication.json");
auth = JSON.parse(auth);

const cookieParser = require("cookie-parser");
app.use(cookieParser());

// To get <form> response
const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({extended: true}));

// Mongodb
const mongodb = require("mongodb");
var MongoClient = mongodb.MongoClient;

// Mongodb Watchdog
const watchdog = require("./watchdog");
var watchdogs = [];
var cleaners = [];

// ********************** MONGODB CONNECTION & WATCHDOGS SETUP *********************
// URL of the mongodb server + creds
var dburl = `mongodb://${cred.db.connection.user}:${cred.db.connection.password}@${cred.db.connection.ip}:${cred.db.connection.port}/`;

// This object will contains a part of the database
// This object is ONLY used for the main dashboard
var data = {};

var database;   // The connection

// Connection to the db
MongoClient.connect(dburl, function(err, db) {
// **** BEGIN DATABASE CONNECTION PROMISE ****
    if (err) {
        /* eslint no-console: ["error", { allow: ["warn", "error"] }] */
        console.error("Error : "+err);  // Print any errors
    }

    var oxymetre = db.db(cred.db.db.name);  // Get the database instance
    database = oxymetre;

    oxymetre.collection(cred.db.db.ressources.users).find().toArray().then(t => {
        /* t.forEach(e => {
            //console.log(e.id + " " + e.name);
        }); */
        data.users = t;
    });  // Dump the user collection and push it to the "data" object

    // TODO : Imlement refresh on (index) when user is added / deleted / updated
    // Watchdog for when a user has been updated / created / deleted
    var wtch = new watchdog.Watchdog(oxymetre.collection(cred.db.db.ressources.users), settings["database.period"], {"id": 1}, settings["database.limit"], object => {
        //console.log("Users : changed !");
    });
    wtch.start();
    watchdogs.push(wtch);

    // Watchdog for when a data (oxymeter values) is updates / created / deleted
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
        });  // Do a basic sort of the newest value ...

        data.state = temp;  // .. and then append it to the "data" object
    });  //
    wtch.start();
    watchdogs.push(wtch);

    // console.log(settings["database.cleaner.data.period"]);  // Give the cleaning period (please refer to watchdog.js for more info)


    // Init a new cleaner for oxymeter values, cut the 15,000 oldest values when there is more than 150,000 values
    var cleaner = new watchdog.Cleaner(
        oxymetre.collection(cred.db.db.ressources.data),
        settings["database.cleaner.data.period"],
        {},
        {"count": 15000},
        (object) =>{
            return object.length > 150000},
        (err, obj) => {
            // console.log("[data] " + obj.result.n.toString() + " entry deleted"); // LOG
        }); // 1000 (s) * 1000 = (ms)
    cleaner.start();
    cleaners.push(cleaner);

    // Watchdog for when a new SP02 alert is created / deleted / updated
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
        });  // Basic sort by newest

        data.OXYalerts = temp;  // Update the data object
    });
    wtch.start();
    watchdogs.push(wtch);
    // This watchdog has no cleaner because the quantity of events generated will be capped because every time a patient is deleted, his alerts are cleaned
    // TODO : clean SP02 alerts when user is deleted

    // Watchdog for pulse data (BPM)
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
        });  // Simple sort by newest

        data.pulse = temp;  // Update the object
    });
    wtch.start();
    watchdogs.push(wtch);

    // Cleaner for BPM data
    cleaner = new watchdog.Cleaner(
        oxymetre.collection(cred.db.db.ressources.pulse),
        settings["database.cleaner.data.period"],
        {},
        {"count": 15000},
        (object) =>{
            return object.length > 150000},
        (err, obj) => {
            // console.log("[data] " + obj.result.n.toString() + " entry deleted");  // LOG
        }); // 1000 (s) * 1000 = (ms)
    cleaner.start();
    cleaners.push(cleaner);

    // Watchdog for BPM alerts
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
        });  // Simple sort by newest

        data.PULSEalerts = temp; // Update the object
    });
    wtch.start();
    watchdogs.push(wtch);
    // This watchdog has no cleaner because the quantity of events generated will be capped because every time a patient is deleted, his alerts are cleaned
    // TODO : clean BPM alerts when user is deleted

    // Watchdog for alert profiles
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
        });  // Same sort as the others

        data.alertProfiles = temp;  // Update
    });
    wtch.start();
    watchdogs.push(wtch);
});
// **** END OF DATABASE CONNECTION PROMISE ****

console.log("Finished");

// Process the data to be more efficient in the browser (-> Used by the main dashboard)
function process(object, callback) {
    var response = [];

    var sort = {};

    switch (settings["sort"]) {  // User defined variable (in settings.json)
        case 0:
            sort = {id: 1};
            break;
        case 1:
            sort = {chambre: 1};
            break;
        case 2:
            sort = {name: 1}
            break;
    }

    database.collection(cred.db.db.ressources.users).find().sort(sort).toArray().then( (a) => {  // Get a list of users, sorted by the user-defined sort
        a.forEach( (e) => {  // a -> Array of all users | e -> current user
            if(!(e === null)) {  // If no error
                var obj = e;

                // TODO : Optimization of process()
                object.state.forEach(state => {
                    if(state.id === obj.id) {
                        obj.concentration = state.concentration;
                        obj.date = state.date;
                    }
                });  // Get SP02 data for this user

                object.OXYalerts.forEach(alert => {
                    if(alert.id === obj.id) {
                        obj.OXYlevel = alert.level;
                    }
                });  // Get SP02 alerts for this user

                object.pulse.forEach(pulse => {
                    if(pulse.id === obj.id) {
                        obj.pulsation = pulse.pulsation;
                    }
                });  // Get BPM data for this user

                object.PULSEalerts.forEach(pulse => {
                    if(pulse.id === obj.id) {
                        obj.PULSElevel = pulse.level;
                    }
                });  // Get BPM alerts for this user

                response.push(obj);  // push to response
            }
        });
        callback(response);  // Execute "promise"
    });
}

// Create a dump of the database for a specific user (-> Used by the user-specific dashboard)
function dumpDBfromURL(url, callback) {
    // Get the user from the url
    var split = url.split("?");
    var id = 1;
    if(split.length === 2) {
        id = parseInt(split[1]);
    }

    // Dump the data for this user
    var toSend = {};

    // User info
    database.collection(cred.db.db.ressources.users).find({"id": id}).toArray().then( a => {
        toSend.users = a;

        // SP02 values
        database.collection(cred.db.db.ressources.data).find({"id": id}).sort({"date": -1}).toArray().then( a => {
            toSend.oxymeter = a;

            // BPM values
            database.collection(cred.db.db.ressources.pulse).find({"id": id}).sort({"date": -1}).toArray().then( a => {
                toSend.pulse = a;

                // SP02 alerts
                database.collection(cred.db.db.ressources.OXYalerts).find({"id": id}).sort({"date": -1}).toArray().then(a => {
                    toSend.OXYalerts = a;

                    // BPM alerts
                    database.collection(cred.db.db.ressources.PULSEalerts).find({"id": id}).sort({"date": -1}).toArray().then(a => {
                        toSend.PULSEalerts = a;

                        // Alert profiles
                        database.collection(cred.db.db.ressources.alertsConfig).find().toArray().then(a => {
                            toSend.alertsConfig = a;

                            // Notes
                            database.collection(cred.db.db.ressources.notes).find({"id": id}).sort({"date": -1}).toArray().then(a => {
                                toSend.notes = a;

                                // console.log(JSON.stringify(toSend));

                                toSend.url = url;  // URL request
                                toSend.id = id;    // USER #ID

                                //res.end(JSON.stringify(toSend));
                                callback(toSend);  // Execute "promise"
                            });
                        });
                    });
                });
            });
        });
    });
}


// **** BEGIN EXPRESS ROUTER ****

// GET : used by the browser to render the page or as a REST API
// POST : used as a REST API, mostly for Writing but can be read (from repetitive tasks)

// GET \ BROWSER \ MAIN PAGE, MAIN DASHBOARD
app.get("/", (req, res) => {
    settings = JSON.parse(fs.readFileSync("./settings.json"));
    res.render("index.ejs", {"settings": settings});
});

// POST \ REST (READ) \ DASHBOARD DATA (global)
app.post("/", (req, res) => {
    // res.end(JSON.stringify({"data": process(data), "alertProfiles": data.alertProfiles}));
    process(data, result => {
        res.end(JSON.stringify({"data": result, "alertProfiles": data.alertProfiles}));
    });
});

// GET \ BROWSER \ PATIENT DASHBOARD
app.get("/patient", (req, res) => {
    dumpDBfromURL(req.url, (toSend) => {
        // console.log(req.url);
        res.render("patient.ejs", { "data": toSend, "url": req.url, "refresh_rate": settings["patient.refresh_rate"], "settings": settings});
    });
});

// POST \ REST (read) \ PATIENT DATA (specific)
app.post("/patient", (req, res) => {
    dumpDBfromURL(req.url, (toSend) => {
        res.end(JSON.stringify(toSend));
    })
});

// POST \ REST (write) \ ADD NOTE TO PATIENT
app.post("/addnote", (req, res) => {
    var split = req.url.split("?");
    if(split.length === 2) {
        // (REPLACED BY decodeURI)
        // split[1] = split[1].replace(/%22/g, "\"");
        // split[1] = split[1].replace(/%20/g, " ");

        split[1] = decodeURI(split[1]);
        var json = JSON.parse(split[1]);
        // console.log(json);
        database.collection(cred.db.db.ressources.notes).insertOne(json);
    }
});

// GET \ REST (read) \ GET APP SETTINGS
app.get("/settings", (req, res) => {
    settings = JSON.parse(fs.readFileSync("./settings.json"));
    res.end(JSON.stringify(settings));
});

// POST \ REST (write) \ SET APP SETTINGS
// TODO : IMPLEMENT decodeURI()
app.post("/settings", (req, res) => {
    settings = JSON.parse(fs.readFileSync("./settings.json"));
    console.log(req.url)
    url.parse(req.url).query.split("&").forEach( (e) => {
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
                    data = (split[1] === "1" || split[1] === "true");
                    ok = true;
                    break;
                case "object":
                    data = JSON.parse(split[1]);
                    ok = true;
                    break;
                case "string":
                    data = split[1]
                    ok = true;
                    break;
            }
            if(ok) {
                settings[split[0]] = data;
            }
        }
    });
    fs.writeFileSync("./settings.json", JSON.stringify(settings));
    res.end(JSON.stringify(settings));
    settings = JSON.parse(fs.readFileSync("./settings.json"));
    // console.log(JSON.stringify(settings));
});

// GET \ BROWSER \ ACCESS CONFIG PAGE
// TODO : code a more secure connection by using a session id
app.get("/config", (req, res) => {
    // console.log(req.cookies);  // DEBUG
    var error = 0;  // AKA "error flag"

    if(Object.keys(req.cookies).length !== 0 && req.cookies["isAuth"] === "1") { // If there is cookies and IF is authenticated (very insecure)
        res.render("config.ejs", {"settings": settings});  // RENDER SETTINGS PAGE
    } else {
        error += 1;
    }

    if(error !== 0) {  // IF THERE WAS AN ERROR
        // res.end("Plz login");
        res.render("login.ejs", {"from": "/config", "failed": false}); // SHOW THE LOGIN PAGE
    }
});

// POST \ REST (read / auth) \ AUTHENTICATE
app.post("/login", (req, res) => {
    // console.log(req.body);
    let isAuth = false;
    try {
        let hashed =  auth[req.body.username].hash;
        // console.log("hashed : "+hashed);
        isAuth = pwd.verify(req.body.password, hashed);
    } catch (e) {
        console.log("An error occured : "+e);
        res.render("login.ejs", {"failed": true, "from": req.body.from})
    }
    console.log("Is auth ?"+isAuth);
    res.cookie("isAuth", "1");
    res.render("relocator.ejs", {"from": req.body.from})
})

// GET \ REST (auth) \ LOGOUT
app.get("/logout", (req, res) => {
    res.cookie("isAuth", "0");  // IS NO MORE CONNECTED
    res.render("relocator.ejs", {"from": "/"});  // REDIRECT TO MAING PAGE
})

// POST \ REST (write) \ UPDATE USER INFO(s)
app.post("/user", (req, res) => {
    // console.log(req.url);
    var id = -1;
    var change = {};
    url.parse(req.url).query.split("&").forEach( (e) => {
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

// POST \ REST (write) \ CREATE ALERT CONFIG
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

// POST \ REST (write) \ UPDATE ALERT CONFIG
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
});

// GET \ BROWSER/REST \ DOWNLOAD A DUMP (csv, xlsx)
// TODO : MAKE THE XLSX WORK
app.get("/dump", (req, res) => {
    // /dump?id=${userid}&file=${filename}&ext=${extension}&dump=${dump}
    let url = decodeURI(req.url).replace(/\/dump\?/, "");
    let split = url.split("&");
    let json = {};
    split.forEach(e => {
        let splitEqual = e.split("=");
        json[splitEqual[0]] = splitEqual[1]
    })
    // console.log(json);

    let promise;
    switch (json.dump) {
        case "userInfo":
            promise = database.collection(cred.db.db.ressources.users).find({"id": parseInt(json.id)}).toArray();
            break;
        case "oxy":
            promise = database.collection(cred.db.db.ressources.data).find({"id": parseInt(json.id)}).toArray();
            break;
        case "pulse":
            promise = database.collection(cred.db.db.ressources.pulse).find({"id": parseInt(json.id)}).toArray();
            break;
    }

    promise.then( obj => {
        let data;
        let headerType;
        let ok = false;
        switch (json.ext) {
            case ".csv":
                data = MONGOcsv.parse(obj);
                headerType = "text/csv";
                ok = true;
                break;
            case ".xlsx":
                var model = MONGOxlsx.buildDynamicModel(obj);

                /* Generate Excel */
                data = MONGOxlsx.mongoData2Xlsx(obj, model/*, function(err, dt) {
                    console.log('File saved at:', dt.fullPath);
                    data = fs.readFileSync(dt.fullPath);
                    headerType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                    ok = true;
                }*/);
        }

        while(!ok) {}
        res.setHeader('Content-disposition', 'attachment; filename='+json.file+json.ext);
        res.set('Content-Type', headerType);
        console.log(data);
        res.status(200).send(data);
    })
})

// START THE EXPRESS SERVER
app.listen(80);