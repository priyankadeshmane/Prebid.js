/* globals describe, beforeEach, afterEach */
import { expect } from 'chai';
import { calculateTimeoutModifier, getDeviceType, checkVideo, getConnectionSpeed } from 'libraries/bidderTimeoutUtils/bidderTimeoutUtils.js';

const ORIGINAL_USER_AGENT = window.navigator.userAgent;
const ORIGINAL_CONNECTION = window.navigator.connection;

describe('bidderTimeoutUtils', () => {
  describe('getDeviceType', () => {
    afterEach(() => {
      window.navigator.__defineGetter__('userAgent', () => ORIGINAL_USER_AGENT);
    });

    [
      // deviceType, userAgent, deviceTypeNum
      ['pc', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246', 2],
      ['mobile', 'Mozilla/5.0 (iPhone; CPU iPhone OS 10_3_1 like Mac OS X) AppleWebKit/603.1.30 (KHTML, like Gecko) Version/10.0 Mobile/14E304 Safari/602.1', 4],
      ['tablet', 'Mozilla/5.0 (iPad; CPU OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148', 5],
    ].forEach(function (args) {
      const [deviceType, userAgent, deviceTypeNum] = args;
      it(`should be able to recognize ${deviceType} devices`, () => {
        window.navigator.__defineGetter__('userAgent', () => userAgent);
        const res = getDeviceType();
        expect(res).to.equal(deviceTypeNum);
      });
    });
  });

  describe('getConnectionSpeed', () => {
    afterEach(() => {
      window.navigator.__defineGetter__('connection', () => ORIGINAL_CONNECTION);
    });

    [
      // connectionType, connectionSpeed
      ['slow-2g', 'slow'],
      ['2g', 'slow'],
      ['3g', 'medium'],
      ['bluetooth', 'fast'],
      ['cellular', 'fast'],
      ['ethernet', 'fast'],
      ['wifi', 'fast'],
      ['wimax', 'fast'],
      ['4g', 'fast'],
      ['not known', 'unknown'],
      [undefined, 'unknown'],
    ].forEach(function (args) {
      const [connectionType, connectionSpeed] = args;
      it(`should be able to categorize connection speed when the connection type is ${connectionType}`, () => {
        window.navigator.__defineGetter__('connection', () => ({ type: connectionType }));
        const res = getConnectionSpeed();
        expect(res).to.equal(connectionSpeed);
      });
    });
  });

  describe('checkVideo', () => {
    it('should return true when any ad unit has video mediaType', () => {
      const adUnits = [{
        mediaTypes: {
          video: {}
        }
      }];
      expect(checkVideo(adUnits)).to.be.true;
    });

    it('should return false when no ad unit has video mediaType', () => {
      const adUnits = [{
        mediaTypes: {
          banner: {}
        }
      }];
      expect(checkVideo(adUnits)).to.be.false;
    });

    it('should handle empty ad units array', () => {
      expect(checkVideo([])).to.be.false;
    });

    it('should handle ad units without mediaTypes', () => {
      const adUnits = [
        { code: 'test1' },
        { code: 'test2', mediaTypes: {} }
      ];
      expect(checkVideo(adUnits)).to.be.false;
    });
  });

  describe('calculateTimeoutModifier', () => {
    it('should calculate the timeout modifier for video', () => {
      const adUnits = [{
        mediaTypes: {
          video: {}
        }
      }];
      const rules = {
        includesVideo: {
          'true': 200,
          'false': 50
        }
      };
      expect(calculateTimeoutModifier(adUnits, rules)).to.equal(200);
    });

    it('should calculate the timeout modifier for connectionSpeed', () => {
      window.navigator.__defineGetter__('connection', () => ({ type: 'slow-2g' }));
      const rules = {
        connectionSpeed: {
          'slow': 200,
          'medium': 100,
          'fast': 50
        }
      };
      expect(calculateTimeoutModifier([], rules)).to.equal(200);
    });

    it('should calculate the timeout modifier for deviceType', () => {
      window.navigator.__defineGetter__('userAgent', () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 10_3_1 like Mac OS X) AppleWebKit/603.1.30 (KHTML, like Gecko) Version/10.0 Mobile/14E304 Safari/602.1');
      const rules = {
        deviceType: {
          '2': 50,
          '4': 100,
          '5': 200
        }
      };
      expect(calculateTimeoutModifier([], rules)).to.equal(100);
    });

    it('should calculate the timeout modifier for ranged numAdunits', () => {
      const rules = {
        numAdUnits: {
          '1-5': 100,
          '6-10': 200,
          '11-15': 300
        }
      };
      const adUnits = [1, 2, 3, 4, 5, 6];
      expect(calculateTimeoutModifier(adUnits, rules)).to.equal(200);
    });

    it('should calculate the timeout modifier for exact numAdunits', () => {
      const rules = {
        numAdUnits: {
          '1': 100,
          '2': 200,
          '3': 300,
          '4-5': 400
        }
      };
      const adUnits = [1, 2];
      expect(calculateTimeoutModifier(adUnits, rules)).to.equal(200);
    });

    it('should add up all the modifiers when all the rules are present', () => {
      window.navigator.__defineGetter__('connection', () => ({ type: 'slow-2g' }));
      window.navigator.__defineGetter__('userAgent', () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 10_3_1 like Mac OS X) AppleWebKit/603.1.30 (KHTML, like Gecko) Version/10.0 Mobile/14E304 Safari/602.1');
      const rules = {
        connectionSpeed: {
          'slow': 200,
          'medium': 100,
          'fast': 50
        },
        deviceType: {
          '2': 50,
          '4': 100,
          '5': 200
        },
        includesVideo: {
          'true': 200,
          'false': 50
        },
        numAdUnits: {
          '1': 100,
          '2': 200,
          '3': 300,
          '4-5': 400
        }
      };
      const adUnits = [{
        mediaTypes: {
          video: {}
        }
      }];
      expect(calculateTimeoutModifier(adUnits, rules)).to.equal(600); // 200 (slow) + 100 (mobile) + 200 (video) + 100 (1 adUnit)
    });

    it('should handle null or undefined rules', () => {
      expect(calculateTimeoutModifier([], null)).to.equal(0);
      expect(calculateTimeoutModifier([], undefined)).to.equal(0);
    });

    it('should handle malformed rules object', () => {
      const rules = {
        includesVideo: null,
        deviceType: undefined,
        connectionSpeed: 'invalid',
        numAdUnits: []
      };
      expect(calculateTimeoutModifier([], rules)).to.equal(0);
    });
  });
});
