const { uniqueNamesGenerator, Config, names } = require("unique-names-generator");

const cfg = {
    dictionaries: [names],
    length: 1
};

/***************/

const mongodb = require("mongodb");
var MongoClient = mongodb.MongoClient;

var url = "mongodb://vsahler:vsahler@localhost:27017/";

MongoClient.connect(url, function(err, db) {
    if (err) {
        /* eslint no-console: ["error", { allow: ["log", "warn", "error"] }] */
        console.log("Error : "+err);
    }

    let database = db;

    var oxymetre = db.db("oxymetre");

    for(var i=0;i<100;i++) {
        const characterName = uniqueNamesGenerator(cfg); // Han Solo
        // console.log(characterName);
        oxymetre.collection("users").insertOne({"id": 4+i, "name": characterName, "chambre": "D"+Math.floor(Math.random() * Math.floor(700))});
    }
});