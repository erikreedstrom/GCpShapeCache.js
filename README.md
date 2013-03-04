GCpShapeCache.js
================

Direct port of GCpShapeCache to JavaScript for use with ChipmunkJS and PhysicsEditor.

About
-----
In an attempt to fill a large gap in the development pipeline for ChipmunkJS, the generic shape loader for JS was ported from its Obj-C counterpart. This is as close to a 1:1 port as was possible, matching the API of the Obj-C version. As such, the code has not been optimized for performance.

Usage
-----
Use the loader as you would the Obj-C version:

	// load physics data
	var sc = gcp.ShapeCache.getInstance();
    sc.addShapesWithFile("shapedefs.plist");
    	
	// set anchor point
	sprite.anchorPoint = sc.anchorPointForShape(name);
    	
	// create the physics shape
	var body = sc.createBodyWithName(name, space, sprite);
                                  
	// set position                                  
	body.p = new cc.Point(x,y);