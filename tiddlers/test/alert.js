/*\

Tests Relink's ability to alert the user when impossible relinks had to
be skipped over.

\*/

var utils = require("test/utils");

function testAlert(wiki, tiddlers, browser) {
	var results = [];
	wiki.addTiddlers([
		{title: "$:/plugins/flibbles/relink/language/Error/ReportFailedRelinks", text: "<<from>>-<<to>>"},
		{title: "from here"}]);
	for (var i = 0; i < tiddlers.length; i++) {
		wiki.addTiddler({
			title: tiddlers[i],
			text: "{{{[tag{from here}]}}}"});
	}
	function alert(msg) { results.push(msg); }
	// We momentarily pretend to be (or not to be) a browser
	utils.monkeyPatch($tw, "browser", browser, function() {
	utils.monkeyPatch($tw.utils.Logger.prototype, "alert", alert, function() {
	utils.collect("log", function() {
		// deliberately not passing options.
		// renameTiddler should work without it.
		wiki.renameTiddler("from here", "to}}there");
	});
	});
	});
	// There should only ever be a single alert, no matter how many failed
	// relinks there were.
	expect(results.length).toEqual(1);
	var expectedMessage = "from here-to}}there";
	expect(results[0]).toContain(expectedMessage);
	return results[0];
};

describe('failure alerts', function() {

it("single alert for multiple tiddlers", function() {
	var message = testAlert(new $tw.Wiki(), ["TiddlerA", "TiddlerB"], true);
	expect(message).toContain("TiddlerA");
	expect(message).toContain("TiddlerB");
});

it("tiddlers with multiple errors only list once", function() {
	var wiki = new $tw.Wiki();
	var title = "Tiddles";
	wiki.addTiddler({
		title: title,
		text: "{{{[tag{from here}]}}} {{{[list{from here}]}}}"});
	var message = testAlert(wiki, [], true);
	var index = message.indexOf(title);
	expect(index).toBeGreaterThanOrEqual(0);
	index = message.indexOf(title, index + title.length);
	expect(index).toBeLessThan(0);
});

it("pretty titles", function() {
	var message = testAlert(new $tw.Wiki(), ["Pretty"], true);
	expect(message).toContain("[[Pretty]]");
});

it("unpretty titles", function() {
	var message = testAlert(new $tw.Wiki(), ["Pre]]y"], true);
	expect(message).toContain("<$link to=Pre]]y/>");
});

it("unquotable titles", function() {
	var message = testAlert(new $tw.Wiki(), ["Unpre']]y\""], true);
	var preamble = "\\define relink-1() Unpre']]y\"\n";
	expect(message.substr(0, preamble.length)).toEqual(preamble);
	expect(message).toContain("<$link to=<<relink-1>>/>");
});

it("prints simple if not on browser", function() {
	var message = testAlert(new $tw.Wiki(), ["TidA", "Tid]]B"]);
	expect(message).toContain("TidA");
	expect(message.indexOf("[[TidA]]")).toBeLessThan(0);
	expect(message).toContain("Tid]]B");
	expect(message.indexOf("<$text")).toBeLessThan(0);
	expect(message.indexOf("\\define")).toBeLessThan(0);
});

});
