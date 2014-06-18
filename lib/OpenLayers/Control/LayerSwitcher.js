/* Copyright (c) 2006-2013 by OpenLayers Contributors (see authors.txt for
 * full list of contributors). Published under the 2-clause BSD license.
 * See license.txt in the OpenLayers distribution or repository for the
 * full text of the license. */

/**
 * @requires OpenLayers/Control.js
 * @requires OpenLayers/Lang.js
 * @requires OpenLayers/Util.js
 * @requires OpenLayers/Events/buttonclick.js
 */

/**
 * Class: OpenLayers.Control.LayerSwitcher
 * The LayerSwitcher control displays a table of contents for the map. This
 * allows the user interface to switch between BaseLasyers and to show or hide
 * Overlays. By default the switcher is shown minimized on the right edge of
 * the map, the user may expand it by clicking on the handle.
 *
 * To create the LayerSwitcher outside of the map, pass the Id of a html div
 * as the first argument to the constructor.
 *
 * Inherits from:
 *  - <OpenLayers.Control>
 */
OpenLayers.Control.LayerSwitcher = OpenLayers.Class(OpenLayers.Control, {

    /**  
     * Property: layerStates 
     * {Array(Object)} Basically a copy of the "state" of the map's layers 
     *     the last time the control was drawn. We have this in order to avoid
     *     unnecessarily redrawing the control.
     */
    layerStates: null,

  // DOM Elements

    /**
     * Property: layersDiv
     * {DOMElement}
     */
    layersDiv: null,

    /**
     * Property: baseLayersDiv
     * {DOMElement}
     */
    baseLayersDiv: null,

    /**
     * Property: baseLayers
     * {Array(Object)}
     */
    baseLayers: null,


    /**
     * Property: dataLbl
     * {DOMElement}
     */
    dataLbl: null,

    /**
     * Property: dataLayersDiv
     * {DOMElement}
     */
    dataLayersDiv: null,

    /**
     * Property: dataLayers
     * {Array(Object)}
     */
    dataLayers: null,


    /**
     * Property: minimizeDiv
     * {DOMElement}
     */
    minimizeDiv: null,

    /**
     * Property: maximizeDiv
     * {DOMElement}
     */
    maximizeDiv: null,

    /**
     * APIProperty: ascending
     * {Boolean}
     */
    ascending: true,
    /**
     * Property: groupDivs
     * Object with {DOMElements}, {Booleans} and {Strings}
     */
     groups: {
              groupDivs:{},
              checked: {},
              layers:{},
              display: {}
              },
    /**
     * Constructor: OpenLayers.Control.LayerSwitcher
     *
     * Parameters:
     * options - {Object}
     */
    initialize: function(options) {
        OpenLayers.Control.prototype.initialize.apply(this, arguments);
        this.layerStates = [];
    },

    /**
     * APIMethod: destroy
     */
    destroy: function() {

        //clear out layers info and unregister their events
        this.clearLayersArray("base");
        this.clearLayersArray("data");

        this.map.events.un({
            buttonclick: this.onButtonClick,
            addlayer: this.redraw,
            changelayer: this.redraw,
            removelayer: this.redraw,
            changebaselayer: this.redraw,
            scope: this
        });
        this.events.unregister("buttonclick", this, this.onButtonClick);

        OpenLayers.Control.prototype.destroy.apply(this, arguments);
    },

    /**
     * Method: setMap
     *
     * Properties:
     * map - {<OpenLayers.Map>}
     */
    setMap: function(map) {
        OpenLayers.Control.prototype.setMap.apply(this, arguments);

        this.map.events.on({
            addlayer: this.redraw,
            changelayer: this.redraw,
            removelayer: this.redraw,
            changebaselayer: this.redraw,
            scope: this
        });
        if (this.outsideViewport) {
            this.events.attachToElement(this.div);
            this.events.register("buttonclick", this, this.onButtonClick);
        } else {
            this.map.events.register("buttonclick", this, this.onButtonClick);
        }
    },

    /**
     * Method: draw
     *
     * Returns:
     * {DOMElement} A reference to the DIV DOMElement containing the
     *     switcher tabs.
     */
    draw: function() {
        OpenLayers.Control.prototype.draw.apply(this);

        // create layout divs
        this.loadContents();

        // set mode to minimize
        if(!this.outsideViewport) {
            this.minimizeControl();
        }

        // populate div with current info
        this.redraw();

        return this.div;
    },

    /**
     * Method: onButtonClick
     *
     * Parameters:
     * evt - {Event}
     */
    onButtonClick: function(evt) {
        var button = evt.buttonElement;
        if (button === this.minimizeDiv) {
            this.minimizeControl();
        } else if (button === this.maximizeDiv) {
            this.maximizeControl();
        } else if (button._layerSwitcher === this.id) {
            if (button["for"]) {
                button = document.getElementById(button["for"]);
            }
            if (!button.disabled) {
                if (button.type == "radio") {
                    button.checked = true;
                    this.map.setBaseLayer(this.map.getLayer(button._layer));
                } else {
                    button.checked = !button.checked;
                    this.updateMap();
                }
            }
        }
    },

    /**
     * Method: clearLayersArray
     * User specifies either "base" or "data". we then clear all the
     *     corresponding listeners, the div, and reinitialize a new array.
     *
     * Parameters:
     * layersType - {String}
     */
    clearLayersArray: function(layersType) {
        this[layersType + "LayersDiv"].innerHTML = "";
        this[layersType + "Layers"] = [];
        this.groups.groupDivs = {};
    },


    /**
     * Method: checkRedraw
     * Checks if the layer state has changed since the last redraw() call.
     *
     * Returns:
     * {Boolean} The layer state changed since the last redraw() call.
     */
    checkRedraw: function() {
        if ( !this.layerStates.length ||
             (this.map.layers.length != this.layerStates.length) ) {
            return true;
        }

        for (var i = 0, len = this.layerStates.length; i < len; i++) {
            var layerState = this.layerStates[i];
            var layer = this.map.layers[i];
            if ( (layerState.name != layer.name) ||
                 (layerState.inRange != layer.inRange) ||
                 (layerState.id != layer.id) ||
                 (layerState.visibility != layer.visibility) ) {
                return true;
            }
        }

        return false;
    },

    /**
     * Method: redraw
     * Goes through and takes the current state of the Map and rebuilds the
     *     control to display that state. Groups base layers into a
     *     radio-button group and lists each data layer with a checkbox.
     *
     * Returns:
     * {DOMElement} A reference to the DIV DOMElement containing the control
     */
    redraw: function() {
        //if the state hasn't changed since last redraw, no need
        // to do anything. Just return the existing div.
        if (!this.checkRedraw()) {
            return this.div;
        }

        //clear out previous layers
        this.clearLayersArray("base");
        this.clearLayersArray("data");

        var containsOverlays = false;
        var containsBaseLayers = false;
		var i;
		var layer;

        // Save state -- for checking layer if the map state changed.
        // We save this before redrawing, because in the process of redrawing
        // we will trigger more visibility changes, and we want to not redraw
        // and enter an infinite loop.
		this.layerStates = [];
		for (i = 0; i < this.map.layers.length; i++) {
			layer = this.map.layers[i];
            this.layerStates[i] = {
                'name': layer.name,
                'visibility': layer.visibility,
                'inRange': layer.inRange,
                'id': layer.id
            };
             // create group divs
             if (layer.group && !layer.isBaseLayer) {
                 layer.group = layer.group.replace(/\/$/,"");
                 layer.group = layer.group.replace(/^\//,"");
                 this.createGroupDiv(layer.group);
             }
        }


        var layers = this.map.layers.slice();
        if (!this.ascending) { layers.reverse(); }
        for(i = 0; i < layers.length; i++) {
            layer = layers[i];
            var baseLayer = layer.isBaseLayer;
			var layerDiv = null;

            if (layer.displayInLayerSwitcher) {

                if (baseLayer) {
                    containsBaseLayers = true;
                } else {
                    containsOverlays = true;
                }

                // only check a baselayer if it is *the* baselayer, check data
                //  layers if they are visible
                var checked = (baseLayer) ? (layer == this.map.baseLayer) : layer.getVisibility();

                // create input element
                var inputElem = document.createElement("input"),
                    // The input shall have an id attribute so we can use
                    // labels to interact with them.
                    inputId = OpenLayers.Util.createUniqueID(
                        this.id + "_input_"
                    );

                inputElem.id = inputId;
                inputElem.name = (baseLayer) ? this.id + "_baseLayers" : layer.name;
                inputElem.type = (baseLayer) ? "radio" : "checkbox";
                inputElem.value = layer.name;
                inputElem.checked = checked;
                inputElem.defaultChecked = checked;
                inputElem.className = "olButton";
                inputElem._layer = layer.id;
                inputElem._layerSwitcher = this.id;

                if (!baseLayer && !layer.inRange) {
                    inputElem.disabled = true;
                };

                // create span
                var labelSpan = document.createElement("label");
                // this isn't the DOM attribute 'for', but an arbitrary name we
                // use to find the appropriate input element in <onButtonClick>
                labelSpan["for"] = inputElem.id;
                OpenLayers.Element.addClass(labelSpan, "labelSpan olButton");
                labelSpan._layer = layer.id;
                labelSpan._layerSwitcher = this.id;
                if (!baseLayer && !layer.inRange) {
                    labelSpan.style.color = "gray";
                }
                labelSpan.innerHTML = layer.name;
                labelSpan.style.verticalAlign = (baseLayer) ? "bottom" : "baseline";
                // create line break
                var br = document.createElement("br");


                var groupArray = (baseLayer) ? this.baseLayers : this.dataLayers;
                groupArray.push({
                    'layer': layer,
                    'inputElem': inputElem,
                    'labelSpan': labelSpan
                });


                // layer group for data layers 
                if (!baseLayer) {
                    // no group
                    if (layer.group == null)  {
                        this.dataLayersDiv.appendChild(inputElem);
                        this.dataLayersDiv.appendChild(labelSpan);
                        layerDiv = this.dataLayersDiv;
                    }
                    // group exists it is most probably allready there
                    else {
                        var groupname = layer.group;
                        var div = this.groups.groupDivs[groupname];
                        div.appendChild(inputElem);
                        div.appendChild(labelSpan);
                        // append layer to the group
                        this.appendLayerToGroups(layer);
                        layerDiv = div;
                    }
                }
                // base layers
                else {
                    this.baseLayersDiv.appendChild(inputElem);
                    this.baseLayersDiv.appendChild(labelSpan);
                    layerDiv = this.baseLayersDiv;
                }

                /*
                 * buttons
                 */
                // remove button
                if (layer.buttonDropLayer == true) {
                    this.addDropLayerButton(layer,layerDiv);
                }

                // move button
                if (layer.buttonMoveLayer == true) {
                    this.addMoveLayerButton(layer,layerDiv);
                }

                // opacity button
                if (layer.buttonOpacity == true) {
                    this.addOpacityLayerButton(layer,layerDiv);
                }

                // extent button
                if (layer.buttonZoomToExtent == true) {
                    this.addZoomToLayerExtentButton(layer,layerDiv);
                }

                // final line break
                layerDiv.appendChild(br);
            }
        }

        // if no overlays, dont display the overlay label
        this.dataLbl.style.display = (containsOverlays) ? "" : "none";
	},


    /** 
     * Method:
     * A group label has been clicked, check or uncheck its corresponding input
     * 
     * Parameters:
     * e - {Event} 
     *
     * Context:  
     *  - {DOMElement} inputElem
     *  - {<OpenLayers.Control.LayerSwitcher>} layerSwitcher
     *  - {DOMElement} groupDiv
     */

    onInputGroupClick: function(e) {

        // setup the check value
        var check = !this.inputElem.checked;

        // get all <input></input> tags in this div
        var inputs = this.groupDiv.getElementsByTagName("input");

        // check the group input, other inputs are in groupDiv,
        // inputElem is in parent div
        this.inputElem.checked=check;

        // store to groupCheckd structure, where it can be later found
        this.layerSwitcher.groups.checked[this.inputElem.value] = check;

        for (var i = 0; i < inputs.length; i++) {
            // same as above
            inputs[i].checked=check;
            this.layerSwitcher.groups.checked[inputs[i].value] = check;
        }

        // groups are done, now the layers
        var dataLayers = this.layerSwitcher.dataLayers;
        for (var j = 0; j < dataLayers.length; j++) {
            var layerEntry = dataLayers[j];   
            if (this.layerSwitcher.isInGroup(
                    this.inputElem.value,layerEntry.layer)) {
                layerEntry.inputElem.checked = check;
                layerEntry.layer.setVisibility(check);
            }
        }

        OpenLayers.Event.stop(e);

        // if no baselayers, dont display the baselayer label
//      this.baseLbl.style.display = (containsBaseLayers) ? "" : "none";

        return this.div;
    },
    /**
     * Method: onGroupClick
     * Make the div with layers invisible
     *
     * Context:
     * layergroup - {String}
     * groups - {Array} of {DOMElements}
     */
    onGroupClick: function(e) {
        var layergroup = this.layergroup;
        var div = this.groups.groupDivs[layergroup];
        if (div) {
            if (div.style.display != "block") {
                div.style.display = "block";
                this.groups.display[layergroup] = "block";
            }
            else {
                div.style.display = "none";
                this.groups.display[layergroup] = "none";
            }
        }
    },

    /**
     * Method: onRemoveLayerClick
     *
     *
     * Parameters:
     * e - {Event}
     *
     * Context:
     *  - {Layer} Layer
     */
    onRemoveLayerClick: function(e) {
        var map = this.layer.map;
        map.removeLayer(this.layer,true);
        OpenLayers.Event.stop(e);
    },
    /**
     * Method: onMoveLayerClick
     *
     *
     * Parameters:
     * e - {Event}
     *
     * Context:
     *  - {Layer} Layer
     *  - {Boolean} up
     *  - layerSwitcher {OpenLayers.Control}
     */
    onMoveLayerClick: function(e) {
        var map = this.layer.map;
        var idx = null;
        var newidx = null;
        var layers = map.layers;
        var tmplayer = null;
        // get layer index
        for (var i = 0; i < map.layers.length; i++) {
            if (this.layer == map.layers[i]) {
                idx = i;
                break;
            }
        }
        // move up index
        if (this.up == true) {
            i = 1;
            while (1) {
                newidx = idx-i;
                if (newidx <= 0 ) {
                    newidx = 0;
                    break;
                }
                else if (map.layers[newidx].displayInLayerSwitcher == true &&
                    map.layers[newidx].group == map.layers[idx].group) {
                    break;
                }
                else {
                    i += 1;
                }
            }
        }
        // get down index
        else {
            i = 1;
            while (1) {
                newidx = idx+i;
                if (newidx >= map.getNumLayers()) {
                    newidx = map.getNumLayers()-1;
                    break;
                }
                else if (map.layers[newidx].displayInLayerSwitcher == true &&
                    map.layers[newidx].group == map.layers[idx].group) {
                    break;
                }
                else {
                    i += 1;
                }
            }
        }
        // switch
        map.raiseLayer(map.layers[idx], newidx-idx);
        this.layerSwitcher.redraw();
        OpenLayers.Event.stop(e);
    },
    /**
     * Method: onOpacityLayerClick
     *
     *
     * Parameters:
     * e - {Event}
     *
     * Context:
     *  - {Layer} Layer
     *  - {Boolean} up
     *  - layerSwitcher {OpenLayers.Control}
     */
    onOpacityLayerClick: function(e) {
        if (this.layer.opacity == undefined) {
            this.layer.opacity = 1;
        }
        var opacity = this.layer.opacity;
        opacity = this.up == true ? opacity+0.1 : opacity-0.1;
        opacity = opacity < 0 ? 0 : opacity;
        opacity = opacity > 1 ? 1 : opacity;
        this.layer.setOpacity(opacity);
        //this.layerSwitcher.redraw();
        OpenLayers.Event.stop(e);
    },
    /**
     * Method: onZoomToLayer
     *
     *
     * Parameters:
     * e - {Event}
     *
     * Context:
     *  - {Layer} Layer
     *  - layerSwitcher {OpenLayers.Control}
     */
    onZoomToLayer: function(e) {
        var map = this.layer.map;
        map.zoomToExtent(this.layer.maxExtent);
        //this.layerSwitcher.redraw();
        OpenLayers.Event.stop(e);
    },
    /**
     * Method: updateMap
     * Cycles through the loaded data and base layer input arrays and makes
     *     the necessary calls to the Map object such that that the map's
     *     visual state corresponds to what the user has selected in
     *     the control.
     */
    updateMap: function() {
		var i;
		var layerEntry;

        // set the newly selected base layer
        for(i=0; i < this.baseLayers.length; i++) {
            layerEntry = this.baseLayers[i];
            if (layerEntry.inputElem.checked) {
                this.map.setBaseLayer(layerEntry.layer, false);
            }
        }

        // set the correct visibilities for the overlays
        for(i=0; i < this.dataLayers.length; i++) {
            layerEntry = this.dataLayers[i];
            layerEntry.layer.setVisibility(layerEntry.inputElem.checked);
        }

    },

    /**
     * Method: maximizeControl
     * Set up the labels and divs for the control
     *
     * Parameters:
     * e - {Event}
     */
    maximizeControl: function(e) {

        // set the div's width and height to empty values, so
        // the div dimensions can be controlled by CSS
        this.div.style.width = "";
        this.div.style.height = "";

        this.showControls(false);

        if (e != null) {
            OpenLayers.Event.stop(e);
        }
    },

    /**
     * Method: minimizeControl
     * Hide all the contents of the control, shrink the size,
     *     add the maximize icon
     *
     * Parameters:
     * e - {Event}
     */
    minimizeControl: function(e) {

        // to minimize the control we set its div's width
        // and height to 0px, we cannot just set "display"
        // to "none" because it would hide the maximize
        // div
        this.div.style.width = "0px";
        this.div.style.height = "0px";

        this.showControls(true);

        if (e != null) {
            OpenLayers.Event.stop(e);
        }
    },

    /**
     * Method: showControls
     * Hide/Show all LayerSwitcher controls depending on whether we are
     *     minimized or not
     *
     * Parameters:
     * minimize - {Boolean}
     */
    showControls: function(minimize) {

        this.maximizeDiv.style.display = minimize ? "" : "none";
        this.minimizeDiv.style.display = minimize ? "none" : "";

        this.layersDiv.style.display = minimize ? "none" : "";
    },

    /**
     * Method: loadContents
     * Set up the labels and divs for the control
     */
    loadContents: function() {

        // layers list div
        this.layersDiv = document.createElement("div");
        this.layersDiv.id = this.id + "_layersDiv";
        OpenLayers.Element.addClass(this.layersDiv, "layersDiv");

        this.baseLbl = document.createElement("div");
        this.baseLbl.innerHTML = OpenLayers.i18n("Base Layer");
        OpenLayers.Element.addClass(this.baseLbl, "baseLbl");

        this.baseLayersDiv = document.createElement("div");
        OpenLayers.Element.addClass(this.baseLayersDiv, "baseLayersDiv");

        this.dataLbl = document.createElement("div");
        this.dataLbl.innerHTML = OpenLayers.i18n("Overlays");
        OpenLayers.Element.addClass(this.dataLbl, "dataLbl");

        this.dataLayersDiv = document.createElement("div");
        OpenLayers.Element.addClass(this.dataLayersDiv, "dataLayersDiv");
/*
        if (this.ascending) {
            this.layersDiv.appendChild(this.baseLbl);
            this.layersDiv.appendChild(this.baseLayersDiv);
            this.layersDiv.appendChild(this.dataLbl);
            this.layersDiv.appendChild(this.dataLayersDiv);
        } else {
            this.layersDiv.appendChild(this.dataLbl);
            this.layersDiv.appendChild(this.dataLayersDiv);
            this.layersDiv.appendChild(this.baseLbl);
            this.layersDiv.appendChild(this.baseLayersDiv);
        }
*/
		this.layersDiv.onmousedown = function(e) {
			e.stopPropagation();
		};

        this.div.appendChild(this.layersDiv);

        // maximize button div
        var img = OpenLayers.Util.getImageLocation('layer-switcher-maximize.png');
        this.maximizeDiv = OpenLayers.Util.createAlphaImageDiv(
                                    "OpenLayers_Control_MaximizeDiv",
                                    null,
                                    null,
                                    img,
                                    "absolute");
        OpenLayers.Element.addClass(this.maximizeDiv, "maximizeDiv olButton");
        this.maximizeDiv.style.display = "none";

        this.div.appendChild(this.maximizeDiv);

        // minimize button div
        var img = OpenLayers.Util.getImageLocation('layer-switcher-minimize.png');
        this.minimizeDiv = OpenLayers.Util.createAlphaImageDiv(
                                    "OpenLayers_Control_MinimizeDiv",
                                    null,
                                    null,
                                    img,
                                    "absolute");
        OpenLayers.Element.addClass(this.minimizeDiv, "minimizeDiv olButton");
        this.minimizeDiv.style.display = "none";

        this.div.appendChild(this.minimizeDiv);
    },

    /** 
     * Method: createGroupDiv
     * Creates <div></div> element for group of layers defined by input string.
     * 
     * Parameters:
     * layergroup - {String} with group structure as "Parent Group/It's child"
     *  
     * Returns:
     * {DOMElement} <div></div> object for this group of layers
     */
    createGroupDiv: function(layergroup) {
        var groupNames = layergroup.split("/"); // array with layer names
        var groupName = groupNames[groupNames.length-1]; // name of the last group in the line
        var br = document.createElement("br"); 
        var groupDiv = this.groups.groupDivs[layergroup];
        
        // groupDiv does not exist: create
        if (!groupDiv) {

            // search for the parent div - it can be another group div, or 
            // this dataLayersDiv directly
            var parentDiv = this.groups.groupDivs[groupNames.slice(0,groupNames.length-2).join("/")];

            if (!parentDiv) {

                // dataLayersDiv is parent div
                if (groupNames.length == 1) {
                    parentDiv = this.dataLayersDiv;
                }
                // there is no such thing, like parent div,
                else {
                    parentDiv = this.createGroupDiv( groupNames.slice(0,groupNames.length-1).join("/"));
                }
            }

            // create the div
            groupDiv = document.createElement("div");
            groupDiv.setAttribute("class","olLayerGroup");
            groupDiv.style.marginLeft="10px";
            groupDiv.style.marginBottom="5px";
            if (!this.groups.display[layergroup]) {
                this.groups.display[layergroup] = "block";
            }
            groupDiv.style.display= this.groups.display[layergroup];
            this.groups.groupDivs[layergroup] = groupDiv;

            // create the label
            var groupLbl = document.createElement("span");
            groupLbl.innerHTML="<u>"+groupName+"</u><br/>";
            groupLbl.style.marginTop = "3px";
            groupLbl.style.marginLeft = "3px";
            groupLbl.style.marginBottom = "3px";
            groupLbl.style.fontWeight = "bold";

            // setup mouse click event on groupLbl
            OpenLayers.Event.observe(groupLbl, "mouseup", 
                OpenLayers.Function.bindAsEventListener(
                    this.onGroupClick, {layergroup: layergroup, groups:
                    this.groups}));
            
            // create input checkbox
            var groupInput = document.createElement("input");
            groupInput.id = "input_" + groupNames.join("_");
            groupInput.name = groupNames.join("_");
            groupInput.type = "checkbox";
            groupInput.value = layergroup;
            groupInput.checked = false;
            groupInput.defaultChecked = false;
            if (!this.groups.checked[layergroup]) {
                this.groups.checked[layergroup] = false;
            }
            groupInput.checked = this.groups.checked[layergroup];
            groupInput.defaultChecked = this.groups.checked[layergroup];

            // create empty array of layers
            if (!this.groups.layers[layergroup]) {
                this.groups.layers[layergroup] = [];
            }
            
            // setup mouse click event on groupInput
            var context = {groupDiv: groupDiv,
                            layerSwitcher: this,
                            inputElem: groupInput};

            OpenLayers.Event.observe(groupInput, "mouseup", 
                OpenLayers.Function.bindAsEventListener(
                    this.onInputGroupClick, context));
            
            // append to parent div
            parentDiv.appendChild(groupInput);
            parentDiv.appendChild(groupLbl);
            parentDiv.appendChild(groupDiv);

        }

        return this.groups.groupDivs[layergroup];
    },

    /** 
     * Method: addLayerToGroups
     * each group has own {Array} with list of layrs. E.g. layer with group
     * "group1/group2" is member of two groups: "group1" and
     * "group1/group2"
     * 
     * Parameters:
     * layer 
     *  
     */
    appendLayerToGroups: function(layer) {
        var groupNames = layer.group.split("/");
        var groupName = null;

        for (var i = 1; i <= groupNames.length; i++) {
            groupName = groupNames.slice(0,i).join("/");
            if (!this.isInGroup(groupName,layer)) {
                this.groups.layers[groupName].push(layer);
            }
        }
    },
    
    /** 
     * Method: isInGroup
     * 
     * 
     * Parameters:
     * groupName - {String} name of the group
     * layer 
     *  
     * Returns:
     * {Boolean} -- the layer is available in this group with specified
     * name or not
     */
    isInGroup: function (groupName, layer) {
        for (var j = 0; j < this.groups.layers[groupName].length; j++) {
            if (this.groups.layers[groupName][j].id == layer.id) {
                return true;
            }
        }
        return false;
    },

    /** 
     * Method: addDroplayerButton
     * Creates button with "Drop layer" funtionality
     * 
     * Parameters:
     * layer
     * div - {DOMElement} -- div, to which the button should be appended
     *  
     */
    addDropLayerButton: function (layer, div) {
        var button = document.createElement("img");
        button.src =OpenLayers.Util.getImagesLocation()+"/remove_layer.png"; 
        button.width=10;
        button.heigth=10;
        button.alt="Remove layer";
        button.title="Remove layer";
        button.style.margin = "3px";
        button.style.padding = "1px";
        button.style.border = "1px white solid";
        button.style.verticalAlign = "middle";
        div.appendChild(button);
        
        //event
        OpenLayers.Event.observe(button, "mouseup", 
            OpenLayers.Function.bindAsEventListener(this.onRemoveLayerClick,
                                                    {"layer":layer}));

    },

    /** 
     * Method: addMoveLayerButton
     * Creates button with "Move layer up and down" funtionality
     * 
     * Parameters:
     * layer
     * div - {DOMElement} -- div, to which the button should be appended
     *  
     */
    addMoveLayerButton: function (layer, div) {
        var buttonDiv = document.createElement("div");
        buttonDiv.style.padding="0px";
        buttonDiv.style.margin="0px";
        buttonDiv.style.display="inline";

        var buttonUp = document.createElement("img");
        buttonUp.src =OpenLayers.Util.getImagesLocation()+"/move_layer_up.png"; 
        buttonUp.width=10;
        buttonUp.heigth=10;
        buttonUp.alt="Move layer up";
        buttonUp.title="Move layer up";
        buttonUp.style.margin = "3px";
        buttonUp.style.marginRight = "0px";
        buttonUp.style.padding = "1px";
        buttonUp.style.paddingRight = "0px";
        buttonUp.style.border = "1px white solid";
        buttonUp.style.borderRight = "0px";
        buttonUp.style.verticalAlign = "middle";
        buttonDiv.appendChild(buttonUp);

        var buttonDown = document.createElement("img");
        buttonDown.src =OpenLayers.Util.getImagesLocation()+"/move_layer_down.png"; 
        buttonDown.width=10;
        buttonDown.heigth=10;
        buttonDown.alt="Move layer down";
        buttonDown.title="Move layer down";
        buttonDown.style.margin = "3px";
        buttonDown.style.marginLeft = "0px";
        buttonDown.style.padding = "1px";
        buttonDown.style.paddingLeft = "0px";
        buttonDown.style.border = "1px white solid";
        buttonDown.style.borderLeft = "0px";
        buttonDown.style.verticalAlign = "middle";
        buttonDiv.appendChild(buttonDown);

        div.appendChild(buttonDiv);

        //event
        OpenLayers.Event.observe(buttonUp, "mouseup", 
            OpenLayers.Function.bindAsEventListener(this.onMoveLayerClick,
                                                    {"layer":layer,"up":true,layerSwitcher:this}));
        OpenLayers.Event.observe(buttonDown, "mouseup", 
            OpenLayers.Function.bindAsEventListener(this.onMoveLayerClick,
                                                    {"layer":layer,"up":false,layerSwitcher:this}));
    },

    /** 
     * Method: addOpacityLayerButton
     * Creates button with "Set opacity height and down" funtionality
     * 
     * Parameters:
     * layer
     * div - {DOMElement} -- div, to which the button should be appended
     *  
     */
    addOpacityLayerButton: function (layer, div) {
        var buttonDiv = document.createElement("div");
        buttonDiv.style.padding="0px";
        buttonDiv.style.margin="0px";
        buttonDiv.style.display="inline";

        var buttonUp = document.createElement("img");
        buttonUp.src =OpenLayers.Util.getImagesLocation()+"/set_layer_opacity_up.png"; 
        buttonUp.width=10;
        buttonUp.heigth=10;
        buttonUp.alt="Make layer visible";
        buttonUp.title="Make layer visible";
        buttonUp.style.margin = "3px";
        buttonUp.style.marginRight = "0px";
        buttonUp.style.padding = "1px";
        buttonUp.style.paddingRight = "0px";
        buttonUp.style.border = "1px white solid";
        buttonUp.style.borderRight = "0px";
        buttonUp.style.verticalAlign = "middle";
        buttonDiv.appendChild(buttonUp);

        var buttonDown = document.createElement("img");
        buttonDown.src =OpenLayers.Util.getImagesLocation()+"/set_layer_opacity_down.png"; 
        buttonDown.width=10;
        buttonDown.heigth=10;
        buttonDown.alt="Make layer transparent";
        buttonDown.title="Make layer transparent";
        buttonDown.style.margin = "3px";
        buttonDown.style.marginLeft = "0px";
        buttonDown.style.padding = "1px";
        buttonDown.style.paddingLeft = "0px";
        buttonDown.style.border = "1px white solid";
        buttonDown.style.borderLeft = "0px";
        buttonDown.style.verticalAlign = "middle";
        buttonDiv.appendChild(buttonDown);

        div.appendChild(buttonDiv);

        //event
        OpenLayers.Event.observe(buttonUp, "mouseup", 
            OpenLayers.Function.bindAsEventListener(this.onOpacityLayerClick,
                                                    {"layer":layer,"up":true,layerSwitcher:this}));
        OpenLayers.Event.observe(buttonDown, "mouseup", 
            OpenLayers.Function.bindAsEventListener(this.onOpacityLayerClick,
                                                    {"layer":layer,"up":false,layerSwitcher:this}));
    },

    /** 
     * Method: addZoomToLayerExtentButton
     * Creates button with "Zoom to layer extent" funtionality
     * 
     * Parameters:
     * layer
     * div - {DOMElement} -- div, to which the button should be appended
     *  
     */
    addZoomToLayerExtentButton: function (layer, div) {

        var button = document.createElement("img");
        button.src =OpenLayers.Util.getImagesLocation()+"/set_zoom_to_layer_extent.png"; 
        button.width=10;
        button.heigth=10;
        button.alt="Zoom to layer exntent";
        button.title="Zoom to layer exntent";
        button.style.margin = "3px";
        button.style.marginRight = "0px";
        button.style.padding = "1px";
        button.style.paddingRight = "0px";
        button.style.border = "1px white solid";
        button.style.borderRight = "0px";
        button.style.verticalAlign = "middle";
        div.appendChild(button);

        //event
        OpenLayers.Event.observe(button, "mouseup", 
            OpenLayers.Function.bindAsEventListener(this.onZoomToLayer,
                                                    {"layer":layer,layerSwitcher:this}));
    },


    CLASS_NAME: "OpenLayers.Control.LayerSwitcher"
});
