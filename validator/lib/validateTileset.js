'use strict';

var Promise = require('bluebird');
var Cesium = require('cesium');
var defined = Cesium.defined;
var readTile = require('../lib/readTile');
var validateB3dm = require('../lib/validateB3dm');
var validateI3dm = require('../lib/validateI3dm');
var validatePnts = require('../lib/validatePnts');
//var validateCmpt = require('../lib/validateCmpt');

module.exports = validateTileset;

/**
 * Walks down the tree represented by the JSON object and checks if it is a valid tileset.
 *
 * @param {Object} tileset The JSON object representing the tileset.
 * @return {Promise} A promise that resolves with two parameters - (1) a boolean for whether the tileset is valid
 *                                                                 (2) the error message if the tileset is not valid.
 *
 */
function validateTileset(tileset) {
    return new Promise(function(resolve) {
        validateNode(tileset.root, tileset, resolve);
    });
}

function validateNode(root, parent, resolve) {

    var tilePromises = [];

    var stack = [];
    stack.push({
        node: root,
        parent: parent
    });

    while (stack.length > 0) {
        var node = stack.pop();
        var tile = node.node;
        parent = node.parent;

        if (defined(tile.content)) {
            if (defined(tile.content.boundingVolume)) {
                var region = tile.content.boundingVolume.region;
                var parentRegion = tile.boundingVolume.region;
                for (var i = 0; i < region.length; i++) {
                    if (region[i] > parentRegion[i]) {
                        return resolve({
                            result: false,
                            message: 'Child occupies region greater than parent'
                        });
                    }
                }
            }
        }

        if (defined(tile.content) && defined(tile.content.url)) {
            var tileBuffer = readTile(tile.content.url);
            if (defined(tileBuffer)) {
                var magic = tileBuffer.toString('utf8', 0, 4);
                if (magic === 'b3dm') {
                    validateB3dm(tileBuffer)
                        .then(function(result) {
                            if (!result.result) {
                                return resolve({
                                    result : false,
                                    message : 'invalid b3dm'
                                });
                            }
                        });
                } else if (magic === 'i3dm') {
                    validateI3dm(tileBuffer)
                        .then(function(result) {
                            if (!result.result) {
                                return resolve({
                                    result : false,
                                    message : 'invalid i3dm'
                                });
                            }
                        });
                } else if (magic === 'pnts') {
                    validatePnts(tileBuffer)
                        .then(function(result) {
                            if (!result.result) {
                                return resolve({
                                    result : false,
                                    message : 'invalid pnts'
                                });
                            }
                        });
                } else if (magic === 'cmpt') {
                    /*
                    validateCmpt(tileBuffer)
                        .then(function(result) {
                            if (!result.result) {
                                return resolve({
                                    result : false,
                                    message : 'invalid cmpt'
                                });
                            }
                        });
                    */
                }
            }
        }

        if (tile.geometricError > parent.geometricError) {
            return resolve({
                result : false,
                message : 'Child has geometricError greater than parent'
            });
        }

        if (defined(tile.children)) {
            var length = tile.children.length;
            for (var i = 0; i < length; i++) {
                stack.push({
                    node: tile.children[i],
                    parent: tile
                });
            }
        }
    }

    return resolve({
        result : true,
        message : 'Tileset is valid'
    });
}