'use strict';
const Cesium = require('cesium');
const path = require('path');
const Promise = require('bluebird');

const isDataUri = require('./isDataUri');
const isTile = require('./isTile');
const utility = require('./utility');
const validateExtensions = require('./validateExtensions');
const validateTile = require('./validateTile');

const Cartesian3 = Cesium.Cartesian3;
const clone = Cesium.clone;
const defined = Cesium.defined;
const Matrix3 = Cesium.Matrix3;
const Matrix4 = Cesium.Matrix4;

const boxInsideBox = utility.boxInsideBox;
const boxInsideSphere = utility.boxInsideSphere;
const regionInsideRegion = utility.regionInsideRegion;
const sphereInsideBox = utility.sphereInsideBox;
const sphereInsideSphere = utility.sphereInsideSphere;

module.exports = validateTileset;

/**
 * Check if a tileset is valid, including the tileset JSON and all tiles referenced within.
 *
 * @param {Object} options An object with the following properties:
 * @param {Object} options.tileset The tileset JSON.
 * @param {String} options.filePath The tileset JSON file path.
 * @param {Boolean} options.onlyValidateTilesets Only check tilesets, skip any other tile type.
 * @param {String} options.directory The directory containing the tileset JSON that all paths in the tileset JSON are relative to.
 * @returns {Promise} A promise that resolves when the validation completes. If the validation fails, the promise will resolve to an error message.
 */
async function validateTileset(options) {
    const tileset = options.tileset;
    let message = validateTopLevel(tileset);
    if (defined(message)) {
        return message;
    }
    message = validateExtensions(options);
    if (defined(message)) {
        return message;
    }
    options.version = tileset.asset.version;
    return validateTileHierarchy(tileset.root, options);
}

function validateTopLevel(tileset) {
    if (!defined(tileset.geometricError)) {
        return 'Tileset must declare its geometricError as a top-level property.';
    }

    if (!defined(tileset.root.refine)) {
        return 'Tileset must define refine property in root tile';
    }

    if (!defined(tileset.asset)) {
        return 'Tileset must declare its asset as a top-level property.';
    }

    if (!defined(tileset.asset.version)) {
        return 'Tileset must declare a version in its asset property';
    }

    if (tileset.asset.version !== '1.0' && tileset.asset.version !== '2.0.0-alpha.0') {
        return `Tileset version must be 1.0 or 2.0.0-alpha.0. Tileset version provided: ${tileset.asset.version}`;
    }
}

async function validateTileHierarchy(root, options) {
    const filePath = options.filePath;
    const directory = options.directory;
    const contentPaths = [];

    const stack = [];
    stack.push({
        tile: root,
        parent: undefined
    });

    while (stack.length > 0) {
        const node = stack.pop();
        const tile = node.tile;
        const parent = node.parent;
        const content = tile.content;

        if (!defined(tile.geometricError)) {
            return getTileErrorMessage('Each tile must define geometricError', tile);
        }

        if (tile.geometricError < 0.0) {
            return getTileErrorMessage('geometricError must be greater than or equal to 0.0', tile);
        }

        if (defined(parent) && (tile.geometricError > parent.geometricError)) {
            return getTileErrorMessage('Child has geometricError greater than parent', tile);
        }

        if (defined(content) && defined(content.uri)) {
            if (isDataUri(content.uri)) {
                contentPaths.push(content.uri);
            } else if (!options.onlyValidateTilesets || content.uri.endsWith('.json')) {
                contentPaths.push(path.join(directory, content.uri));
            }
        }

        if (defined(content) && defined(content.boundingVolume)) {
            let outerTransform = Matrix4.IDENTITY;
            if (defined(tile.transform)) {
                outerTransform = Matrix4.fromArray(tile.transform);
            }
            const innerTransform = Matrix4.IDENTITY;
            const message = checkBoundingVolume(content.boundingVolume, tile.boundingVolume, innerTransform, outerTransform);
            if (defined(message)) {
                return getTileErrorMessage(`content bounding volume is not within tile bounding volume: ${message}`, tile);
            }
        }

        if (defined(tile.refine)) {
            if (tile.refine !== 'ADD' && tile.refine !== 'REPLACE') {
                return getTileErrorMessage('Refine property in tile must have either "ADD" or "REPLACE" as its value.', tile);
            }
        }

        const children = tile.children;
        if (defined(children)) {
            const length = children.length;
            for (let i = 0; i < length; i++) {
                stack.push({
                    tile: children[i],
                    parent: tile
                });
            }
        }
    }

    let completed = 0;
    const contentPathsLength = contentPaths.length;
    console.log(`Validating ${filePath} - ${contentPathsLength} sub tiles`);

    const messages = await Promise.map(contentPaths, async contentPath => {
        const message = await validateContent(contentPath, directory, options);
        completed++;
        if (completed % 32 === 0) {
            console.log(`[${filePath}] ${100 * completed / contentPathsLength}% done`);
        }
        return message;
    });
    let message = '';
    for (let i = 0; i < messages.length; i++) {
        if (defined(messages[i])) {
            message += `Error in ${contentPaths[i]}: ${messages[i]}\n`;
        }
    }
    if (message === '') {
        return undefined;
    }
    return message;
}

