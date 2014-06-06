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
		var EXPIRE_HOURS = 48;
		var MAX_SESSIONS = {
			"persist": 2,
			"session": 10
		};

		Array.prototype.remove = function(from, to) {
			var rest = this.slice((to || from) + 1 || this.length);
			this.length = from < 0 ? this.length + from : from;
			return this.push.apply(this, rest);
		};

		if (typeof fa_tv_map !== "undefined") {
			switch (fa_tv_map.type) {
				case "fleet":
					var id = "TV_FLEET";
					break;
				case "airport":
					var id = "TV_" + airport_id;
					break;
			}
		} else if (typeof flight_id !== "undefined")
			var id = flight_id;
		else if (typeof airport_id !== "undefined")
			var id = airport_id;
		else if (typeof flex_id !== "undefined")
			var id = flex_id;
		else if (typeof nearby_id !== "undefined")
			var id = nearby_id;

		var persistence_type = get_persistence_type();
		var all_sessions = get_panzoom(persistence_type);
		var sessions = all_sessions[1];
		var session_list = all_sessions[0];

		var match = [], highest = 0;
		for (var x = 0; x < session_list.length; x++) {
			if (sessions[session_list[x]].id == id && sessions[session_list[x]].size == mapsize)
				match = [x, session_list[x]];
			var highest = Math.max(highest, session_list[x]);
		}

		if (persistence_type === "persist") {
			var date = new Date();
			date.setTime(date.getTime() + EXPIRE_HOURS * 60 * 60 * 1000);
			var expire = "expires=" + date.toGMTString();
		} else
			var expire = "";

		if (match.length) {
			session_list.remove(match[0]);
			session_list.push(match[1]);
		} else {
			session_list.push(highest + 1);
		}
		if (session_list.length > MAX_SESSIONS[persistence_type]) {
			var destroy = session_list.shift();
			document.cookie = persistence_type+"_" + destroy + "=; expires=" + (new Date()).toGMTString() + "; path=/";
		}

		document.cookie = persistence_type+"_list=" + session_list.join(",") + "; " + expire + "; path=/";

		var x = match[1] || highest + 1;
        var center = this.map.getCenter();
		document.cookie = persistence_type+"_" + x + "=id=" + id + "|center=" + center.lon + "," + center.lat + "|zoom=" + this.map.getZoom() + "|size=" + mapsize + "; " + expire + "; path=/";
    }, 

    CLASS_NAME: "OpenLayers.Control.CookieSetter"
});
