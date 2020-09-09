'use strict';

import { FeatureTableUtils } from './featureMetatableUtilsNext';
import { Material, TexturedMaterial } from './Material';
import { TranslucencyType, BaseColorType } from './colorTypes';

const Cesium = require('cesium');
const util = require('./utility');

const Cartesian3 = Cesium.Cartesian3;
const CesiumMath = Cesium.Math;
const defaultValue = Cesium.defaultValue;
const Matrix4 = Cesium.Matrix4;
const Quaternion = Cesium.Quaternion;

const metersToLongitude = util.metersToLongitude;
const metersToLatitude = util.metersToLatitude;

const scratchTranslation = new Cartesian3();
const scratchRotation = new Quaternion();
const scratchScale = new Cartesian3();

const whiteOpaqueMaterial = new Material([1.0, 1.0, 1.0, 1.0]);
const whiteTranslucentMaterial = new Material([1.0, 1.0, 1.0, 0.5]);
const texturedMaterial = new TexturedMaterial('data/wood_red.jpg');
const texturedCompressedMaterial = new TexturedMaterial('data/wood_red.ktx2');
const redMaterial = new Material([1.0, 0.0, 0.0, 1.0]);

/**
 * Creates a set of buildings that will be converted to a b3dm tile.
 *
 * @param {Object} [options] Object with the following properties:
 * @param {Boolean} [options.uniform=false] Whether to create uniformly sized and spaced buildings.
 * @param {Number} [options.numberOfBuildings=10] The number of buildings to create.
 * @param {Number} [options.tileWidth=200.0] The width of the tile in meters. Buildings are placed randomly in this area.
 * @param {Number} [options.averageWidth=4.0] Average building width in meters around which random widths and depths are generated.
 * @param {Number} [options.averageHeight=5.0] Average building height in meters around which random heights are generated.
 * @param {String} [options.baseColorType=BaseColorType.White] Specifies the type of diffuse color to apply to the tile.
 * @param {String} [options.translucencyType=TranslucencyType.Opaque] Specifies the type of translucency to apply to the tile.
 * @param {Number} [options.longitude=-1.31968] The center longitude of the tile. Used to generate metadata for the batch table.
 * @param {Number} [options.latitude=0.698874] The center latitude of the tile. Used to generate metadata for the batch table.
 * @param {Number} [options.seed=11] The random seed to use.
 *
 * @returns {Building[]} An array of buildings.
 */
export function createBuildings(options: FeatureTableUtils.BuildingGenerationOptions): Building[] {
    options = defaultValue(options, {});
    options.seed = defaultValue(options.seed, 11);
    options.numberOfBuildings = defaultValue(options.numberOfBuildings, 10);
    options.tileWidth = defaultValue(options.tileWidth, 200.0);
    options.averageWidth = defaultValue(options.averageWidth, 4.0);
    options.averageHeight = defaultValue(options.averageHeight, 5.0);
    options.baseColorType = defaultValue(options.baseColorType, BaseColorType.White);
    options.translucencyType = defaultValue(options.translucencyType, TranslucencyType.Opaque);
    options.longitude = defaultValue(options.longitude, -1.31968);
    options.latitude = defaultValue(options.latitude, 0.698874);

    if (options.uniform) {
        return createUniformBuildings(options);
    }
    return createRandomBuildings(options);
}

function createUniformBuildings(options): Building[] {
    const numberOfBuildings = options.numberOfBuildings;
    const tileWidth = options.tileWidth;
    const centerLongitude = options.longitude;
    const centerLatitude = options.latitude;

    const buildingsPerAxis = Math.sqrt(numberOfBuildings);
    const buildingWidth = tileWidth / (buildingsPerAxis * 3);
    const buildings = [];

    for (let i = 0; i < buildingsPerAxis; ++i) {
        for (let j = 0; j < buildingsPerAxis; ++j) {
            const x = buildingWidth * 1.5 + i * buildingWidth * 3.0 - tileWidth / 2.0;
            const y = buildingWidth * 1.5 + j * buildingWidth * 3.0 - tileWidth / 2.0;
            const z = buildingWidth / 2.0;
            const rangeX = x / tileWidth - 0.5;
            const rangeY = y / tileWidth - 0.5;

            const translation = Cartesian3.fromElements(x, y, z, scratchTranslation);
            const rotation = Quaternion.clone(Quaternion.IDENTITY, scratchRotation);
            const scale = Cartesian3.fromElements(buildingWidth, buildingWidth, buildingWidth, scratchScale);
            const matrix = Matrix4.fromTranslationQuaternionRotationScale(translation, rotation, scale, new Matrix4());

            const longitudeExtent = metersToLongitude(tileWidth, centerLatitude);
            const latitudeExtent = metersToLatitude(tileWidth, centerLongitude);
            const longitude = centerLongitude + rangeX * longitudeExtent;
            const latitude = centerLatitude + rangeY * latitudeExtent;

            buildings.push(new Building({
                matrix : matrix,
                material : whiteOpaqueMaterial,
                longitude : longitude,
                latitude : latitude,
                height : buildingWidth
            }));
        }
    }

    return buildings;
}

