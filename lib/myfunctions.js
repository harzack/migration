// function to count the number of specified letter found in a string:
function NumberOfLetterInString(dname, dletter) {
    var nletter = 0;
    for (var i=0; i < dname.length; i++) {
    		if (dname[i] == dletter) {
    			nletter += 1;
    		}
    	}
    return nletter;
}


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

// Function removing the specified letter in a string
function RemoveLetterInString(dname, dletter){
    var nString = "";
    for (var i=0; i < dname.length; i++) {
        if (dname[i] != dletter) {
        	nString += dname[i];
        }   
    }
    return nString;
}

// Function replacing the specified letter in a string by the second letter
function ReplaceLetterInString(dname, rletter, nletter){
    var nString = "";
    for (var i=0; i < dname.length; i++) {
        if (dname[i] == rletter) {
            nString += nletter;
        }
        else {
            nString += dname[i];
        }
    }
    return nString;
}

// Function cleaning a name: remove ,
function CleanName(dname) {
    var nString = "";
    for (var i=0; i < dname.length; i++) {
        if ((dname[i] == ",") || (dname[i] == "/")) {
            nString += "";
        }
        else {
            nString += dname[i];
        }
    }
    return nString;
}

// Function extracting the extention of a filename:
function fileExtension(fName){
    var dotpos = PositionsOfLetterInString(fName, '.');
    var lengthofname = fName.length;
    var extension = fName.substring(dotpos[0]+1, lengthofname);
    return extension;
}

// Function extracting the extention of a filename using ES6 arrow function notation (to test):
const fileExtensionES6 = fName => fName.substring(PositionsOfLetterInString(fName, '.')[0]+1, fName.length);

// Function removing the extention of a filename:
function removeFileExtension(fName){
    var dotpos = PositionsOfLetterInString(fName, '.');
    var lengthofname = fName.length;
    var cleanName = fName.substring(0, lengthofname - dotpos[0]);
    return cleanName;
}
