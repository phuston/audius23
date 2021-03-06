/*
Utility script that includes enumeration constants
*/

module.exports.playingMode = Object.freeze({
	PLAYING: 0, 
	PAUSE: 1, 
	STOP: 2,
	EXPORT: 3
});

module.exports.zoomLimits = Object.freeze({
	LOWER: 1/2, 
	UPPER: 4
});

module.exports.toolMode = Object.freeze({
	CURSOR: 0,
	SPLIT: 1,
	DRAG: 2,
	SELECT: 3,
	FADEIN: 4,
	FADEOUT: 5
});

module.exports.UIConstants = Object.freeze({
	LEFT: 88,
	TOP: 272,
	ROW_HEIGHT: 100,
});

module.exports.flagType = Object.freeze({
	FADEIN: 0,
	FADEOUT: 1
});

module.exports.selectedColor = '#5489BD';
