'use strict';
const validateGlb = require('../../lib/validateGlb');
const specUtility = require('./specUtility.js');

describe('validate Glb', () => {
    it('returns error message when Glb version is incorrect', async () => {
        const glb = specUtility.createGlb();
        glb.writeUInt32LE(1, 4);  // version
        const message = await validateGlb({
            content: glb,
            filePath: 'filepath'
        });
        expect(message).toBe('Invalid Glb version: 1. Version must be 2.');
    });
});