function createRandomBuildings(options): Building[] {
    const seed = options.seed;
    const numberOfBuildings = options.numberOfBuildings;
    const tileWidth = options.tileWidth;
    const averageWidth = options.averageWidth;
    const averageHeight = options.averageHeight;
    const baseColorType = options.baseColorType;
    const translucencyType = options.translucencyType;
    const centerLongitude = options.longitude;
    const centerLatitude = options.latitude;

    // Set the random number seed before creating materials
    CesiumMath.setRandomNumberSeed(seed);
    const materials = new Array(numberOfBuildings);
    let i;
    for (i = 0; i < numberOfBuildings; ++i) {
        // For CesiumJS testing purposes make the first building red
        const useRedMaterial = (baseColorType === BaseColorType.Color) && 
                               (translucencyType === TranslucencyType.Opaque) && 
                               i === 0;
        const randomMaterial = getMaterial(baseColorType, translucencyType, i, numberOfBuildings);
        materials[i] = (useRedMaterial) ? redMaterial : randomMaterial;
    }

    // Set the random number seed before creating buildings so that the generated buildings are the same between runs
    CesiumMath.setRandomNumberSeed(seed);
    const buildings = new Array(numberOfBuildings);
    for (i = 0; i < numberOfBuildings; ++i) {
        // Create buildings with the z-axis as up
        const width = Math.max(averageWidth + (CesiumMath.nextRandomNumber() - 0.5) * 8.0, 1.0);
        const depth = Math.max(width + (CesiumMath.nextRandomNumber() - 0.5) * 4.0, 1.0);
        const height = Math.max(averageHeight + (CesiumMath.nextRandomNumber() - 0.5) * 8.0, 1.0);
        const minX = -tileWidth / 2.0 + width / 2.0;
        const maxX = tileWidth / 2.0 - width / 2.0;
        const minY = -tileWidth / 2.0 + depth / 2.0;
        const maxY = tileWidth / 2.0 - depth / 2.0;
        let rangeX = CesiumMath.nextRandomNumber() - 0.5;
        let rangeY = CesiumMath.nextRandomNumber() - 0.5;

        // For CesiumJS testing purposes, always place one building in the center of the tile and make it red
        if (i === 0) {
            rangeX = 0.0;
            rangeY = 0.0;
        }

        let x = rangeX * tileWidth;
        let y = rangeY * tileWidth;
        x = CesiumMath.clamp(x, minX, maxX);
        y = CesiumMath.clamp(y, minY, maxY);
        const z = height / 2.0;

        const translation = Cartesian3.fromElements(x, y, z, scratchTranslation);
        const rotation = Quaternion.clone(Quaternion.IDENTITY, scratchRotation);
        const scale = Cartesian3.fromElements(width, depth, height, scratchScale);
        const matrix = Matrix4.fromTranslationQuaternionRotationScale(translation, rotation, scale, new Matrix4());

        const longitudeExtent = metersToLongitude(tileWidth, centerLatitude);
        const latitudeExtent = metersToLatitude(tileWidth, centerLongitude);
        const longitude = centerLongitude + rangeX * longitudeExtent;
        const latitude = centerLatitude + rangeY * latitudeExtent;

        buildings[i] = new Building({
            matrix : matrix,
            material : materials[i],
            longitude : longitude,
            latitude : latitude,
            height : height
        });
    }

    return buildings;
}

export interface Building {
    matrix: object; // Cesium.Matrix4 TODO: proper types
    material: Material;
    longitude: number;
    latitude: number;
    height: number
}

/**
 * Information that describes a building, including position, appearance, and metadata.
 *
 * @param {Object} options Object with the following properties:
 * @param {Matrix4} options.matrix The matrix defining the position and size of the building.
 * @param {Material} options.material The material of the building.
 * @param {Number} options.longitude Longitude of the building - metadata for the batch table.
 * @param {Number} options.latitude Latitude of the building - metadata for the batch table.
 * @param {Number} options.height Height of the building - metadata for the batch table.
 *
 * @constructor
 * @private
 */
function Building(options) {
    this.matrix = options.matrix;
    this.material = options.material;
    this.longitude = options.longitude;
    this.latitude = options.latitude;
    this.height = options.height;
}

function getRandomColorMaterial(alpha) {
    const red = CesiumMath.nextRandomNumber();
    const green = CesiumMath.nextRandomNumber();
    const blue = CesiumMath.nextRandomNumber();
    return new Material([red, green, blue, alpha]);
}

function getMaterial(
    baseColorType: BaseColorType, 
    translucencyType: TranslucencyType, 
    buildingIndex: number, 
    numberOfBuildings: number
): Material | TexturedMaterial {
    const firstHalf = (buildingIndex < numberOfBuildings / 2);
    if (baseColorType === BaseColorType.White) {
        if (translucencyType === TranslucencyType.Opaque) {
            return whiteOpaqueMaterial;
        } else if (translucencyType === TranslucencyType.Translucent) {
            return whiteTranslucentMaterial;
        } else if (translucencyType === TranslucencyType.Mix) {
            return firstHalf ? whiteOpaqueMaterial : whiteTranslucentMaterial;
        }
    } else if (baseColorType === BaseColorType.Color) {
        if (translucencyType === TranslucencyType.Opaque) {
            return getRandomColorMaterial(1.0);
        } else if (translucencyType === TranslucencyType.Translucent) {
            return getRandomColorMaterial(0.5);
        } else if (translucencyType === TranslucencyType.Mix) {
            const alpha = (firstHalf) ? 1.0 : 0.5;
            return getRandomColorMaterial(alpha);
        }
    } else if (baseColorType === BaseColorType.Texture) {
        return texturedMaterial;
    } else if (baseColorType === BaseColorType.CompressedTexture) {
        return texturedCompressedMaterial;
    }
}
