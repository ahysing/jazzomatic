'use strict';
const global = {
    averageSample: 0,
    averageSamples: [],
    peaks: [],
    lastLogTime: 0,
    maxPCM: new Uint8Array(44100), // 44,100 Hz is a common sampling frequency. maxCPM contains one second of data
    maxPCMidx: 0,
    BPM: 0,
    BPMPosted: 0,
    sampleIdx: 0
};

/* http://joesul.li/van/beat-detection-using-web-audio/ */

// Beats per minute
function calculateBPM(state, outputTimestamp, sampleIdx) {
    if (outputTimestamp) {
        return state.peaks.length / outputTimestamp.contextTime;
    } else {
        return state.peaks.length / sampleIdx;
    }
}

// Pulse-code modulation
function calculateMaxPCM(eventData) {
    return arrayMax(eventData.domainData);
}

function arrayMax(array) {
    function max(previousValue, currentValue) {
        return Math.max(previousValue, currentValue);
    };
    return array.reduce(max);
}
/**
 * This function looks at the frequencies in a song and tries to looks for interesting events for the camera.
 * Events are:
 * * BPM changes
 * * Breaks
 * * Solo parts
 */
function lookForSongEvent(eventData) {
    function arithmeticAverage(sample) {
        var intArray = Uint32Array.from(sample);
        function sum(previousValue, currentValue) {
            return previousValue + currentValue;
        }

        var sampleSum = intArray.reduce(sum);
        return sampleSum / intArray.length;
    };

    function standardDeviation(values) {
        const avg = arithmeticAverage(values);
        var squareDiffs = values.map(function(value) {
            var diff = value - avg;
            var sqrDiff = diff * diff;
            return sqrDiff;
        });

        var avgSquareDiff = average(squareDiffs);
        return Math.sqrt(avgSquareDiff);
    };

    global.sampleIdx = global.sampleIdx + 1;


    var averageValue = arithmeticAverage(eventData.domainData);
    global.averageSamples.push(averageValue);
    global.averageSample = arithmeticAverage(global.averageSamples);
    


    var events = [];


    // This is my current experiment. If I am right we will be ready to predict beats based on that they are the larget sound around.
    var maxPCMCurrentSample = calculateMaxPCM(eventData);
    global.maxPCM[global.maxPCMidx] = maxPCMCurrentSample;
    global.maxPCMidx++
    var maxValue = arrayMax(global.maxPCM);
    var isInBeat = maxValue == maxPCMCurrentSample; 
    if (isInBeat) {
        var breakEvent = {
            'command': 'break',
            'break': breakHere
        };

        events.push(breakEvent);
    }

    if (global.BPM !== 0 && global.BPM != global.BPMPosted) {
        global.BPMPosted = global.BPM;
        var bpmEvent = {
            'command': 'BPM',
            'BPM': global.BPM
        };

        events.push(bpmEvent);
    }

    if (Math.trunc(eventData.outputTimesamp.contextTime) > global.lastLogTime) {
        console.log('lookForSongEvent', global);
        global.lastLogTime = Math.trunc(eventData.outputTimesamp.contextTime); 
    }

    return events;
}

self.addEventListener('message', function(event) {
    // recieving a message from a different page
    if (event.data.command === 'registerControllerThread') {
        console.log('registerControllerThread', event.data);
    } else if (event.data.command === 'sample') {
        const events = lookForSongEvent(event.data);
        if (events) {
            for (var i = 0; i < events.length; i++) {
                var eventForDispatch = events[i];
                this.postMessage(eventForDispatch);
            }
        }
    } else {
        console.log('Unknown message recieved', event.data);
    }
});

self.addEventListener('install', function(event) {
    main();
});

self.addEventListener('fetch', function(event) {
});

self.addEventListener('activate', function(event) {
    console.log('ServiceWorker activated within the service worker');   
});

function main() {
    console.log('main');
}
