import {BANNER} from '../src/mediaTypes.js';
import {registerBidder} from '../src/adapters/bidderFactory.js';
import {getBidIdParameter} from '../src/utils.js';

export const spec = {
  code: 'lockerdome',
  supportedMediaTypes: [BANNER],
  isBidRequestValid: function(bid) {
    return !!bid.params.adUnitId;
  },
  buildRequests: function(bidRequests, bidderRequest) {
    let schain;

    const adUnitBidRequests = bidRequests.map(function (bid) {
      const bidSchain = bid?.ortb2?.source?.ext?.schain;
      if (bidSchain) schain = schain || bidSchain;
      return {
        requestId: bid.bidId,
        adUnitCode: bid.adUnitCode,
        adUnitId: getBidIdParameter('adUnitId', bid.params),
        sizes: bid.mediaTypes && bid.mediaTypes.banner && bid.mediaTypes.banner.sizes
      };
    });

    const payload = {
      bidRequests: adUnitBidRequests,
      // TODO: are these the right refererInfo values?
      url: encodeURIComponent(bidderRequest?.refererInfo?.canonicalUrl || ''),
      referrer: encodeURIComponent(bidderRequest?.refererInfo?.topmostLocation || '')
    };
    if (schain) {
      payload.schain = schain;
    }
    if (bidderRequest) {
      if (bidderRequest.gdprConsent) {
        payload.gdpr = {
          applies: bidderRequest.gdprConsent.gdprApplies,
          consent: bidderRequest.gdprConsent.consentString
        };
      }
      if (bidderRequest.uspConsent) {
        payload.us_privacy = {
          consent: bidderRequest.uspConsent
        }
      }
    }

    const payloadString = JSON.stringify(payload);
    return {
      method: 'POST',
      url: 'https://lockerdome.com/ladbid/prebid',
      data: payloadString
    };
  },
  interpretResponse: function(serverResponse, bidRequest) {
    if (!serverResponse || !serverResponse.body || !serverResponse.body.bids) {
      return [];
    }
    return serverResponse.body.bids.map(function(bid) {
      return {
        requestId: bid.requestId,
        cpm: bid.cpm,
        width: bid.width,
        height: bid.height,
        creativeId: bid.creativeId,
        currency: bid.currency,
        netRevenue: bid.netRevenue,
        ad: bid.ad,
        ttl: bid.ttl,
        meta: {
          advertiserDomains: bid.adomain && Array.isArray(bid.adomain) ? bid.adomain : []
        }
      };
    });
  },
};
registerBidder(spec);
