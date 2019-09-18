/*\

Tests the new relinking wiki methods.

\*/

var utils = require("test/utils");
var relink = utils.relink;

describe('relink', function() {

function testConfig(options, /* tiddler objects */) {
	var text = "[[from here]]", expected;
	var tiddlerObj = Object.assign({text: text}, options);
	[text, expected, options] = utils.prepArgs(text, options);
	options.wiki.addTiddlers(Array.prototype.slice.call(arguments, 1));
	var results = utils.relink(tiddlerObj, options);
	expect(results.tiddler.fields.text).toEqual(expected);
};

it("handles getting no configuration at all", function() {
	testConfig();
});

it("handles inclusive configuration", function() {
	testConfig({}, utils.toUpdateConf("[all[]]"));
	testConfig({tags: "update"}, utils.toUpdateConf("[tag[update]]"));
});

it("properly ignores tiddlers outside of to-update", function() {
	testConfig({ignored: true}, utils.toUpdateConf("[tag[update]]"));
});

it("to-update handles non-existent tiddlers", function() {
	testConfig({}, utils.toUpdateConf("test non-existent"));
});

var shadowTiddler = "$:/plugins/flibbles/test/tiddler";
function wikiWithPlugin() {
	var wiki = new $tw.Wiki();
	wiki.addTiddler({
		title: "$:/plugins/flibbles/test",
		description: "Plugins for shadow tiddler tests",
		"plugin-type": "plugin",
		type: "application/json",
		version: "0.0.0",
		text: `{
			"tiddlers": {
				"${shadowTiddler}": {
					"text": "Shadow [[from here]]"
				}
			}
		}`
	});
	wiki.readPluginInfo();
	wiki.registerPluginTiddlers("plugin");
	wiki.unpackPluginTiddlers();
	return wiki;
};

it("doesn't touch shadow tiddlers by default", function() {
	var wiki = wikiWithPlugin();
	utils.relink({}, {wiki: wiki});
	var tiddler = wiki.getTiddler(shadowTiddler);
	expect(tiddler.fields.text).toEqual("Shadow [[from here]]");
});

it("does touch shadow tiddlers when configured to", function() {
	var wiki = wikiWithPlugin();
	wiki.addTiddler(utils.toUpdateConf("[all[tiddlers+shadows]]"));
	utils.relink({}, {wiki: wiki});
	var tiddler = wiki.getTiddler(shadowTiddler);
	expect(tiddler.fields.text).toEqual("Shadow [[to there]]");
});

it("handles errors with at least some grace", function() {
	function thrower(exception, expected) {
		var oldParseStringArray = $tw.utils.parseStringArray;
		var wiki = new $tw.Wiki();
		var e;
		wiki.addTiddlers([
			{title: "tiddlertest", test: "A"},
			utils.fieldConf("test", "list")
		]);
		try {
			$tw.utils.parseStringArray = function() {
				throw new Error(exception);
			};
			wiki.renameTiddler("anything","something",{wiki: wiki});
		} catch (thrown) {
			e = thrown;
		} finally {
			$tw.utils.parseStringArray = oldParseStringArray;
		}
		expect(e).toBeDefined();
		expect(e.message).toEqual(expected);
	};
	//thrower("Ping", "Ping\nError relinking 'tiddlertest'");
	thrower('Boom', "Boom\nWhen relinking 'tiddlertest'");
});

it('can filter for all impossible tiddlers', function() {
	function test(filter, expected) {
		var wiki = new $tw.Wiki(), result;
		wiki.addTiddlers(utils.setupTiddlers());
		wiki.addTiddlers([
			{title: "$:/plugins/flibbles/relink/language/Error/RelinkFilterOperator", text: "This text is pulled"},
			{title: "from"},
			{title: "A", list: "from"},
			{title: "B"},
			{title: "C", text: "[[from]]"}
		]);
		var warn = utils.collect("warn", function() {
			var log = utils.collect("log", function() {
				result = wiki.filterTiddlers(filter);
			});
			expect(log).toEqual([]);
		});
		expect(warn).toEqual([]);
		expect(result).toEqual(expected);
	};
	test("'bad]] t' +[relink:impossible[from]]", ["A"]);
	test("[relink:references[from]]", ["A", "C"]);
	test("[relink:nonexistent[]]", ["This text is pulled"]);
});

});

