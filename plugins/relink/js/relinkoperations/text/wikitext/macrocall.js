/*\
module-type: relinkwikitextrule

Handles macro calls.

<<myMacro '[[MyFilter]]' 'myTitle'>>

\*/

var utils = require("./utils.js");
var Rebuilder = require("$:/plugins/flibbles/relink/js/utils/rebuilder");
var log = require('$:/plugins/flibbles/relink/js/language.js').logRelink;
var settings = require('$:/plugins/flibbles/relink/js/settings.js');

exports.name = ["macrocallinline", "macrocallblock"];

exports.relink = function(tiddler, text, fromTitle, toTitle, options) {
	// Get all the details of the match
	var macroName = this.match[1],
		paramString = this.match[2],
		macroText = this.match[0];
	// Move past the macro call
	this.parser.pos = this.matchRegExp.lastIndex;
	var start = this.matchRegExp.lastIndex - this.match[0].length;
	var managedMacro = settings.getMacros(options)[macroName];
	if (!managedMacro) {
		// We don't manage this macro. Bye.
		return undefined;
	}
	var offset = macroName.length+2;
	offset = $tw.utils.skipWhiteSpace(macroText, offset);
	var params = parseParams(paramString, offset+start);
	var macroInfo = {
		name: macroName,
		start: start,
		end: this.matchRegExp.lastIndex,
		params: params
	};
	return exports.relinkMacroInvocation(tiddler, text, macroInfo, this.parser, fromTitle, toTitle, options);
};

/**Processes the given macro,
 * macro: {name:, params:, start:, end:}
 * each parameters: {name:, end:, value:}
 */
exports.relinkMacroInvocation = function(tiddler, text, macro, parser, fromTitle, toTitle, options) {
	var managedMacro = settings.getMacros(options)[macro.name];
	var modified = false;
	if (!managedMacro) {
		// We don't manage this macro. Bye.
		return undefined;
	}
	for (var managedArg in managedMacro) {
		var index = getManagedParamIndex(macro.name, managedArg, macro.params, options);
		if (index < 0) {
			// this arg either was not supplied, or we can't find
			// the definition, so we can't tie it to an anonymous
			// argument. Either way, move on to the next.
			continue;
		}
		var param = macro.params[index];
		var relinker = managedMacro[managedArg];
		var extendedOptions = Object.assign({placeholder: parser}, options);
		value = relinker(param.value, fromTitle, toTitle, extendedOptions);
		if (value === undefined) {
			continue;
		}
		quote = determineQuote(text, param.end);
		var quoted = utils.wrapAttributeValue(value, quote, ['', "'", '"', '[[', '"""']);
		param.newValue = quoted;
		param.quote = quote;
		modified = true;
	}
	if (modified) {
		var builder = new Rebuilder(text, macro.start);
		for (var i = 0; i < macro.params.length; i++) {
			var param = macro.params[i];
			if (param.newValue) {
				var valueStart = param.end - (param.value.length + param.quote.length * 2);
				builder.add(param.newValue, valueStart, param.end);
			}
		}
		return builder.results(macro.end);
	}
	return undefined;
};

function getManagedParamIndex(macroName, managedArg, params, options) {
	var index, i;
	for (i = 0; i < params.length; i++) {
		if (params[i].name === managedArg) {
			return i;
		}
	}
	var expectedIndex = indexOfParamDef(macroName, managedArg, options);
	// We've got to skip over all the named parameter instances.
	if (expectedIndex >= 0) {
		var anonI = 0;
		for (i = 0; i < params.length; i++) {
			if (params[i].name === undefined) {
				if (anonI === expectedIndex) {
					return i;
				}
				anonI++;
			} else {
				var indexOfOther = indexOfParamDef(macroName, params[i].name, options);
				if (indexOfOther < expectedIndex) {
					anonI++;
				}
			}
		}
	}
	return -1;
};

// Looks up the definition of a macro, and figures out what the expected index
// is for the given parameter.
function indexOfParamDef(macroName, paramName, options) {
	var globals = options.wiki.relinkGlobalMacros();
	var def = globals.variables[macroName];
	if (!def) {
		// Check with the macro modules
		if ($tw.utils.hop($tw.macros, macroName)) {
			def = $tw.macros[macroName];
		}
	}
	if (!def) {
		console.warn(`Cannot find macro definition for ${macroName}, and Relink needs it.`);
	} else {
		var params = def.params || [];
		for (var i = 0; i < params.length; i++) {
			if (params[i].name === paramName) {
				return i;
			}
		}
	}
	return -1;
};

function parseParams(paramString, pos) {
	var params = [],
		reParam = /\s*(?:([A-Za-z0-9\-_]+)\s*:)?(?:\s*(?:"""([\s\S]*?)"""|"([^"]*)"|'([^']*)'|\[\[([^\]]*)\]\]|([^"'\s]+)))/mg,
		paramMatch = reParam.exec(paramString);
	while(paramMatch) {
		// Process this parameter
		var paramInfo = {
			value: paramMatch[2] || paramMatch[3] || paramMatch[4] || paramMatch[5] || paramMatch[6]
		};
		if(paramMatch[1]) {
			paramInfo.name = paramMatch[1];
		}
		//paramInfo.start = pos;
		paramInfo.end = reParam.lastIndex + pos;
		params.push(paramInfo);
		// Find the next match
		paramMatch = reParam.exec(paramString);
	}
	return params;
};

//TODO: Should be in utils.
/**Givin some text, and an attribute within that text, this returns
 * what type of quotation that attribute is using.
 */
function determineQuote(text, end) {
	var pos = end-1;
	if (text.startsWith("'", pos)) {
		return "'";
	}
	if (text.startsWith('"', pos)) {
		if (text.startsWith('"""', pos-2)) {
			return '"""';
		} else {
			return '"';
		}
	}
	return '';
};