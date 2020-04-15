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

    var wtch = new watchdog.Watchdog(oxymetre.collection("users"), 500, {"id": 1}, 1000, object => {
        console.log("Sth changed !");
        data = object;
    });

    wtch.start();

    watchdogs.push(wtch)
});

function rand(max) {
    return Math.floor(Math.random() * Math.floor(max))
}

var sendCrap = () => {
    console.log("Sending ...");
    data.forEach(e => {
        database.db("oxymetre").collection("oxymetre").insertOne({"id": e.id, "concentration": (Math.floor(Math.random() * Math.floor(5))+95), "date": Date.now()});
    });
    for(var i=0;i<rand(20);i++) {
        var choosen = data[rand(data.length)]
        database.db("oxymetre").collection("alerts").insertOne({"id": choosen.id, "date": Date.now(), "level": rand(4)})
    }
    setTimeout(sendCrap, 1000);
}

setTimeout(sendCrap, 2000);