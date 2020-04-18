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

    oxymetre.collection("oxymetre").deleteMany({}, function (err, obj) {
        if (err) throw err;
        console.log(obj.result.n + " document(s) deleted");
        db.close();
    });

    oxymetre.collection("oxymetre-alerts").deleteMany({}, function (err, obj) {
        if (err) throw err;
        console.log(obj.result.n + " document(s) deleted");
        db.close();
    });

    oxymetre.collection("pulse").deleteMany({}, function (err, obj) {
        if (err) throw err;
        console.log(obj.result.n + " document(s) deleted");
        db.close();
    });

    oxymetre.collection("pulse-alerts").deleteMany({}, function (err, obj) {
        if (err) throw err;
        console.log(obj.result.n + " document(s) deleted");
        db.close();
    });
});