// Extract a list of users from a JSON extraction file

const iterationRun = 'ITPMO001';
var fs = require('fs'); 
var totalusers = 1;

// my functions

// function returning the positions of each specified letter in a string, and last position is length of string:
function PositionsOfLetterInString(dname, dletter) {
    var sPos = [];
    for(var i=0; i < dname.length; i++) {
        if (dname[i] == dletter) {
        	 sPos.push(i);
        }
    }
    sPos.push(dname.length + 1);
    return sPos;
}


// loading the main JSON list of documents to import (result of RDIMS SQL extraction):
var documentsJSON = require('./../source/ITPMO_extract_001.json');

// Open output file:
var userListFile = "./destination/userList_" + iterationRun + ".txt";
fs.writeFile(userListFile, 'List of users who are authors or modified documents in this batch: \r\n', function(err) {
	if(err) {
		return console.log(err);
	}
});

const FJSONLen = documentsJSON.length;
console.log(FJSONLen);


var allUsers = [];
// loop through the list of all documents:
for (var docs = 0 ; docs < FJSONLen ; docs++) {
		// - author: check if the user exists in GCdocs or use a generic import user:
		allUsers.push(documentsJSON[docs].author);
		allUsers.push(documentsJSON[docs].modifiedby);
}

// sort and then remove duplicates from all users list:

// sorting list of users:
allUsers.sort();

var allUsersClean = [];
allUsersClean[0] = allUsers[0];

for (var user = 1 ; user < allUsers.length ; user++) {
	if(allUsers[user] != allUsers[user-1]) {
		allUsersClean.push(allUsers[user]);
		totalusers++;
	}
}

console.log(allUsersClean);


// write the list of users output file:
fs.appendFile(userListFile, JSON.stringify(allUsersClean, null, 2), function(err) {
	if(err) {
		return console.log(err);
	}
	console.log("the list of users is saved - number of users found: " + totalusers);
});