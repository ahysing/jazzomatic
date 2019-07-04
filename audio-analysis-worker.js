"use strict";
const global = {
    averageSample: 0,
    averageSamples: [],
    peaks: [],
    lastLogTime: 0,
    maxPCM: new Float32Array(44100 * 2), // 44,100 Hz is a common sampling frequency. maxCPM contains one second of data
    maxPCMidx: 0,
    BPMPosted: 0,
    sampleIdx: 0
};

/* http://joesul.li/van/beat-detection-using-web-audio/ */

// Beats per minute
function calculateBPM(state, sampleIdx) {
    return state.peaks.length / sampleIdx;
}

// Pulse-code modulation
function calculateMaxPCM(eventData) {
    return arrayMax(eventData.domainData);
}

function arrayMax(array) {
    function max(previousValue, currentValue) {
        return Math.max(previousValue, currentValue);
    };
    if (array && array.length) {
        return array.reduce(max);
    } else {
        return NaN;
    }
}

function peaksToTopBPM(peakIndecies, sampleRate) {
    function calculateIndexDiff(peakIndecies, sampleRate) {
        var indexDiffHistrogram = new Float32Array(2 * sampleRate);
        var previousIndex = peakIndecies[0];
        for (var i = 1; i < peakIndecies.length; i++) {
            var currentIndex = peakIndecies[i];
            var diff =  currentIndex - previousIndex;
            if (diff > 0 && diff < indexDiffHistrogram.length) {
                indexDiffHistrogram[diff] ++;
            }

            previousIndex = currentIndex;
        }

        return indexDiffHistrogram;
    };

    if (peakIndecies.length > 0) {
        var indexDiffHistrogram = calculateIndexDiff(peakIndecies, sampleRate)
        indexDiffHistrogram.fill(0, 0, sampleRate / 10); // to remove any potential noise at the start.
        var maxSampleDiffrence = arrayMax(indexDiffHistrogram);
        return 60 * maxSampleDiffrence / sampleRate;
    }

    return 0;
}
/**
 * This function looks at the frequencies in a song and tries to looks for interesting events for the camera.
 * Events are:
 * * BPM changes
 * * Breaks
 * * Solo parts
 */
function lookForSongEvent(eventData) {
    // console.time("lookForSongEvent");
    try {
        function arithmeticAverage(sample) {
            var intArray = Uint32Array.from(sample);
            function sum(previousValue, currentValue) {
                return previousValue + currentValue;
            }

            var sampleSum = intArray.reduce(sum);
            return sampleSum / intArray.length;
        };

        global.sampleIdx++;


        var averageValue = arithmeticAverage(eventData.domainData);
        global.averageSamples.push(averageValue);
        global.averageSample = arithmeticAverage(global.averageSamples);
        


        var events = [];


        // This is my current experiment.
        // If I am right we will be ready to predict beats based on that they are 
        // the larget sound around.
        const maxPCMCurrentSample = calculateMaxPCM(eventData);
        global.maxPCM[global.maxPCMidx] = maxPCMCurrentSample;
        global.maxPCMidx++;
        const maxPCMValue = arrayMax(global.maxPCM);

        const isInBeat = maxPCMValue === maxPCMCurrentSample; 
        if (isInBeat) {
            const beatEvent = {
                "command": "beat",
                "beat": global.sampleIdx
            };

            events.push(beatEvent);

            global.peaks.push(global.sampleIdx); 
        }


        var nextBPM = peaksToTopBPM(global.peaks);
        if (Math.abs(nextBPM - global.BPMPosted) > 0.005) {
            global.BPMPosted = nextBPM;
            var bpmEvent = {
                "command": "BPM",
                "BPM": nextBPM
            };

            events.push(bpmEvent);
        }

        
        if (Math.trunc(eventData.currentTime) > global.lastLogTime) {
            console.log("lookForSongEvent", global);
            global.lastLogTime = Math.trunc(eventData.currentTime); 
        }

        return events;
    } finally {
        // console.timeEnd("lookForSongEvent");
    }
}

self.addEventListener("message", function(event) {
    // recieving a message from a different page
    if (event.data.command === "registerControllerThread") {
        console.log("registerControllerThread", event.data);
    } else if (event.data.command === "sample"
            || event.data.command === "sample-lowpass") {
        const events = lookForSongEvent(event.data);
        if (events) {
            for (var i = 0; i < events.length; i++) {
                var eventForDispatch = events[i];
                this.postMessage(eventForDispatch);
            }
        }
    } else {
        console.log("Unknown message recieved", event.data);
    }
});

self.addEventListener("install", function(event) {
    main();
});

self.addEventListener("activate", function(event) {
    console.log("ServiceWorker activated");   
});

function main() {
}
