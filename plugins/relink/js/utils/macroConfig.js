/*\
module-type: library

This handles the fetching and distribution of relink settings.

\*/

var settings = require('$:/plugins/flibbles/relink/js/settings.js');
var Widget = require("$:/core/modules/widgets/widget.js").widget;

function MacroConfig(wiki, parent) {
	this.macros = Object.create(null);
	this.parent = parent;
	this.wiki = wiki;
	this.widgetList = [];
};

module.exports = MacroConfig;

MacroConfig.prototype.get = function(macroName, options) {
	var macro = this.macros[macroName];
	if (macro) {
		// This isn't quite right.
		return macro;
	}
	if (this.parent) {
		return this.parent.get(macroName, options);
	}
	return settings.getMacros(options)[macroName];
};

MacroConfig.prototype.refresh = function(changes) {
	if (this.widget.refresh(changes)) {
		this.macros = Object.create(null);
		// Recompile all our widgets in the same order
		for (var i = 0; i < this.widgetList.length; i++) {
			this._compileList(this.widgetList[i].tiddlerList );
		}
		return true;
	}
	return false;
};

MacroConfig.prototype.addSetting = function(macroName, parameter, type) {
	var macro = this.macros[macroName];
	type = type || "title";
	if (macro === undefined) {
		macro = this.macros[macroName] = Object.create(null);
	}
	var handler = settings.getRelinker(type);
	if (handler) {
		macro[parameter] = handler;
	}
};

MacroConfig.prototype.createChildLibrary = function() {
	return new MacroConfig(this.wiki, this);
};

MacroConfig.prototype.createVariableWidget = function(filter, parent) {
	var widget = this.wiki.makeWidget( { tree: [{
		type: "importvariables",
		attributes: {
			"filter": {
				type: "string",
				value: filter
			}
		}
	}] }, { parentWidget: parent} );
	widget.execute();
	widget.renderChildren();
	var importWidget = widget.children[0];
	return importWidget;
};

MacroConfig.prototype.addWidget = function(widget) {
	this.widget = widget;
	while (this.widget.children.length > 0) {
		this.widget = this.widget.children[0];
	}
};

MacroConfig.prototype.getVariableWidget = function(title) {
	if (!this.widget) {
		var varWidget = this.wiki.getRelinkConfig().varWidget();
		var parentWidget = new Widget({}, {parentWidget: varWidget});
		parentWidget.setVariable("currentTiddler", title);
		var widget = new Widget({}, {parentWidget: parentWidget});
		this.addWidget(widget);
	}
	return this.widget;
};


MacroConfig.prototype.import = function(filter, parent) {
	var importWidget = this.createVariableWidget(filter, parent);
	this._compileList(importWidget.tiddlerList);
	this.widgetList.push(importWidget);
	// This only works if only one filter is imported
	this.addWidget(importWidget);
};

MacroConfig.prototype.varWidget = function() {
	var rtn = this.widget;
	while (rtn.children.length > 0) {
		rtn = rtn.children[0];
	}
	return rtn;
};

MacroConfig.prototype._compileList = function(titleList) {
	for (var i = 0; i < titleList.length; i++) {
		var parser = this.wiki.parseTiddler(titleList[i]);
		if (parser) {
			var parseTreeNode = parser.tree[0];
			while (parseTreeNode && parseTreeNode.type === "set") {
				if (parseTreeNode.relink) {
					for (var macroName in parseTreeNode.relink) {
						var parameters = parseTreeNode.relink[macroName];
						for (paramName in parameters) {
							this.addSetting(macroName, paramName, parameters[paramName]);
						}
					}
				}
				parseTreeNode = parseTreeNode.children && parseTreeNode.children[0];
			}
		}
	}
};