async function validateContent(contentPath, directory, options) {
    const reader = options.reader;
    try {
        if (isDataUri(contentPath)) {
            if (options.onlyValidateTilesets) {
                return;
            }
            const content = Buffer.from(contentPath.split(',')[1], 'base64');
            return await validateTile({
                content: content,
                filePath: contentPath,
                directory: directory,
                writeReports: options.writeReports
            });
        } else if (isTile(contentPath, options)) {
            if (options.onlyValidateTilesets) {
                return;
            }
            contentPath = utility.normalizePath(contentPath);
            return await validateTile({
                reader: reader,
                content: await reader.readBinary(contentPath),
                filePath: contentPath,
                directory: path.dirname(contentPath),
                writeReports: options.writeReports
            });
        }
        contentPath = utility.normalizePath(contentPath);
        return await validateTileset({
            reader: reader,
            tileset: await reader.readJson(contentPath),
            filePath: contentPath,
            directory: path.dirname(contentPath),
            writeReports: options.writeReports,
            onlyValidateTilesets: options.onlyValidateTilesets
        });
    } catch (error) {
        console.log(`Could not read file: ${error.message}`);
    }
}

function checkBoundingVolume(innerBoundingVolume, outerBoundingVolume, innerTransform, outerTransform) {
    if (defined(innerBoundingVolume.box) && defined(outerBoundingVolume.box)) {
        // Box in Box check
        const transformedInnerTile = getTransformedBox(innerBoundingVolume.box, innerTransform);
        const transformedOuterTile = getTransformedBox(outerBoundingVolume.box, outerTransform);
        if (!boxInsideBox(transformedInnerTile, transformedOuterTile)) {
            return `box [${innerBoundingVolume.box}] is not within box [${outerBoundingVolume.box}]`;
        }
    } else if (defined(innerBoundingVolume.sphere) && defined(outerBoundingVolume.sphere)) {
        // Sphere in Sphere
        const transformedInnerTile = getTransformedSphere(innerBoundingVolume.sphere, innerTransform);
        const transformedOuterTile = getTransformedSphere(outerBoundingVolume.sphere, outerTransform);
        if (!sphereInsideSphere(transformedInnerTile, transformedOuterTile)) {
            return `sphere [${innerBoundingVolume.sphere}] is not within sphere [${outerBoundingVolume.sphere}]`;
        }
    } else if (defined(innerBoundingVolume.region)&& defined(outerBoundingVolume.region)) {
        // Region in Region
        // Region does not update with transform
        const transformedInnerTile = innerBoundingVolume.region;
        const transformedOuterTile = outerBoundingVolume.region;
        if (!regionInsideRegion(transformedInnerTile, transformedOuterTile)) {
            return `region [${innerBoundingVolume.region}] is not within region [${outerBoundingVolume.region}]`;
        }
    } else if (defined(innerBoundingVolume.box) && defined(outerBoundingVolume.sphere)) {
        // Box in Sphere
        const transformedInnerTile = getTransformedBox(innerBoundingVolume.box, innerTransform);
        const transformedOuterTile = getTransformedSphere(outerBoundingVolume.sphere, outerTransform);
        if (!boxInsideSphere(transformedInnerTile, transformedOuterTile)) {
            return `box [${innerBoundingVolume.box}] is not within sphere [${outerBoundingVolume.sphere}]`;
        }
    } else if (defined(innerBoundingVolume.sphere) && defined(outerBoundingVolume.box)) {
        // Sphere in Box
        const transformedInnerTile = getTransformedSphere(innerBoundingVolume.sphere, innerTransform);
        const transformedOuterTile = getTransformedBox(outerBoundingVolume.box, outerTransform);
        if (!sphereInsideBox(transformedInnerTile, transformedOuterTile)) {
            return `sphere [${innerBoundingVolume.sphere}] is not within box [${outerBoundingVolume.box}]`;
        }
    }
}

const scratchMatrix = new Matrix3();
const scratchHalfAxes = new Matrix3();
const scratchCenter = new Cartesian3();
const scratchScale = new Cartesian3();

function getTransformedBox(box, transform) {
    let center = Cartesian3.fromElements(box[0], box[1], box[2], scratchCenter);
    let halfAxes = Matrix3.fromArray(box, 3, scratchHalfAxes);

    // Find the transformed center and halfAxes
    center = Matrix4.multiplyByPoint(transform, center, center);
    const rotationScale = Matrix4.getMatrix3(transform, scratchMatrix);
    halfAxes = Matrix3.multiply(rotationScale, halfAxes, halfAxes);

    // Return a Box array
    const returnBox = [center.x, center.y, center.z, halfAxes[0], halfAxes[3], halfAxes[6], halfAxes[1], halfAxes[4], halfAxes[7], halfAxes[2], halfAxes[5], halfAxes[8]];
    return returnBox;
}

function getTransformedSphere(sphere, transform) {
    let center = Cartesian3.fromElements(sphere[0], sphere[1], sphere[2], scratchCenter);
    let radius = sphere[3];

    // Find the transformed center and radius
    center = Matrix4.multiplyByPoint(transform, center, center);
    const scale = Matrix4.getScale(transform, scratchScale);
    const uniformScale = Cartesian3.maximumComponent(scale);
    radius *= uniformScale;

    // Return a Sphere array
    const returnSphere = [center.x, center.y, center.z, radius];
    return returnSphere;
}

function getTileErrorMessage(originalMessage, tile) {
    tile = clone(tile, false);
    delete tile.children;
    const stringJson = JSON.stringify(tile, undefined, 4);
    const newMessage = `${originalMessage}\n${stringJson}`;
    return newMessage;
}
