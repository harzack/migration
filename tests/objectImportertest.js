var object = require("../lib/objectimporter").OIarray;

exports["setUp"] = function(callback){
	object.reset();
	callback();
};

exports["create an object importer xml line"] = function(test) {
	object.addAction("create");
	object.addLanguage("en");
	object.addLocation("Enterprise:Projects:Documents");
	object.addFile("c:\temp\guidelines.doc");
	object.addTitle("My Guidelines");
	object.addDescription("first draft");
	object.addOwner("Admin");
	object.addCreatedBy("Admin");
	object.addCreated("20100731");
	object.addModified("20100715");
	
	var result = object.createDocument();
	
	var exptectedResult = "<node type=\"document\" action=\"create\">\r\n<location>Enterprise:Projects:Documents</location>\r\n<file>c:\temp\guidelines.doc</file>\r\n<title language=\"en\">My Guidelines</title>\r\n<createdby>Admin</createdby>\r\n<created>20100731</created>\r\n<modified>20100715</modified>\r\n<description language=\"en\">first draft</description>\r\n<owner>Admin</owner>\r\n</node>"
	
	test.equal(result[0], exptectedResult);
	test.done();
};