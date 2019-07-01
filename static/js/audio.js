'use strict';

/* http://joesul.li/van/beat-detection-using-web-audio/ */

  
// Function used to return a histogram of peak intervals
function countIntervalsBetweenNearbyPeaks(peaks) {
  var intervalCounts = [];
  peaks.forEach(function(peak, index) {
    var i;
    for(i = 0; i < 10; i++) {
      const interval = peaks[index + i] - peak;
      const foundInterval = intervalCounts.some(function(intervalCount) {
        if (intervalCount.interval === interval)
          return intervalCount.count++;
      });
      if (!foundInterval) {
        intervalCounts.push({
          interval: interval,
          count: 1
        });
      }
    }
  });

  return intervalCounts;
}
  