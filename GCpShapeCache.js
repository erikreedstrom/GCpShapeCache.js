//
//  GCpShapeCache.js
//  
//  All rights reserved.
//	
//  Loads physics sprites created with http://www.PhysicsEditor.de
//
//  Generic Shape Cache for Chipmunk
//
//  Copyright by Andreas Loew
//      http://www.PhysicsEditor.de
//      http://texturepacker.com
//      http://www.code-and-web.de
//
//  All rights reserved.
//
//  Permission is hereby granted, free of charge, to any person obtaining a copy
//  of this software and associated documentation files (the "Software"), to deal
//  in the Software without restriction, including without limitation the rights
//  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//  copies of the Software, and to permit persons to whom the Software is
//  furnished to do so, subject to the following conditions:
//
//  The above copyright notice and this permission notice shall be included in
//  all copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
//  THE SOFTWARE.
//

var gcp = gcp || {};

gcp._pointFromString = function(str)
{
    var coords = str.replace(/[{}]/g, "").trim().split(",");
    return cp.v(parseFloat(coords[0]),parseFloat(coords[1]));
};

/**
 * Shape cache
 * This class holds the shapes and makes them accessible
 */
gcp.ShapeCache = cc.Class.extend({

    bodyDefs: null,

    /**
     * Constructor
     */
    ctor:function () {
        this.bodyDefs = {};
    },

    /**
     * Adds shapes to the shape cache
     * @param plist name of the plist file to load
     * @result false in case of error
     */
    addShapesWithFile: function (plist) {
        //in html5
        cc.loader.loadTxt(plist, function (err, txt) {
            try{
                if (!err) {
                    var dictionary = cc.plistParser.parse(txt);
                    this.processData(dictionary);
                }
            }catch(e){
                throw e;
            }
        }.bind(this));
        //in jsb
//        var dictionary = cc.plistParser.parse(plist);
//        this.processData(dictionary);
    },

    processData: function (dictionary) {
        cc.assert(dictionary, "");

        var metadataDict = dictionary["metadata"];
        var format = parseInt(metadataDict["format"]);

        cc.assert(format == 1, "Format not supported");
        if(format != 1) return false;

        var bodyDict = dictionary["bodies"];

        for(var bodyName in bodyDict)
        {
            // get the body data
            var bodyData = bodyDict[bodyName];

            // create body object
            var bodyDef = new g.BodyDef();

            // add the body element to the hash
            this.bodyDefs[bodyName] = bodyDef;

            // set anchor point
            bodyDef.anchorPoint = gcp._pointFromString(bodyData["anchorpoint"]);

            // iterate through the fixtures
            var fixtureList = bodyData["fixtures"];

            var totalMass = 0.0;
            var totalBodyMomentum = 0.0;
            for(var fixtureIndex in fixtureList)
            {
                // get the fixture data
                var fixtureData = fixtureList[fixtureIndex];

                // create fixture
                var fd = new g.FixtureData();
                if(!fd) return false;

                // add the fixture to the body
                bodyDef.fixtures.push(fd);

                fd.friction = parseFloat(fixtureData["friction"]);
                fd.elasticity = parseFloat(fixtureData["elasticity"]);
                fd.mass = parseFloat(fixtureData["mass"]);
                fd.surfaceVelocity = gcp._pointFromString(fixtureData["surface_velocity"]);
                fd.layers = parseInt(fixtureData["layers"]);
                fd.group = parseInt(fixtureData["group"]);
                fd.collisionType = parseInt(fixtureData["collision_type"]);
                fd.isSensor = fixtureData["isSensor"] === true;

//                var fixtureType = fixtureData["fixture_type"];
                var circleObject = fixtureData["circle"];
                var polygonsArray = fixtureData["polygons"];
                if (circleObject) {
                    fd.fixtureType = "CIRCLE";
                } else if (polygonsArray) {
                    fd.fixtureType = "POLYGON";
                }

                var totalArea = 0.0;

                // sum up total mass for the body
                totalMass += fd.mass;

                // read polygon fixtures. One concave fixture may consist of several convex polygons
                if(fd.fixtureType === "POLYGON")
                {
                    for(var polygonIndex in polygonsArray)
                    {
                        var polygonArray = polygonsArray[polygonIndex];

                        var poly = new g.Polygon();
                        if(!poly) return false;

                        // add the polygon to the fixture
                        fd.polygons.push(poly);

                        // add vertices
                        poly.numVertices = polygonArray.length;
                        // ChipmunkJS flattens vert calculations
                        var vertices = poly.vertices = new Array(poly.numVertices * 2);
                        if(!vertices) return false;

                        var tempVerts = [];
                        var vindex = 0;
                        for(var pointStringIndex in polygonArray)
                        {
                            var pointString = polygonArray[pointStringIndex];
                            var offset = gcp._pointFromString(pointString);
                            vertices[vindex] = offset.x;
                            vertices[vindex+1] = offset.y;
                            tempVerts.push(cp.v(offset.x,offset.y));
                            vindex+= 2;
                        }

                        // calculate area of the polygon (needed to calculate the mass)
                        poly.area = cp.areaForPoly(vertices);

                        // add up all area
                        totalArea += poly.area;
                    }
                }
                else if (fd.fixtureType === "CIRCLE")
                {
                    fd.radius = parseFloat(circleObject["radius"]);
                    fd.center = gcp._pointFromString(circleObject["position"]);
                    totalArea += 3.1415927 * fd.radius * fd.radius;
                }
                else
                {
                    // unknown type
                    cc.assert(0, "")
                }

                fd.area = totalArea;

                // update sub polygon's masses and momentum
                var totalFixtureMomentum = 0.0;

                if(totalArea)
                {
                    if (fd.fixtureType === "CIRCLE")
                    {
                        totalFixtureMomentum += cp.momentForCircle(fd.mass, 0/*fd.radius*/, fd.radius, fd.center);
                    }
                    else if (fd.fixtureType === "POLYGON")
                    {
                        for(var pIndex in fd.polygons)
                        {
                            var p = fd.polygons[pIndex];

                            // update mass
                            p.mass = (p.area * fd.mass) / fd.area;

                            // calculate momentum
                            p.momentum = cp.momentForPoly(p.mass, p.vertices, cp.v(0, 0));

                            // calculate total momentum
                            totalFixtureMomentum += p.momentum;
                        }
                    }
                }
                fd.momentum = totalFixtureMomentum;
                totalBodyMomentum = totalFixtureMomentum;
            }

            // set bodies total mass
            bodyDef.mass = totalMass;
            bodyDef.momentum = totalBodyMomentum;
        }
    },

    /**
     * Creates a body with the given name in the given space.
     * @param name name of the body
     * @param space pointer to the space
     * @param data data to set in the body
     * @result new created body
     */
    createBodyWithName: function (name, space, data) {
        var bd = this.bodyDefs[name];
        cc.assert(bd != 0, "Body not found");
        if(!bd) return 0;

        // create and add body to space
        var body = new cp.Body(bd.mass, bd.momentum);

        // set the center point
        body.p = bd.anchorPoint;

        // set the data
        body.data = data;

        // add space to body
        space.addBody(body);

        // iterate over fixtures
        for(var fdIndex in bd.fixtures)
        {
            var fd = bd.fixtures[fdIndex];
            var shape;
            if (fd.fixtureType === "CIRCLE")
            {
                //create new shape
                shape = new cp.CircleShape(body, fd.radius, fd.center);

                // set values
                shape.e = fd.elasticity;
                shape.u = fd.friction;
                shape.surface_v = fd.surfaceVelocity;
                shape.collision_type = fd.collisionType;
                shape.group = fd.group;
                shape.layers = fd.layers;
                shape.sensor = fd.isSensor;

                // add shape to space
                space.addShape(shape);
            }
            else if (fd.fixtureType === "POLYGON")
            {
                // iterate over polygons
                for(var pIndex in fd.polygons)
                {
                    var p = fd.polygons[pIndex];

                    // create new shape
                    shape = new cp.PolyShape(body, p.vertices, cp.v(0,0));

                    // set values
                    shape.e = fd.elasticity;
                    shape.u = fd.friction;
                    shape.surface_v = fd.surfaceVelocity;
                    shape.collision_type = fd.collisionType;
                    shape.group = fd.group;
                    shape.layers = fd.layers;
                    shape.sensor = fd.isSensor;

                    // add shape to space
                    space.addShape(shape);
                }
            }
        }
        return body;
    },

    /**
     * Returns the anchor point of the given sprite
     * @param shape name of the shape to get the anchorpoint for
     * @return anchorpoint
     */
    anchorPointForShape: function (shape) {
        var bd = this.bodyDefs[shape];
        cc.assert(bd, "");
        return bd.anchorPoint;
    }

});

