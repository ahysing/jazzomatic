"use strict";
const audioAnalysisGlobal = {
    samplesMax: [],
    samplesAt: [],
    peakAtMS: null,
    BPMPosted: 0,
    sampleIdx: 0
};

function postMessageForMainThread(message) {
    window.postMessage(message);
}

/*
function postMessageForMainThread(message) {
    this.postMessage(message);
}
*/

/* http://joesul.li/van/beat-detection-using-web-audio/ */

// Beats per minute
function calculateBPM(state, sampleIdx) {
    return state.samplesMax.length / sampleIdx;
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

function findLastTwoSecondPeaks(audioAnalysisGlobal, nowMS) {
    const TwoSeconds = 2000;
    const nowMinusTwoSeconds = nowMS - TwoSeconds;

    var i = audioAnalysisGlobal.samplesAt.length - 1;
    while (i >= 0 && audioAnalysisGlobal.samplesAt[i] > nowMinusTwoSeconds) {
        i = i - 1;
    }
    
    return audioAnalysisGlobal.samplesMax.slice(i);
}

function peaksToTopBPM(peaksAtMS, sampleRate) {
    function calculateIndexDiff(peaksAtMS, sampleRate) {
        var indexDiffHistrogram = new Float32Array(2 * sampleRate);
        var previousIndex = peaksAtMS[0];
        for (var i = 1; i < peaksAtMS.length; i++) {
            var currentIndex = peaksAtMS[i];
            var diff =  currentIndex - previousIndex;
            if (diff > 0 && diff < indexDiffHistrogram.length) {
                indexDiffHistrogram[diff] ++;
            }

            previousIndex = currentIndex;
        }

        return indexDiffHistrogram;
    };

    if (peaksAtMS.length > 0) {
        var indexDiffHistrogram = calculateIndexDiff(peaksAtMS, sampleRate)
        indexDiffHistrogram.fill(0, 0, sampleRate / 10); // to remove any potential noise at the start.
        var maxSampleDiffrence = arrayMax(indexDiffHistrogram);
        return 60 * maxSampleDiffrence / sampleRate;
    }

    return 0;
}

function convertCurrentTimeToMS(currentTime) {
    const currentTimeMS =  1000 * currentTime;
    const songAtMS = Math.trunc(currentTimeMS);
    return songAtMS;
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

        // AudioContext currentTime delivers seconds since song was started.
        const songAtMS = convertCurrentTimeToMS(eventData.currentTime);
        audioAnalysisGlobal.sampleIdx++;

        var events = [];
        

        
        // This is my current experiment.
        // If I am right we will be ready to predict beats based on that they are 
        // the larget sound around.
        const maxPCMCurrentSample = calculateMaxPCM(eventData);
        
        audioAnalysisGlobal.samplesMax.push(maxPCMCurrentSample); 
        audioAnalysisGlobal.samplesAt.push(songAtMS);
        
        const lastSamplesMax = findLastTwoSecondPeaks(audioAnalysisGlobal, songAtMS);
        const maxPCMValue = arrayMax(lastSamplesMax);
        if (audioAnalysisGlobal.sampleIdx % 200 == 0) {
            // console.log("song at ms", songAtMS);
            // console.log("beats", lastSamplesMax);
        }
        const isBeatDetected = maxPCMValue === maxPCMCurrentSample;
        var isFarFromBeat = true;
        if (audioAnalysisGlobal.peakAtMS !== 0) {
            const twoHundredMS = 200;
            isFarFromBeat = (songAtMS - audioAnalysisGlobal.peakAtMS) > twoHundredMS;
        }
        
        const isInBeat = isBeatDetected && isFarFromBeat; 
        if (isInBeat) {
            audioAnalysisGlobal.peakAtMS = songAtMS;
            const beatEvent = {
                "command": "beat",
                "beat": songAtMS
            };

            events.push(beatEvent);
        }


        var nextBPM = peaksToTopBPM(lastSamplesMax);
        if (Math.abs(nextBPM - audioAnalysisGlobal.BPMPosted) > 0.005) {
            audioAnalysisGlobal.BPMPosted = nextBPM;
            var bpmEvent = {
                "command": "BPM",
                "BPM": nextBPM
            };

            events.push(bpmEvent);
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
                postMessageForMainThread(eventForDispatch);
            }
        }
    } else 
    if (event.data.command != "beat" && event.data.command != "BPM") // So far we are not able to dissect main thread vs analysis thread messages.
    {
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
