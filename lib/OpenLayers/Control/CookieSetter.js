/**
 * @requires OpenLayers/Control.js
 *
 * Class: OpenLayers.Control.CookieSetter
 * 
 * Inherits from:
 *  - <OpenLayers.Control>
 */
OpenLayers.Control.CookieSetter = OpenLayers.Class(OpenLayers.Control, {
    /**
     * APIMethod: destroy
     */
    destroy: function()  {
        this.element = null;

        this.map.events.unregister('moveend', this, this.updateLink);

        OpenLayers.Control.prototype.destroy.apply(this, arguments); 
    },

    /**
     * Method: setMap
     * Set the map property for the control. 
     * 
     * Parameters:
     * map - {<OpenLayers.Map>} 
     */
    setMap: function(map) {
        OpenLayers.Control.prototype.setMap.apply(this, arguments);

        //make sure we have an cookie arg parser attached
        for(var i=0; i< this.map.controls.length; i++) {
            var control = this.map.controls[i];
            if (control.CLASS_NAME == "OpenLayers.Control.CookieArgParser") {
                break;
            }
        }
        if (i == this.map.controls.length) {
            this.map.addControl(new OpenLayers.Control.CookieArgParser());
        }

    },

    /**
     * Method: draw
     */    
    draw: function() {
        OpenLayers.Control.prototype.draw.apply(this, arguments);
          
        this.map.events.register('moveend', this, this.updateLink);
    },

    /**
     * Method: updateLink 
     */
    updateLink: function() {
		var MAX_SESSIONS = 10;
		Array.prototype.remove = function(from, to) {
			var rest = this.slice((to || from) + 1 || this.length);
			this.length = from < 0 ? this.length + from : from;
			return this.push.apply(this, rest);
		};

		if (typeof flight_id !== "undefined")
			var id = flight_id;
		else if (typeof airport_id !== "undefined")
			var id = airport_id;
		else if (typeof flex_id !== "undefined")
			var id = flex_id;

		var junk = get_panzoom();
		var sessions = junk[1];
		var session_list = junk[0];

		var match = [], highest = 0;
		for (var x = 0; x < session_list.length; x++) {
			if (sessions[session_list[x]].id == id && sessions[session_list[x]].size == mapsize)
				match = [x, session_list[x]];
			var highest = Math.max(highest, session_list[x]);
		}

		if (match.length) {
			session_list.remove(match[0]);
			session_list.push(match[1]);
		} else {
			session_list.push(highest + 1);
		}
		if (session_list.length > MAX_SESSIONS) {
			var destroy = session_list.shift();
			document.cookie = "session_" + destroy + "=; expires=" + (new Date()).toGMTString() + "; path=/";
		}

		document.cookie = "session_list=" + session_list.join(",") + "; path=/";

		var x = match[1] || highest + 1;
        var center = this.map.getCenter();
		document.cookie = "session_" + x + "=id=" + id + "|center=" + center.lon + "," + center.lat + "|zoom=" + this.map.getZoom() + "|size=" + mapsize + "; path=/";
    }, 

    CLASS_NAME: "OpenLayers.Control.CookieSetter"
});
