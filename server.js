const express = require("express");
const app = express();

const mongodb = require("mongodb");
var MongoClient = mongodb.MongoClient;

const watchdog = require("./watchdog");
var watchdogs = [];

var url = "mongodb://vsahler:vsahler@localhost:27017/";

var data = {};

MongoClient.connect(url, function(err, db) {
    if (err) {
        console.log("Error : "+err);
    }

    var oxymetre = db.db("oxymetre");

    oxymetre.collection("users").find().toArray().then(t => {
        t.forEach(e => {
            console.log(e.id + " " + e.name);
        });
        data.users = t;
    });

    var wtch = new watchdog.Watchdog(oxymetre.collection("users"), 500, {"id": 1}, 1000, object => {
        console.log("Users : changed !");
    });
    wtch.start();
    watchdogs.push(wtch);

    wtch = new watchdog.Watchdog(oxymetre.collection("oxymetre"), 500, {"date": -1}, 5000, object => {
        var temp = [];
        var ids = [];
        console.log("Oxymetre : changed !");
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

    wtch = new watchdog.Watchdog(oxymetre.collection("alerts"), 500, {"date": -1}, 10000, object => {
        var temp = [];
        var ids = [];
        console.log("Alerts : changed !");
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

app.get("/", (req, res) => {
    res.render("index.ejs", {"data": "salut"});
});

app.post("/", (req, res) => {
    res.end(JSON.stringify(process(data)));
})

app.listen(80);