gcp.s_sharedShapeCache = null;

/**
 * Returns the shared instance of the Shape cache
 * @return {gcp.ShapeCache}
 */
gcp.ShapeCache.getInstance = function () {
    if (!gcp.s_sharedShapeCache) {
        gcp.s_sharedShapeCache = new gcp.ShapeCache();
    }
    return gcp.s_sharedShapeCache;
};

/**
 * Purges the cache. It releases all the Sprite Frames and the retained instance.
 */
gcp.ShapeCache.purgeSharedShapeCache = function () {
    gcp.s_sharedShapeCache = null;
};


var g = g || {};

g.Polygon = cc.Class.extend({
    vertices:null,
    numVertices:0,
    area:0.0,
    mass:0.0,
    momentum:0.0
});

/**
 * Fixture definition
 * Holds fixture data
 */
g.FixtureData = cc.Class.extend({
    fixtureType:null,
    mass:0.0,
    elasticity:0.0,
    friction:0.0,
    surfaceVelocity:null,
    collisionType:null,
    group:null,
    layers:null,
    area:0.0,
    momentum:0.0,
    isSensor:false,
    //for circle
    radius:0.0,
    center:null,
    //for polygons
    polygons:null,

    ctor:function(){
        this.polygons = [];
    }
});

/**
 * Body definition
 * Holds the body and the anchor point
 */
g.BodyDef = cc.Class.extend({
    anchorPoint:null,
    fixtures:null,
    mass:0.0,
    momentum:0.0,

    ctor:function(){
        this.fixtures = [];
    }
});
