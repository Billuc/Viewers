import { $ } from 'meteor/jquery';
import { OHIF } from 'meteor/ohif:core';

function findAndRenderDisplaySet(displaySets, viewportIndex, studyInstanceUid, seriesInstanceUid, sopInstanceUid, renderedCallback) {
        // Find the proper stack to display
    const stacksFromSeries = displaySets.filter(stack => stack.seriesInstanceUid === seriesInstanceUid);
    stack = stacksFromSeries.find(stack => {
        const imageIndex = stack.images.findIndex(image => image.sopInstanceUid === sopInstanceUid);
        return imageIndex > -1;    
    });

    // TODO: make this work for multi-frame instances
    const specificImageIndex = stack.images.findIndex(image => image.sopInstanceUid === sopInstanceUid);

    const displaySetData = {
        studyInstanceUid: studyInstanceUid,
        seriesInstanceUid: seriesInstanceUid,
        sopInstanceUid: sopInstanceUid,
        displaySetInstanceUid: stack.displaySetInstanceUid,
        currentImageIdIndex: specificImageIndex
    };

    // Add a renderedCallback to activate the measurements once it's 
    if (renderedCallback) {
        displaySetData.renderedCallback = renderedCallback;    
    }

    window.layoutManager.rerenderViewportWithNewDisplaySet(viewportIndex, displaySetData);
}

function renderIntoViewport(viewportIndex, studyInstanceUid, seriesInstanceUid, sopInstanceUid, renderedCallback) {
    // First, check if we already have this study loaded
    const alreadyLoadedStudy = ViewerStudies.findOne({studyInstanceUid});

    if (alreadyLoadedStudy) {
        // If the Study is already loaded, find the display set and render it
        findAndRenderDisplaySet(alreadyLoadedStudy.displaySets, viewportIndex, studyInstanceUid, seriesInstanceUid, sopInstanceUid, renderedCallback)
    } else {
        // If not, retrieve the study metadata and then find the relevant display set and
        // render it.
        getStudyMetadata(studyInstanceUid, loadedStudy => {
            loadedStudy.displaySets = createStacks(loadedStudy);
            ViewerStudies.insert(loadedStudy);

            findAndRenderDisplaySet(loadedStudy.displaySets, viewportIndex, studyInstanceUid, seriesInstanceUid, sopInstanceUid, renderedCallback)
        });
    }
}

function getDisplaySetData(instance, series, study) {
    // First, check if we already have this study loaded
    var alreadyLoaded = ViewerStudies.findOne({
        studyInstanceUid: study.studyInstanceUid
    });

    // If not, retrieve it.
    if (!alreadyLoaded) {
        getStudyMetadata(priorStudy.studyInstanceUid, study => {
            study.abstractPriorValue = abstractPriorValue;
            study.displaySets = createStacks(study);
            ViewerStudies.insert(study);
            this.studies.push(study);
            this.matchImages(viewport);
            this.updateViewports();
        });
    }
    return {};
}

/**
 * Activates a set of lesions when lesion table row is clicked
 *
 * @param measurementId The unique key for a specific Measurement
 */
OHIF.measurements.jumpToRowItem = (rowItem, timepoints) => {
    OHIF.measurements.deactivateAllToolData();

    const activateMeasurements = OHIF.measurements.activateMeasurements;
    console.log('jumpToRowItem');

    // Retrieve the timepoints that are currently being displayed in the
    // Measurement Table
    const numTimepoints = timepoints.length;

    // Retrieve the list of available viewports
    const $viewports = $('.imageViewerViewport');
    const numViewports = $viewports.length;

    /* 
    Two Timepoints, Two measurements, load Followup (FU and BA), display FU in left and BA in right
    Two Timepoints, One measurement (BA), on 2x1 view: Display BA in right
    Two Timepoints, One measurement (FU), on 2x1 view: Display FU in left

    Two Timepoints, Two measurements, load Baseline (FU and BA) on 1x1 view: Display whichever is clicked on? 
    One Timepoint, One measurement: Display clicked on in 1x1
    */
    const numViewportsToUpdate = Math.min(numTimepoints, numViewports);
    
    for (var i=0; i < numViewportsToUpdate; i++) {
        const timepoint = timepoints[i];
        const timepointId = timepoint.timepointId;

        const dataAtThisTimepoint = _.where(rowItem.entries, {timepointId: timepointId});
        if (!dataAtThisTimepoint || !dataAtThisTimepoint.length) {
            continue;
        }

        const measurementData = dataAtThisTimepoint[0];

        // Check if the study / series we need is already the one in the viewport
        const element = $viewports.get(i);
        const enabledElement = cornerstone.getEnabledElement(element)
        const imageId = enabledElement.image.imageId;
        const instance = cornerstoneTools.metaData.get('instance', imageId);
        const series = cornerstoneTools.metaData.get('series', imageId);
        const study = cornerstoneTools.metaData.get('study', imageId);

        if (series.seriesInstanceUid === measurementData.seriesInstanceUid &&
            study.studyInstanceUid === measurementData.studyInstanceUid) {
            // If it is, activate the measurements in this viewport and stop here
            activateMeasurements(element, measurementData);
        } else {
            // Otherwise, re-render the viewport with the required study/series, then
            // add an onRendered callback to activate the measurements
            const renderedCallback = element => {
                activateMeasurements(element, measurementData);
            };

            // TODO: Support frames? e.g. for measurements on multi-frame instances
            renderIntoViewport(i,
                               measurementData.studyInstanceUid,
                               measurementData.seriesInstanceUid,
                               measurementData.sopInstanceUid,
                               renderedCallback);
        }
    }
};
