const mongodb = require("mongodb");
var MongoClient = mongodb.MongoClient;

const watchdog = require("./watchdog");
var watchdogs = [];

var url = "mongodb://vsahler:vsahler@localhost:27017/";

var data = [];
var database;

MongoClient.connect(url, function(err, db) {
    if (err) {
        console.log("Error : "+err);
    }

    database = db;

    var oxymetre = db.db("oxymetre");

    var wtch = new watchdog.Watchdog(oxymetre.collection("users"), 500000, {"id": 1}, 1000, object => {
        console.log("Sth changed !");
        object.forEach( e => {
            oxymetre.collection("users").findOneAndUpdate({"id": e.id}, {"$set": {"famille": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse pulvinar."}}, (err, res) => {
                console.log("hello")
            });
        })
    });

    wtch.start();

    watchdogs.push(wtch)
});