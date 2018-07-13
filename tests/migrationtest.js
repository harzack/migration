var edocs = require("../lib/edocsconvert").edocs;
var files = require("../lib/edocsconvert").files;

exports["setUp"] = function(callback){
	edocs.reset();
	files.reset();
	callback();
};

exports["Can convert numbers to filenames enhanced"] = function(test) {
	edocs.addNumber(7189);
	edocs.addVersion(1);
	edocs.addExtension("wpd");
	
	var result = edocs.num2DOCSEnh();
	
	test.equal(result[0], "5jp01!.wpd");
	test.done();
};

exports["Can convert numbers to filenames UNIX"] = function(test) {
	edocs.addNumber(7490);
	edocs.addVersion(1);
	edocs.addExtension("xls");
	
	var result = edocs.Num2DOCSunix();
	
	test.equal(result[0], "7w201_.xls");
	test.done();
};

exports["Can extract extension"] = function(test) {
	files.addFileName("5jp01!.wpd");
	
	var result = files.extractExtensions();
	
	test.equal(result[0], "wpd");
	test.done();
};

exports["Can extract versions"] = function(test) {
	files.addFileName("5jp03!.wpd");
	
	var result = files.extractVersions();
	
	test.equal(result[0], 03);
	test.done();
};

exports["Can extract numbers from Enhanced"] = function(test) {
	files.addFileName("5jp03!.wpd");
	
	var result = files.extractNumbers();
	
	test.equal(result[0], 7189);
	test.done();
};

exports["Can extract numbers from UNIX"] = function(test) {
	files.addFileName("7w201_.xls");
	
	var result = files.extractNumbers();
	
	test.equal(result[0], 7490);
	test.done();
};
